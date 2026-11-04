# Supported Versions & Compatibility Matrix

This document provides a realistic compatibility matrix for Adobe After Effects projects (`.aep`, `.aet`), presets (`.ffx`), and XML interchange (`.aepx`).

---

## 1. Version Byte Reference

| Release | Version | Hex Byte | Decimal | Stability Tier |
| :--- | :--- | :--- | :--- | :--- |
| **After Effects 2026** | v26.x | `0x61` | 97 | Source Only |
| **After Effects 2025** | v25.x | `0x60` | 96 | Fully Supported |
| **After Effects 2024** | v24.x | `0x5F` | 95 | **Recommended Default** |
| **After Effects 2023** | v23.x | `0x5E` | 94 | Fully Supported |
| **After Effects 2022** | v22.x | `0x5D` | 93 | Fully Supported |
| **After Effects 2021** | v18.x | `0x5C` | 92 | Supported (Check Expressions) |
| **After Effects 2020** | v17.x | `0x5B` | 91 | Supported (Check Expressions) |
| **After Effects CC 2019**| v16.x | `0x5A` | 90 | Legacy (Experimental) |
| **After Effects CC 2018**| v15.x | `0x59` | 89 | Legacy (Experimental) |

---

## 2. Compatibility Levels Explained

### Tier 1: Verified (AE 2022 – AE 2025)
- **Status:** High confidence.
- **Why:** The underlying RIFX property serialization stream, property parameter IDs, and JavaScript expression engine remain structurally consistent across this range.
- **Recommended Target:** **AE 2024 (v24.x)** is the ideal target because it supports modern M-series Apple Silicon and modern GPU pipeline architectures while running on virtually every production workstation.

### Tier 2: Supported with Caveats (AE 2020 – AE 2021)
- **Status:** Functional for standard compositions, transforms, keyframes, shapes, and presets.
- **Caveats:**
  - Modern 3D features (e.g. Advanced 3D Engine, 3D model import `.glb`/`.gltf` introduced in 2024) are not supported in 2020/2021.
  - Multi-Frame Rendering (MFR) introduced in 22.0 does not affect project structure, but render behaviors will differ.

### Tier 3: Experimental Legacy (CC 2019 and earlier)
- **Status:** Metadata patches cleanly, but project load depends on composition complexity.
- **Caveats:** Projects with newer shape group operators, modern text engine features, or expressions relying on ECMAScript modern standards may generate runtime warnings.

---

## 3. Build Signatures Database

The application embeds **139 verified Adobe After Effects release build signatures** (sourced from `ae-builds.json`).

These allow targeting specific platform configurations:
- **Windows (`Win`)**: Standard x64 workstation builds.
- **macOS Apple Silicon (`Mac Arm 64`)**: M1/M2/M3/M4 optimized release signatures.
- **macOS Intel (`Mac`)**: Legacy x86_64 Mac releases.
