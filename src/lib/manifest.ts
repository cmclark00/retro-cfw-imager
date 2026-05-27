export type ReleaseChannel = 'stable' | 'beta' | 'experimental';
export type DeviceStatus = 'stable' | 'beta' | 'experimental';
export type Compression = 'none' | 'gz' | 'xz' | 'zip';
export type ImageFormat = 'raw';

export type FirmwareRelease = {
  version: string;
  channel: ReleaseChannel;
  date: string;
  url: string;
  sizeBytes?: number;
  sha256: string;
  compression: Compression;
  imageFormat: ImageFormat;
  notes?: string;
};

export type Device = {
  id: string;
  brand: string;
  name: string;
  aliases: string[];
  status: DeviceStatus;
  recommendedSdGb: number;
  releases: FirmwareRelease[];
};

export type Firmware = {
  id: string;
  name: string;
  homepage?: string;
  description: string;
  accentColor: string;
  devices: Device[];
};

export type FirmwareManifest = {
  schemaVersion: 1;
  generatedAt: string;
  firmwares: Firmware[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
}

function assertStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${path} must be an array of strings`);
  }
  return value;
}

function assertNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${path} must be a number`);
  }
  return value;
}

function assertEnum<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`${path} must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

function parseRelease(value: unknown, path: string): FirmwareRelease {
  if (!isRecord(value)) throw new Error(`${path} must be an object`);

  const sha256 = assertString(value.sha256, `${path}.sha256`).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    throw new Error(`${path}.sha256 must be a 64-character hex checksum`);
  }

  const release: FirmwareRelease = {
    version: assertString(value.version, `${path}.version`),
    channel: assertEnum(value.channel, ['stable', 'beta', 'experimental'] as const, `${path}.channel`),
    date: assertString(value.date, `${path}.date`),
    url: assertString(value.url, `${path}.url`),
    sha256,
    compression: assertEnum(value.compression, ['none', 'gz', 'xz', 'zip'] as const, `${path}.compression`),
    imageFormat: assertEnum(value.imageFormat, ['raw'] as const, `${path}.imageFormat`),
  };

  if (value.sizeBytes !== undefined) release.sizeBytes = assertNumber(value.sizeBytes, `${path}.sizeBytes`);
  if (value.notes !== undefined) release.notes = assertString(value.notes, `${path}.notes`);

  return release;
}

function parseDevice(value: unknown, path: string): Device {
  if (!isRecord(value)) throw new Error(`${path} must be an object`);
  const releasesValue = value.releases;
  if (!Array.isArray(releasesValue)) throw new Error(`${path}.releases must be an array`);

  return {
    id: assertString(value.id, `${path}.id`),
    brand: assertString(value.brand, `${path}.brand`),
    name: assertString(value.name, `${path}.name`),
    aliases: assertStringArray(value.aliases, `${path}.aliases`),
    status: assertEnum(value.status, ['stable', 'beta', 'experimental'] as const, `${path}.status`),
    recommendedSdGb: assertNumber(value.recommendedSdGb, `${path}.recommendedSdGb`),
    releases: releasesValue.map((release, index) => parseRelease(release, `${path}.releases[${index}]`)),
  };
}

function parseFirmware(value: unknown, path: string): Firmware {
  if (!isRecord(value)) throw new Error(`${path} must be an object`);
  const devicesValue = value.devices;
  if (!Array.isArray(devicesValue)) throw new Error(`${path}.devices must be an array`);

  const firmware: Firmware = {
    id: assertString(value.id, `${path}.id`),
    name: assertString(value.name, `${path}.name`),
    description: assertString(value.description, `${path}.description`),
    accentColor: assertString(value.accentColor, `${path}.accentColor`),
    devices: devicesValue.map((device, index) => parseDevice(device, `${path}.devices[${index}]`)),
  };

  if (value.homepage !== undefined) firmware.homepage = assertString(value.homepage, `${path}.homepage`);
  return firmware;
}

export function parseManifest(value: unknown): FirmwareManifest {
  if (!isRecord(value)) throw new Error('manifest must be an object');
  if (value.schemaVersion !== 1) throw new Error('manifest.schemaVersion must be 1');
  if (!Array.isArray(value.firmwares)) throw new Error('manifest.firmwares must be an array');

  return {
    schemaVersion: 1,
    generatedAt: assertString(value.generatedAt, 'manifest.generatedAt'),
    firmwares: value.firmwares.map((firmware, index) => parseFirmware(firmware, `manifest.firmwares[${index}]`)),
  };
}

export function filterCompatibleDevices(manifest: FirmwareManifest, firmwareId: string): Device[] {
  return manifest.firmwares.find((firmware) => firmware.id === firmwareId)?.devices ?? [];
}

function normalizeSearch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function searchDevices(devices: Device[], query: string): Device[] {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return devices;

  return devices.filter((device) => {
    const haystack = [device.brand, device.name, ...device.aliases].map(normalizeSearch).join(' ');
    return haystack.includes(normalizedQuery);
  });
}

export function getRecommendedRelease(device: Device): FirmwareRelease | undefined {
  return device.releases.find((release) => release.channel === 'stable') ?? device.releases[0];
}
