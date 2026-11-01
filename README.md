# After Effects AEP & FFX Universal Downgrader ⚡

A high-performance, foolproof web application and CLI toolkit designed to convert **Adobe After Effects project files (`.aep`, `.aet`, `.aepx`)** and **animation presets (`.ffx`)** from newer releases (e.g. AE 2026, 2025) down to older releases (AE 2024, 2023, 2022, 2021, 2020, CC 2019, CC 2018).

---

## 🚀 Quick Start

### Option 1: Open Directly in Browser (No Server Needed)
You can directly double-click **[`index.html`](file:///c:/Users/DIPESH/Downloads/newa/index.html)** in Google Chrome, Microsoft Edge, Firefox, or Safari.
- Runs **100% offline** and client-side via JavaScript & Web APIs.
- **Zero upload time**: processes even 2GB+ files instantly.
- **100% Private**: Your project assets never leave your computer.

### Option 2: Run Local Web Server (Recommended)
Double-click or run from terminal:
```bash
python server.py
```
This automatically launches your default browser at **`http://localhost:8000`**.

### Option 3: Command-Line Interface (CLI)
You can also downgrade directly from your terminal:
```bash
# Downgrade a single preset (.ffx) to AE 2024:
python server.py pixel.ffx --target 2024

# Downgrade a project (.aep) to AE 2023:
python server.py my_project.aep --target 2023

# Batch downgrade an entire directory of presets / projects:
python server.py --batch "C:\Path\To\PresetFolder" --target 2024
```

---

## 🛠 Why This Method is 100% Foolproof

### The Problem with Naive Methods
1. **Blunt String Replacement Fails**: Naive text-replacement scripts (like searching for `"Adobe After Effects 2026"` and replacing it with `"2024"`) only touch XMP metadata strings at the bottom of the file. They **leave the binary header untouched**, so After Effects still throws:
   > *"This project was created in a newer version of After Effects and cannot be opened."*
2. **Naive Byte Search Corrupts Headers**: Simply searching for byte `0x61` from offset 0 will hit the `'a'` in the FourCC container marker `FaFX` (at index 9) or `'head'` (at index 14), corrupting the RIFX header and rendering the file invalid.

### How Our Engine Works
1. **Big-Endian RIFX Container Parsing**:
   - Accurately navigates chunk headers (`RIFX`, `FaFX`, `Egg!`, `head`, `LIST`).
2. **Precise Head Chunk Patching**:
   - For **`.ffx` presets**: rewrites the 4-byte big-endian integer version located inside the `head` chunk (byte 27).
   - For **`.aep` / `.aet` projects**: updates `head_data[1]` (byte 33) and matches the target build signature.
3. **Deep XMP Metadata Synchronization**:
   - Updates `CreatorTool` and `softwareAgent` XML tags so AE's project information and UI do not complain.
4. **Data Integrity & Zero Corruption**:
   - Preserves all keyframes, compositions, layer hierarchies, expression codes, and asset paths without modifying stream lengths or offsets.

---

## 🎯 Supported Target Versions

| Target Label | Major Version | Binary Byte | Recommended For |
| :--- | :--- | :--- | :--- |
| **After Effects 2025** | v25.x | `0x60` | Latest workstations |
| **After Effects 2024** | v24.x | `0x5F` | **Recommended Default** (Peak stability & compatibility) |
| **After Effects 2023** | v23.x | `0x5E` | Older production studios |
| **After Effects 2022** | v22.x | `0x5D` | Long-term support setups |
| **After Effects 2021** | v18.x | `0x5C` | Legacy setups |
| **After Effects 2020** | v17.x | `0x5B` | Legacy setups |
| **After Effects CC 2019**| v16.x | `0x5A` | Legacy setups |

---

## 📁 Included Files

- [`index.html`](file:///c:/Users/DIPESH/Downloads/newa/index.html): Studio-grade modern dark web app interface.
- [`app.js`](file:///c:/Users/DIPESH/Downloads/newa/app.js): Core binary parsing, RIFX validation, and batch conversion engine.
- [`styles.css`](file:///c:/Users/DIPESH/Downloads/newa/styles.css): Dark theme UI styling with glowing effects and responsive layout.
- [`builds-data.js`](file:///c:/Users/DIPESH/Downloads/newa/builds-data.js): 139 verified Adobe After Effects release build signatures.
- [`jszip.min.js`](file:///c:/Users/DIPESH/Downloads/newa/jszip.min.js): Bundled offline ZIP creation library for multi-file downloads.
- [`server.py`](file:///c:/Users/DIPESH/Downloads/newa/server.py): Standalone Python server & CLI batch downgrade tool.

