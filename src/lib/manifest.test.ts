import { describe, expect, it } from 'vitest';
import { filterCompatibleDevices, parseManifest, searchDevices } from './manifest';

const validManifest = {
  schemaVersion: 1,
  generatedAt: '2026-05-22T00:00:00Z',
  firmwares: [
    {
      id: 'muos',
      name: 'muOS',
      homepage: 'https://muos.dev',
      description: 'Fast retro handheld firmware.',
      accentColor: '#f5c542',
      devices: [
        {
          id: 'anbernic-rg35xx-h',
          brand: 'Anbernic',
          name: 'RG35XX H',
          aliases: ['35XX H', 'RG35XXH'],
          status: 'stable',
          recommendedSdGb: 16,
          releases: [
            {
              version: 'banana',
              channel: 'stable',
              date: '2026-05-22',
              url: 'https://example.com/muos-rg35xx-h.img.xz',
              sizeBytes: 1000,
              sha256: 'a'.repeat(64),
              compression: 'xz',
              imageFormat: 'raw',
              notes: 'First boot takes a few minutes.',
            },
          ],
        },
      ],
    },
  ],
};

describe('parseManifest', () => {
  it('accepts a valid manifest', () => {
    const manifest = parseManifest(validManifest);
    expect(manifest.firmwares[0].devices[0].name).toBe('RG35XX H');
  });

  it('rejects a release without a sha256 checksum', () => {
    const invalid = structuredClone(validManifest);
    delete (invalid.firmwares[0].devices[0].releases[0] as Record<string, unknown>).sha256;
    expect(() => parseManifest(invalid)).toThrow(/sha256/i);
  });

  it('rejects a release without a download URL', () => {
    const invalid = structuredClone(validManifest);
    invalid.firmwares[0].devices[0].releases[0].url = '';
    expect(() => parseManifest(invalid)).toThrow(/url/i);
  });
});

describe('device helpers', () => {
  it('filters devices by selected firmware', () => {
    const manifest = parseManifest(validManifest);
    expect(filterCompatibleDevices(manifest, 'muos')).toHaveLength(1);
    expect(filterCompatibleDevices(manifest, 'rocknix')).toHaveLength(0);
  });

  it('searches by brand, device name, and aliases', () => {
    const manifest = parseManifest(validManifest);
    const devices = filterCompatibleDevices(manifest, 'muos');
    expect(searchDevices(devices, 'anbernic')).toHaveLength(1);
    expect(searchDevices(devices, '35xxh')).toHaveLength(1);
    expect(searchDevices(devices, 'trimui')).toHaveLength(0);
  });
});
