use serde::{Deserialize, Serialize};
use sysinfo::Disks;
use tauri::{Emitter, Manager, Runtime};
use tokio::fs::File;
use tokio::io::AsyncWriteExt;
use futures_util::StreamExt;
use sha2::{Sha256, Digest};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DrivePreview {
    id: String,
    display_name: String,
    size_bytes: u64,
    is_removable: bool,
    is_system: bool,
    mountpoints: Vec<String>,
    bus_type: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProgressPayload {
    stage: String,
    percent: f32,
    message: String,
}

#[derive(Debug, Deserialize)]
struct DownloadArgs {
    url: String,
    sha256: String,
}

#[tauri::command]
fn list_drives_preview() -> Vec<DrivePreview> {
    if cfg!(windows) {
        // Windows specific logic using PowerShell to get physical disks
        let output = std::process::Command::new("powershell")
            .args([
                "-Command",
                "Get-Disk | Where-Object { $_.BusType -ne 'NVMe' -and $_.BusType -ne 'SATA' } | Select-Object Number, FriendlyName, Size, BusType, IsSystem, IsRemovable | ConvertTo-Json",
            ])
            .output();

        if let Ok(output) = output {
            let json_str = String::from_utf8_lossy(&output.stdout);
            // If there's only one disk, PowerShell returns a single object instead of an array.
            // Wrap it in [] if it doesn't start with [.
            let normalized_json = if json_str.trim().starts_with('{') {
                format!("[{}]", json_str)
            } else {
                json_str.to_string()
            };

            if let Ok(disks) = serde_json::from_str::<Vec<serde_json::Value>>(&normalized_json) {
                return disks
                    .iter()
                    .map(|d| {
                        let number = d["Number"].as_u64().unwrap_or(0);
                        let name = d["FriendlyName"].as_str().unwrap_or("Unknown").to_string();
                        let size = d["Size"].as_u64().unwrap_or(0);
                        let bus_type = d["BusType"].as_str().unwrap_or("unknown").to_string();
                        let is_system = d["IsSystem"].as_bool().unwrap_or(false);
                        let is_removable = d["IsRemovable"].as_bool().unwrap_or(true);

                        DrivePreview {
                            id: format!("\\\\.\\PhysicalDrive{}", number),
                            display_name: format!("Disk {}: {}", number, name),
                            size_bytes: size,
                            is_removable,
                            is_system,
                            mountpoints: vec![], // Harder to get in this one command
                            bus_type,
                        }
                    })
                    .collect();
            }
        }
    }

    // Fallback/Linux logic
    let disks = Disks::new_with_refreshed_list();
    disks
        .iter()
        .map(|disk| {
            let name = disk.name().to_string_lossy().to_string();
            let mount_point = disk.mount_point().to_string_lossy().to_string();
            
            // On Linux, the name is often the partition path like /dev/sdb1
            // We want the parent device path like /dev/sdb
            // TODO: Use a more robust way to find the parent block device (e.g., via /sys/block or libudev)
            let device_path = if name.starts_with("/dev/") {
                // Simplistic: strip trailing digits
                name.trim_end_matches(|c: char| c.is_ascii_digit()).to_string()
            } else {
                name.clone()
            };

            DrivePreview {
                id: device_path.clone(),
                display_name: if name.is_empty() { mount_point.clone() } else { format!("{} ({})", name, mount_point) },
                size_bytes: disk.total_space(),
                is_removable: disk.is_removable(),
                is_system: !disk.is_removable(),
                mountpoints: vec![mount_point],
                bus_type: "unknown".to_string(),
            }
        })
        .collect()
}

#[tauri::command]
async fn flash_image<R: Runtime>(
    app: tauri::AppHandle<R>,
    url: String,
    expected_sha256: String,
    drive_id: String,
) -> Result<(), String> {
    let cache_dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;
    
    let filename = url.split('/').last().unwrap_or("image.tmp");
    let dest_path = cache_dir.join(filename);

    // 1. Download
    app.emit("flash-progress", ProgressPayload {
        stage: "downloading".to_string(),
        percent: 0.0,
        message: format!("Downloading {}", filename),
    }).map_err(|e| e.to_string())?;

    let response = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    let total_size = response.content_length().unwrap_or(0);
    let mut file = File::create(&dest_path).await.map_err(|e| e.to_string())?;
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| e.to_string())?;
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        
        if total_size > 0 {
            let percent = (downloaded as f32 / total_size as f32) * 100.0;
            app.emit("flash-progress", ProgressPayload {
                stage: "downloading".to_string(),
                percent,
                message: format!("Downloading {} ({:.1}%)", filename, percent),
            }).map_err(|e| e.to_string())?;
        }
    }

    // 2. Verify
    app.emit("flash-progress", ProgressPayload {
        stage: "verifying".to_string(),
        percent: 0.0,
        message: "Verifying checksum...".to_string(),
    }).map_err(|e| e.to_string())?;

    let mut file = std::fs::File::open(&dest_path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    std::io::copy(&mut file, &mut hasher).map_err(|e| e.to_string())?;
    let hash = hasher.finalize();
    let actual_sha256 = hex::encode(hash);

    if actual_sha256 != expected_sha256 {
        return Err(format!("SHA-256 mismatch! Expected {}, got {}", expected_sha256, actual_sha256));
    }

    app.emit("flash-progress", ProgressPayload {
        stage: "verified".to_string(),
        percent: 100.0,
        message: "Checksum verified successfully.".to_string(),
    }).map_err(|e| e.to_string())?;

    // 3. Extract
    let ext = filename.split('.').last().unwrap_or("");
    let extracted_path = if ext == "xz" || ext == "gz" {
        let out_filename = filename.strip_suffix(&format!(".{}", ext)).unwrap_or("image.img");
        let out_path = cache_dir.join(out_filename);
        
        app.emit("flash-progress", ProgressPayload {
            stage: "extracting".to_string(),
            percent: 0.0,
            message: format!("Extracting {}...", filename),
        }).map_err(|e| e.to_string())?;

        let input_file = std::fs::File::open(&dest_path).map_err(|e| e.to_string())?;
        let mut output_file = std::fs::File::create(&out_path).map_err(|e| e.to_string())?;

        if ext == "xz" {
            let mut decompressor = xz2::read::XzDecoder::new(input_file);
            std::io::copy(&mut decompressor, &mut output_file).map_err(|e| e.to_string())?;
        } else {
            let mut decompressor = flate2::read::GzDecoder::new(input_file);
            std::io::copy(&mut decompressor, &mut output_file).map_err(|e| e.to_string())?;
        }

        app.emit("flash-progress", ProgressPayload {
            stage: "extracted".to_string(),
            percent: 100.0,
            message: "Extraction complete.".to_string(),
        }).map_err(|e| e.to_string())?;

        out_path
    } else {
        dest_path
    };

    // 4. Write
    app.emit("flash-progress", ProgressPayload {
        stage: "writing".to_string(),
        percent: 0.0,
        message: format!("Writing to {}...", drive_id),
    }).map_err(|e| e.to_string())?;

    if cfg!(windows) {
        // Windows writing logic using PowerShell (needs Admin)
        // We use a block-based copy for efficiency
        let ps_script = format!(
            "$input = [System.IO.File]::OpenRead('{}'); \
             $output = [System.IO.File]::OpenWrite('{}'); \
             $buffer = New-Object byte[] 4MB; \
             $total = $input.Length; \
             $done = 0; \
             while (($read = $input.Read($buffer, 0, $buffer.Length)) -gt 0) {{ \
                 $output.Write($buffer, 0, $read); \
                 $done += $read; \
                 # We could emit progress here if we could talk back to Tauri, \
                 # but for now we'll just wait for it to finish. \
             }} \
             $input.Close(); $output.Close();",
            extracted_path.display().to_string().replace("\\", "\\\\"),
            drive_id.replace("\\", "\\\\")
        );

        let status = std::process::Command::new("powershell")
            .args(["-Command", &ps_script])
            .status()
            .map_err(|e| e.to_string())?;

        if !status.success() {
            return Err("Failed to write image. Please ensure you are running the app as Administrator.".to_string());
        }
    } else {
        // Linux/Unix logic
        // Unmount first (Linux specific)
        let _ = std::process::Command::new("pkexec")
            .arg("umount")
            .arg(&drive_id)
            .arg(format!("{}*", drive_id)) // Try to unmount all partitions
            .status();

        let status = std::process::Command::new("pkexec")
            .arg("dd")
            .arg(format!("if={}", extracted_path.display()))
            .arg(format!("of={}", drive_id))
            .arg("bs=4M")
            .arg("conv=fsync")
            .status()
            .map_err(|e| e.to_string())?;

        if !status.success() {
            return Err("Failed to write image to disk. Make sure you provided the correct password and the drive is not in use.".to_string());
        }
    }

    // 5. Eject (Safe unmount/sync)
    app.emit("flash-progress", ProgressPayload {
        stage: "ejecting".to_string(),
        percent: 100.0,
        message: "Finalizing and syncing...".to_string(),
    }).map_err(|e| e.to_string())?;

    let _ = std::process::Command::new("sync").status();

    app.emit("flash-progress", ProgressPayload {
        stage: "done".to_string(),
        percent: 100.0,
        message: "Flash complete! You can now remove the SD card.".to_string(),
    }).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn fetch_manifest(url: String) -> Result<serde_json::Value, String> {
    let response = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    let json = response.json::<serde_json::Value>().await.map_err(|e| e.to_string())?;
    Ok(json)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![list_drives_preview, flash_image, fetch_manifest])
        .run(tauri::generate_context!())
        .expect("error while running Retro CFW Imager");
}
