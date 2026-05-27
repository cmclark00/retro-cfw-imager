# Retro CFW Imager

A customer-friendly desktop imaging tool for retro handheld custom firmware.

Goal: let a user pick a firmware family (muOS, ROCKNIX, KNULLI, etc.), pick their handheld device, download the correct image, verify it, and safely write it to an SD card.

## Proposed stack

- **Desktop shell:** Tauri v2
- **Frontend:** React + TypeScript + Vite
- **Disk/image backend:** Rust commands exposed through Tauri
- **Manifest format:** signed JSON hosted on GitHub/CDN
- **Image support:** `.img`, `.img.gz`, `.img.xz`, `.zip` containing image files
- **Platforms:** Windows first, then macOS/Linux

## Core user flow

1. Choose firmware: muOS / ROCKNIX / KNULLI / ArkOS / etc.
2. Choose device: RG35XX H, TrimUI Smart Pro, RGB30, etc.
3. App shows compatible releases, notes, image size, and SD card size recommendation.
4. User selects SD card target.
5. App confirms destructive write with clear drive details.
6. App downloads image, verifies checksum/signature, decompresses if needed.
7. App writes image to SD card with progress.
8. App verifies write and safely ejects/unmounts.
9. App shows friendly completion + first-boot instructions.

## Design direction

Dark, premium, music-player-like interface inspired by handheld firmware launchers:

- Near-black background
- Colorful firmware/device cards
- Big step-by-step wizard
- Friendly warnings, no scary tech language unless needed
- Touch-friendly controls
- Clear device artwork / icons

## Repo status

This is currently a planning scaffold created by Hermes. Implementation has not started yet.
