# Retro CFW Imager Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build a beautiful, beginner-friendly SD card imaging app for retro handheld CFW images.

**Architecture:** Use a Tauri desktop app so the UI can be polished with React/TypeScript while privileged disk detection/writing stays in Rust. Firmware/device/release data comes from a remote signed manifest, so adding muOS/ROCKNIX/KNULLI releases does not require shipping a new app.

**Tech Stack:** Tauri v2, Rust, React, TypeScript, Vite, Tailwind or CSS modules, signed JSON manifest, platform-specific disk write backends.

---

## Product principles

- **Safe first:** Never auto-select a disk. Never show system disks as normal targets. Require clear confirmation before destructive writes.
- **Customer friendly:** Avoid jargon. Say “Choose your handheld” instead of “select target board.”
- **Firmware-neutral:** muOS can be featured, but the architecture should support multiple firmware projects cleanly.
- **Manifest-driven:** Firmware/project/device/release data should be updateable remotely.
- **Verifiable:** Every downloaded image must be checksum verified before writing.
- **Recoverable:** If something fails, tell the user what happened and what to do next.

---

## Target MVP

### MVP features

- Firmware picker
- Device picker filtered by firmware compatibility
- Release picker
- SD card drive picker
- Download with progress
- Checksum verification
- Decompression for `.xz`, `.gz`, and `.zip`
- Raw image write with progress
- Post-write verification of at least first/last chunks or full hash where practical
- Safe eject/unmount where platform supports it
- Friendly success screen

### Not MVP yet

- Auto-partition resizing
- Firmware patching/customization before write
- Account/login system
- Cloud sync
- Image hosting service
- Telemetry, unless explicitly opt-in

---

## UX flow

### Screen 1: Welcome

- App name suggestion: **PocketFlasher**, **Handheld Imager**, **RetroCard**, or **Mustard Imager**.
- Primary CTA: “Get started”
- Secondary: “Use local image”

### Screen 2: Choose Firmware

Cards:

- muOS / mustardOS
- ROCKNIX
- KNULLI
- ArkOS
- JELOS legacy, if wanted
- Local image

Each card shows:

- Logo/name
- One-line description
- Supported device count
- Latest release date

### Screen 3: Choose Device

- Search bar
- Brand filters: Anbernic, PowKiddy, TrimUI, Miyoo, Retroid, etc.
- Device cards with common names and aliases
- Compatibility badges: Stable / Beta / Experimental

### Screen 4: Choose Release

- Recommended release selected by default
- Changelog link
- File size
- Required SD size
- Warning notes if needed

### Screen 5: Select SD Card

- Show removable drives only by default
- Display drive name, size, mount points, bus type
- Hide obvious system disks
- Advanced toggle to show all drives with extra warnings

### Screen 6: Confirm

Large clear warning:

> This will erase everything on **Samsung SD Card 64 GB**.

Require typing either:

```text
ERASE
```

or checking a strong confirmation box.

### Screen 7: Flashing progress

Progress stages:

- Downloading
- Verifying download
- Extracting
- Preparing SD card
- Writing image
- Verifying SD card
- Ejecting

### Screen 8: Done

- “Your SD card is ready.”
- First boot notes for selected firmware/device
- Link to firmware documentation
- Troubleshooting button

---

## Manifest design

Create `manifest/schema.json` and sample `manifest/index.json`.

### Example manifest

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-05-22T00:00:00Z",
  "firmwares": [
    {
      "id": "muos",
      "name": "muOS",
      "homepage": "https://muos.dev",
      "description": "A fast, clean custom firmware for retro handhelds.",
      "accentColor": "#f5c542",
      "devices": [
        {
          "id": "anbernic-rg35xx-h",
          "brand": "Anbernic",
          "name": "RG35XX H",
          "aliases": ["35XX H", "RG35XXH"],
          "status": "stable",
          "recommendedSdGb": 16,
          "releases": [
            {
              "version": "example-version",
              "channel": "stable",
              "date": "2026-05-22",
              "url": "https://example.com/muos-rg35xx-h.img.xz",
              "sizeBytes": 1234567890,
              "sha256": "replace-with-real-sha256",
              "compression": "xz",
              "imageFormat": "raw",
              "notes": "First boot may take several minutes."
            }
          ]
        }
      ]
    }
  ]
}
```

### Manifest rules

- Every release must include SHA-256.
- Every device should include aliases for customer search.
- Every release should declare minimum/recommended SD size.
- Manifest should be signed later with minisign/sigstore or embedded public-key verification.

---

## Safety requirements

### Disk detection

The backend must return this shape:

```ts
type Drive = {
  id: string;
  displayName: string;
  sizeBytes: number;
  isRemovable: boolean;
  isSystem: boolean;
  mountpoints: string[];
  busType?: "usb" | "sd" | "sata" | "nvme" | "unknown";
};
```

### Disk filtering

Default list:

- `isRemovable === true`
- `isSystem === false`
- size is plausible for SD card, e.g. 4 GB–1 TB

Advanced list:

- Can show more drives
- Requires extra “I understand this may erase an internal disk” confirmation

### Write confirmation

Before writing:

- Show selected drive name
- Show selected drive size
- Show mounted volumes that will be erased
- Require explicit confirmation

### Download verification

Never write an image unless:

- Download completed
- File size matches if `sizeBytes` is provided
- SHA-256 matches manifest
- Signature verification passes once signing is implemented

---

## Implementation tasks

### Task 1: Scaffold the Tauri app

**Objective:** Create the desktop app foundation.

**Files:**

- Create: `package.json`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/Cargo.toml`
- Create: `src/main.tsx`
- Create: `src/App.tsx`

**Steps:**

1. Initialize a Tauri + React + TypeScript app.
2. Confirm `npm run tauri dev` opens a desktop window.
3. Commit with `feat: scaffold tauri app`.

### Task 2: Add visual design system

**Objective:** Establish the customer-facing design language.

**Files:**

- Create: `src/styles/theme.css`
- Modify: `src/App.tsx`

**Design tokens:**

```css
:root {
  --bg: #101010;
  --surface: #181818;
  --surface-2: #222222;
  --text: #ffffff;
  --muted: #b7b7b7;
  --accent: #f5c542;
  --success: #25d366;
  --danger: #ff5c7a;
  --radius-card: 20px;
  --radius-pill: 999px;
}
```

**Steps:**

1. Add global dark theme.
2. Add card, button, stepper, and warning styles.
3. Build static mock screens for the flow.
4. Verify visually on desktop and small window sizes.
5. Commit with `style: add imager design system`.

### Task 3: Define manifest schema and loader

**Objective:** Load firmware/device/release data from JSON.

**Files:**

- Create: `manifest/schema.json`
- Create: `manifest/index.sample.json`
- Create: `src/lib/manifest.ts`
- Create: `src/lib/manifest.test.ts`

**Tests:**

- Valid manifest parses.
- Missing SHA-256 fails validation.
- Missing release URL fails validation.
- Device aliases are searchable.

**Steps:**

1. Write tests first.
2. Implement TypeScript types and validation.
3. Use bundled sample manifest in development.
4. Commit with `feat: add firmware manifest loader`.

### Task 4: Build firmware/device/release picker UI

**Objective:** Let customers select what they want to flash.

**Files:**

- Create: `src/components/FirmwarePicker.tsx`
- Create: `src/components/DevicePicker.tsx`
- Create: `src/components/ReleasePicker.tsx`
- Modify: `src/App.tsx`

**Steps:**

1. Render firmware cards from manifest.
2. Filter devices by selected firmware.
3. Add search by name/brand/alias.
4. Select recommended release by default.
5. Commit with `feat: add firmware selection flow`.

### Task 5: Implement drive detection backend

**Objective:** List candidate SD cards safely.

**Files:**

- Modify: `src-tauri/src/lib.rs`
- Create: `src/lib/drives.ts`
- Create: `src/components/DrivePicker.tsx`

**Platform strategy:**

- Windows: query physical disks with PowerShell/WMI or Rust crate; detect removable/bus type/system disk.
- Linux: read `/sys/block`, `lsblk --json`, or udev.
- macOS: use `diskutil list -plist`.

**Steps:**

1. Implement read-only drive listing first.
2. Mark system disks clearly.
3. UI defaults to removable non-system drives.
4. Add tests for filtering logic.
5. Commit with `feat: add safe drive detection`.

### Task 6: Implement download + checksum verification

**Objective:** Download selected image safely before writing.

**Files:**

- Modify: `src-tauri/src/lib.rs`
- Create: `src/lib/downloads.ts`
- Create: `src/components/FlashProgress.tsx`

**Steps:**

1. Download to app cache directory.
2. Stream progress events to UI.
3. Verify `sizeBytes` if present.
4. Verify SHA-256.
5. Stop with friendly error if verification fails.
6. Commit with `feat: add verified image downloads`.

### Task 7: Implement extraction

**Objective:** Support common CFW image formats.

**Files:**

- Modify: `src-tauri/src/lib.rs`
- Create: `src/lib/extract.ts`

**Formats:**

- `.img`
- `.img.gz`
- `.img.xz`
- `.zip` containing one `.img`

**Steps:**

1. Detect compression from manifest and filename.
2. Extract to temporary image file.
3. Validate exactly one image exists for zip.
4. Commit with `feat: add image extraction`.

### Task 8: Implement raw image writing

**Objective:** Write image to selected SD card.

**Files:**

- Modify: `src-tauri/src/lib.rs`
- Create: `src/lib/flashing.ts`

**Safety steps:**

1. Re-query drive immediately before writing.
2. Ensure selected drive ID still matches size/name expected by UI.
3. Unmount/eject volumes before writing.
4. Stream write progress.
5. Flush/sync after writing.
6. Verify written bytes.

**Commit:** `feat: add guarded image flashing`

### Task 9: Add completion and troubleshooting screens

**Objective:** Give non-technical users clear next steps.

**Files:**

- Create: `src/components/CompleteScreen.tsx`
- Create: `src/components/ErrorScreen.tsx`
- Modify: `manifest/index.sample.json`

**Steps:**

1. Add per-release notes.
2. Show first-boot instructions.
3. Add “What if my handheld does not boot?” help.
4. Commit with `feat: add completion guidance`.

### Task 10: Package installers

**Objective:** Produce customer-installable builds.

**Files:**

- Modify: `src-tauri/tauri.conf.json`
- Create: `.github/workflows/release.yml`

**Build targets:**

- Windows `.msi`/`.exe`
- macOS `.dmg`
- Linux AppImage/deb later

**Steps:**

1. Configure icons and app metadata.
2. Build Windows package first.
3. Add GitHub Actions release workflow.
4. Commit with `chore: add release packaging`.

---

## Open questions

1. App name: PocketFlasher, RetroCard, Handheld Imager, Mustard Imager, or something else?
2. First target platform: Windows only, or Windows/macOS/Linux from day one?
3. Will images be hosted by each CFW project, or should we maintain a central manifest pointing to official downloads?
4. Should muOS be featured/default, or should the tool feel completely neutral?
5. Do you want “local image mode” in MVP?
6. Should the app download full images only, or eventually support patch-based updates?

---

## Immediate next step

Build a clickable front-end prototype first, using a sample manifest and fake flashing progress. Once the UX feels right, connect the Rust backend for drive detection and writing.
