import type { FirmwareManifest } from '../lib/manifest';

export const sampleManifest: FirmwareManifest = {
  schemaVersion: 1,
  generatedAt: '2026-05-22T00:00:00Z',
  firmwares: [
    {
      id: 'muos',
      name: 'muOS',
      homepage: 'https://muos.dev',
      description: 'Clean, fast, community-built firmware for modern Linux handhelds.',
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
              version: 'Banana 2505.0',
              channel: 'stable',
              date: '2026-05-22',
              url: 'https://example.com/muos-rg35xx-h.img.xz',
              sizeBytes: 1_900_000_000,
              sha256: 'a'.repeat(64),
              compression: 'xz',
              imageFormat: 'raw',
              notes: 'First boot can take 3–5 minutes while the card expands and initializes.',
            },
          ],
        },
        {
          id: 'trimui-smart-pro',
          brand: 'TrimUI',
          name: 'Smart Pro',
          aliases: ['TSP', 'TrimUI SmartPro'],
          status: 'beta',
          recommendedSdGb: 32,
          releases: [
            {
              version: 'Banana 2505.0 Beta',
              channel: 'beta',
              date: '2026-05-22',
              url: 'https://example.com/muos-trimui-smart-pro.img.xz',
              sizeBytes: 2_300_000_000,
              sha256: 'b'.repeat(64),
              compression: 'xz',
              imageFormat: 'raw',
              notes: 'Beta build. Back up your existing SD card before flashing.',
            },
          ],
        },
      ],
    },
    {
      id: 'rocknix',
      name: 'ROCKNIX',
      homepage: 'https://rocknix.org',
      description: 'Console-like Linux gaming firmware with wide handheld support.',
      accentColor: '#39a7ff',
      devices: [
        {
          id: 'powkiddy-rgb30',
          brand: 'PowKiddy',
          name: 'RGB30',
          aliases: ['RGB 30'],
          status: 'stable',
          recommendedSdGb: 16,
          releases: [
            {
              version: '2026.05 Stable',
              channel: 'stable',
              date: '2026-05-15',
              url: 'https://example.com/rocknix-rgb30.img.gz',
              sizeBytes: 1_600_000_000,
              sha256: 'c'.repeat(64),
              compression: 'gz',
              imageFormat: 'raw',
              notes: 'Insert the card, boot once, then copy ROMs after setup completes.',
            },
          ],
        },
      ],
    },
    {
      id: 'knulli',
      name: 'KNULLI',
      homepage: 'https://knulli.org',
      description: 'A Batocera-inspired experience tuned for retro handhelds.',
      accentColor: '#ff5c7a',
      devices: [
        {
          id: 'anbernic-rg35xx-plus',
          brand: 'Anbernic',
          name: 'RG35XX Plus',
          aliases: ['35XX Plus', 'RG35XX+'],
          status: 'stable',
          recommendedSdGb: 32,
          releases: [
            {
              version: 'Firefly 2026.05',
              channel: 'stable',
              date: '2026-05-10',
              url: 'https://example.com/knulli-rg35xx-plus.img.xz',
              sizeBytes: 2_100_000_000,
              sha256: 'd'.repeat(64),
              compression: 'xz',
              imageFormat: 'raw',
              notes: 'After first boot, shut down cleanly before adding BIOS and ROM files.',
            },
          ],
        },
      ],
    },
  ],
};

export type DemoDrive = {
  id: string;
  displayName: string;
  sizeBytes: number;
  isRemovable: boolean;
  isSystem: boolean;
  mountpoints: string[];
  busType: 'usb' | 'sd' | 'sata' | 'nvme' | 'unknown';
};

export const demoDrives: DemoDrive[] = [
  {
    id: 'usb-samsung-64gb',
    displayName: 'Samsung EVO Select SD Card',
    sizeBytes: 64 * 1024 * 1024 * 1024,
    isRemovable: true,
    isSystem: false,
    mountpoints: ['E:'],
    busType: 'usb',
  },
  {
    id: 'usb-sandisk-32gb',
    displayName: 'SanDisk Ultra SD Card',
    sizeBytes: 32 * 1024 * 1024 * 1024,
    isRemovable: true,
    isSystem: false,
    mountpoints: ['F:'],
    busType: 'sd',
  },
];
