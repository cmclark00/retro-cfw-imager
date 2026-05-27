import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { CheckCircle2, Download, FileCode, HardDrive, Info, RadioTower, RefreshCw, Search, ShieldCheck, Sparkles, Usb, Zap } from 'lucide-react';

import { useEffect, useMemo, useState } from 'react';
import { sampleManifest, type DemoDrive } from './data/sampleManifest';
import { filterCompatibleDevices, getRecommendedRelease, searchDevices, type Device, type Firmware, type FirmwareManifest, type FirmwareRelease } from './lib/manifest';

const DEFAULT_MANIFEST_URL = 'https://raw.githubusercontent.com/cmclark00/retro-cfw-imager/master/manifest/index.json';

type StepId = 'firmware' | 'device' | 'release' | 'drive' | 'confirm' | 'flash' | 'done';

const steps: { id: StepId; label: string }[] = [
  { id: 'firmware', label: 'Firmware' },
  { id: 'device', label: 'Handheld' },
  { id: 'release', label: 'Release' },
  { id: 'drive', label: 'SD Card' },
  { id: 'confirm', label: 'Confirm' },
  { id: 'flash', label: 'Flash' },
  { id: 'done', label: 'Done' },
];

const formatBytes = (bytes: number) => {
  const gb = bytes / 1024 / 1024 / 1024;
  return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
};

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}

function StepRail({ currentStep }: { currentStep: StepId }) {
  const activeIndex = steps.findIndex((step) => step.id === currentStep);
  return (
    <nav className="step-rail" aria-label="Imaging progress">
      {steps.map((step, index) => {
        const isActive = step.id === currentStep;
        const isComplete = index < activeIndex;
        return (
          <div className={`step-dot ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''}`} key={step.id}>
            <span>{isComplete ? <CheckCircle2 size={14} /> : index + 1}</span>
            <small>{step.label}</small>
          </div>
        );
      })}
    </nav>
  );
}

function FirmwareCard({ firmware, selected, onSelect }: { firmware: Firmware; selected: boolean; onSelect: () => void }) {
  const supportedCount = firmware.devices.length;
  return (
    <button className={`selection-card firmware-card ${selected ? 'selected' : ''}`} onClick={onSelect} style={{ '--accent-card': firmware.accentColor } as React.CSSProperties}>
      <div className="card-glow" />
      <div className="firmware-mark">{firmware.name.slice(0, 2).toUpperCase()}</div>
      <div>
        <h3>{firmware.name}</h3>
        <p>{firmware.description}</p>
      </div>
      <div className="card-meta">
        <span>{supportedCount} demo device{supportedCount === 1 ? '' : 's'}</span>
        <span>Official image list</span>
      </div>
    </button>
  );
}

function DeviceCard({ device, selected, onSelect }: { device: Device; selected: boolean; onSelect: () => void }) {
  const release = getRecommendedRelease(device);
  return (
    <button className={`selection-card device-card ${selected ? 'selected' : ''}`} onClick={onSelect}>
      <div className="device-art"><HardDrive size={34} /></div>
      <div className="device-copy">
        <div className="eyebrow">{device.brand}</div>
        <h3>{device.name}</h3>
        <p>{device.aliases.join(' · ')}</p>
      </div>
      <div className="card-meta row">
        <StatusBadge status={device.status} />
        <span>{device.recommendedSdGb} GB+ SD</span>
        {release ? <span>{release.version}</span> : null}
      </div>
    </button>
  );
}

function ReleaseCard({ release, selected, onSelect }: { release: FirmwareRelease; selected: boolean; onSelect: () => void }) {
  return (
    <button className={`selection-card release-card ${selected ? 'selected' : ''}`} onClick={onSelect}>
      <div className="release-icon"><Download size={24} /></div>
      <div>
        <div className="eyebrow">Recommended image</div>
        <h3>{release.version}</h3>
        <p>{release.notes}</p>
      </div>
      <div className="card-meta row">
        <StatusBadge status={release.channel} />
        {release.sizeBytes ? <span>{formatBytes(release.sizeBytes)} download</span> : null}
        <span>{release.compression.toUpperCase()}</span>
      </div>
    </button>
  );
}

function DriveCard({ drive, selected, onSelect }: { drive: DemoDrive; selected: boolean; onSelect: () => void }) {
  return (
    <button className={`selection-card drive-card ${selected ? 'selected' : ''}`} onClick={onSelect}>
      <div className="drive-icon"><Usb size={26} /></div>
      <div>
        <div className="eyebrow">Removable {drive.busType.toUpperCase()}</div>
        <h3>{drive.displayName}</h3>
        <p>{drive.mountpoints.join(', ')} · {formatBytes(drive.sizeBytes)}</p>
      </div>
      {drive.isRemovable ? (
        <div className="safe-chip"><ShieldCheck size={15} /> Safe candidate</div>
      ) : (
        <div className="safe-chip danger"><Info size={15} /> System Drive (Caution)</div>
      )}
    </button>
  );
}

import { listen } from '@tauri-apps/api/event';

interface ProgressPayload {
  stage: string;
  percent: number;
  message: string;
}

function FlashProcess({ url, sha256, driveId, onDone, onError }: { url: string; sha256: string; driveId: string; onDone: () => void; onError: (err: string) => void }) {
  const [progress, setProgress] = useState<ProgressPayload>({ stage: 'starting', percent: 0, message: 'Initializing...' });

  useEffect(() => {
    const unlisten = listen<ProgressPayload>('flash-progress', (event) => {
      setProgress(event.payload);
    });

    invoke('flash_image', { url, expectedSha256: sha256, driveId })
      .then(() => onDone())
      .catch((err) => onError(err.toString()));

    return () => {
      unlisten.then((f) => f());
    };
  }, [url, sha256, driveId]);

  return (
    <section className="flash-panel">
      <div className="pulse-orb"><Zap size={40} /></div>
      <h2>Flashing SD card</h2>
      <p>{progress.message}</p>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress.percent}%` }} />
      </div>
      <div className="stage-list">
        <div className={progress.stage === 'downloading' ? 'active' : ''}><span>1</span>Downloading</div>
        <div className={progress.stage === 'verifying' ? 'active' : ''}><span>2</span>Verifying</div>
        <div className={progress.stage === 'extracting' ? 'active' : ''}><span>3</span>Extracting</div>
        <div className={progress.stage === 'writing' ? 'active' : ''}><span>4</span>Writing</div>
      </div>
    </section>
  );
}

export default function App() {
  const [manifest, setManifest] = useState<FirmwareManifest | null>(null);
  const [step, setStep] = useState<StepId>('firmware');
  const [selectedFirmwareId, setSelectedFirmwareId] = useState<string | null>(null);
  
  const selectedFirmware = manifest?.firmwares.find((firmware) => firmware.id === selectedFirmwareId) ?? manifest?.firmwares[0];
  
  const [deviceQuery, setDeviceQuery] = useState('');
  const devices = useMemo(() => {
    if (!manifest || !selectedFirmwareId) return [];
    return searchDevices(filterCompatibleDevices(manifest, selectedFirmwareId), deviceQuery);
  }, [manifest, selectedFirmwareId, deviceQuery]);

  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const selectedDevice = selectedFirmware?.devices.find((device) => device.id === selectedDeviceId) ?? selectedFirmware?.devices[0];
  
  const [selectedReleaseVersion, setSelectedReleaseVersion] = useState<string | null>(null);
  const selectedRelease = selectedDevice?.releases.find((release) => release.version === selectedReleaseVersion) ?? (selectedDevice ? getRecommendedRelease(selectedDevice) : null);
  
  const [drives, setDrives] = useState<DemoDrive[]>([]);
  const [selectedDriveId, setSelectedDriveId] = useState<string | null>(null);
  const selectedDrive = drives.find((drive) => drive.id === selectedDriveId);
  const [isRefreshingDrives, setIsRefreshingDrives] = useState(false);

  const [localFilePath, setLocalFilePath] = useState<string | null>(null);

  const [eraseConfirmed, setEraseConfirmed] = useState(false);
  const [flashError, setFlashError] = useState<string | null>(null);

  const selectLocalFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Images',
          extensions: ['img', 'gz', 'xz', '7z', 'zip']
        }]
      });
      if (selected && !Array.isArray(selected)) {
        setLocalFilePath(selected);
        setStep('drive');
      }
    } catch (error) {
      console.error('Failed to open file dialog:', error);
    }
  };

  const refreshDrives = async () => {
    setIsRefreshingDrives(true);
    try {
      const detectedDrives = await invoke<DemoDrive[]>('list_drives_preview');
      setDrives(detectedDrives);
      if (detectedDrives.length > 0 && !selectedDriveId) {
        setSelectedDriveId(detectedDrives.find(d => d.isRemovable)?.id ?? detectedDrives[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch drives:', error);
    } finally {
      setIsRefreshingDrives(false);
    }
  };

  useEffect(() => {
    refreshDrives();

    // Fetch manifest
    invoke<FirmwareManifest>('fetch_manifest', { url: DEFAULT_MANIFEST_URL })
      .then((data) => {
        setManifest(data);
        if (data.firmwares.length > 0) {
          setSelectedFirmwareId(data.firmwares[0].id);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch remote manifest, using sample:', err);
        setManifest(sampleManifest);
        setSelectedFirmwareId(sampleManifest.firmwares[0].id);
      });
  }, []);

  if (!manifest) {
    return (
      <main className="app-shell" style={{ display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Sparkles size={48} className="spin" style={{ color: 'var(--accent)', marginBottom: '20px' }} />
          <h2>Loading manifest...</h2>
        </div>
      </main>
    );
  }

  const selectFirmware = (firmware: Firmware) => {
    setSelectedFirmwareId(firmware.id);
    const firstDevice = firmware.devices[0];
    setSelectedDeviceId(firstDevice?.id ?? null);
    setSelectedReleaseVersion(firstDevice ? getRecommendedRelease(firstDevice)?.version ?? null : null);
  };

  const selectDevice = (device: Device) => {
    setSelectedDeviceId(device.id);
    setSelectedReleaseVersion(getRecommendedRelease(device)?.version ?? null);
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-icon"><Sparkles size={22} /></div>
          <div>
            <strong>Retro CFW Imager</strong>
            <span>Friendly SD card flashing</span>
          </div>
        </div>
        <StepRail currentStep={step} />
        <div className="safety-card">
          <ShieldCheck size={22} />
          <div>
            <strong>Safe by default</strong>
            <p>System disks hidden, checksums required, and destructive writes need confirmation.</p>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="hero">
          <div>
            <span className="hero-kicker"><RadioTower size={15} /> Manifest-powered prototype</span>
            <h1>Flash custom firmware without the guesswork.</h1>
            <p>Pick the firmware, pick the handheld, choose an SD card, and let the app handle the correct image and safety checks.</p>
          </div>
          <div className="hero-device">
            <div className="screen-lines"><span /><span /><span /></div>
          </div>
        </header>

        {step === 'firmware' && (
          <section className="flow-section">
            <div className="section-heading">
              <h2>Choose your firmware</h2>
              <p>Each card can be driven by official project images in the remote manifest.</p>
            </div>
            <div className="card-grid three">
              {manifest.firmwares.map((firmware) => (
                <FirmwareCard key={firmware.id} firmware={firmware} selected={firmware.id === selectedFirmwareId} onSelect={() => selectFirmware(firmware)} />
              ))}
            </div>
            
            <div className="section-divider">
              <span>OR</span>
            </div>

            <button className="selection-card drive-card full-width" onClick={selectLocalFile}>
              <div className="drive-icon"><FileCode size={26} /></div>
              <div style={{ textAlign: 'left' }}>
                <div className="eyebrow">Advanced</div>
                <h3>Flash from local file...</h3>
                <p>Use your own .img, .gz, or .xz file from your computer.</p>
              </div>
            </button>

            <button className="primary-button" onClick={() => { setLocalFilePath(null); setStep('device'); }}>Continue to handheld</button>
          </section>
        )}

        {step === 'device' && (
          <section className="flow-section">
            <div className="section-heading split">
              <div>
                <h2>Choose the handheld</h2>
                <p>Showing devices compatible with {selectedFirmware?.name}.</p>
              </div>
              <label className="search-box"><Search size={17} /><input value={deviceQuery} onChange={(event) => setDeviceQuery(event.target.value)} placeholder="Search brand, model, or nickname" /></label>
            </div>
            <div className="card-grid two">
              {devices.map((device) => <DeviceCard key={device.id} device={device} selected={device.id === selectedDevice?.id} onSelect={() => selectDevice(device)} />)}
            </div>
            <div className="button-row"><button className="secondary-button" onClick={() => setStep('firmware')}>Back</button><button className="primary-button" disabled={!selectedDevice} onClick={() => setStep('release')}>Continue to release</button></div>
          </section>
        )}

        {step === 'release' && selectedDevice && selectedRelease && (
          <section className="flow-section">
            <div className="section-heading">
              <h2>Choose a release</h2>
              <p>{selectedDevice.brand} {selectedDevice.name} · recommended SD size {selectedDevice.recommendedSdGb} GB or larger.</p>
            </div>
            <div className="card-grid one">
              {selectedDevice.releases.map((release) => <ReleaseCard key={release.version} release={release} selected={release.version === selectedRelease.version} onSelect={() => setSelectedReleaseVersion(release.version)} />)}
            </div>
            <div className="info-callout"><Info size={18} /> Every production image must include a verified SHA-256 checksum before it can be written.</div>
            <div className="button-row"><button className="secondary-button" onClick={() => setStep('device')}>Back</button><button className="primary-button" onClick={() => setStep('drive')}>Continue to SD card</button></div>
          </section>
        )}

        {step === 'drive' && (
          <section className="flow-section">
            <div className="section-heading split">
              <div>
                <h2>Select the SD card</h2>
                <p>Removable drives detected on your system.</p>
              </div>
              <button 
                className="secondary-button icon-only" 
                onClick={refreshDrives} 
                disabled={isRefreshingDrives}
                title="Refresh drives"
              >
                <RefreshCw size={18} className={isRefreshingDrives ? 'spin' : ''} />
              </button>
            </div>
            <div className="card-grid one">
              {drives.length > 0 ? (
                drives.map((drive) => (
                  <DriveCard 
                    key={drive.id} 
                    drive={drive} 
                    selected={drive.id === selectedDriveId} 
                    onSelect={() => setSelectedDriveId(drive.id)} 
                  />
                ))
              ) : (
                <div className="empty-state">
                  <Usb size={48} />
                  <p>No removable drives detected. Please insert your SD card.</p>
                  <button className="secondary-button" onClick={refreshDrives}>Refresh list</button>
                </div>
              )}
            </div>
            <div className="button-row">
              <button className="secondary-button" onClick={() => setStep('release')}>Back</button>
              <button className="primary-button" disabled={!selectedDrive} onClick={() => setStep('confirm')}>Review and confirm</button>
            </div>
          </section>
        )}

        {step === 'confirm' && (localFilePath || selectedRelease) && selectedDrive && (
          <section className="flow-section confirm-section">
            <div className="danger-panel">
              <h2>This will erase the selected SD card.</h2>
              <p><strong>{selectedDrive.displayName}</strong> · {formatBytes(selectedDrive.sizeBytes)} · {selectedDrive.mountpoints.join(', ')}</p>
              {localFilePath ? (
                <p>Image: Local file - {localFilePath.split(/[\\/]/).pop()}</p>
              ) : (
                <p>Image: {selectedFirmware?.name} {selectedRelease?.version} for {selectedDevice?.brand} {selectedDevice?.name}</p>
              )}
              <label className="confirm-check"><input type="checkbox" checked={eraseConfirmed} onChange={(event) => setEraseConfirmed(event.target.checked)} /> I understand this erases the SD card and I have selected the correct drive.</label>
            </div>
            {flashError && <div className="info-callout danger" style={{ marginTop: '16px', color: 'var(--danger)', borderColor: 'var(--danger)' }}><Info size={18} /> {flashError}</div>}
            <div className="button-row"><button className="secondary-button" onClick={() => setStep('drive')}>Back</button><button className="primary-button danger" disabled={!eraseConfirmed} onClick={() => { setFlashError(null); setStep('flash'); }}>Flash this SD card</button></div>
          </section>
        )}

        {step === 'flash' && (localFilePath || (selectedRelease && selectedDrive)) && (
          <FlashProcess 
            url={localFilePath || selectedRelease!.url} 
            sha256={localFilePath ? 'placeholder' : selectedRelease!.sha256} 
            driveId={selectedDrive!.id} 
            onDone={() => setStep('done')} 
            onError={(err) => { setFlashError(err); setStep('confirm'); }} 
          />
        )}

        {step === 'done' && selectedRelease && (
          <section className="done-panel">
            <CheckCircle2 size={58} />
            <h2>Your SD card is ready.</h2>
            <p>{selectedFirmware?.name} {selectedRelease.version} is ready for {selectedDevice?.brand} {selectedDevice?.name}.</p>
            <div className="next-steps"><strong>First boot tip:</strong> {selectedRelease.notes}</div>
            <button className="primary-button" onClick={() => { setEraseConfirmed(false); setStep('firmware'); }}>Flash another card</button>
          </section>
        )}
      </section>
    </main>
  );
}
