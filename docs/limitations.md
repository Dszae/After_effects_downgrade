# Technical Limitations & Boundaries

This document provides transparent, technically accurate information regarding what this utility can and cannot achieve.

---

## 1. Version Lock Bypass vs. Feature Backporting

### What This Tool Does
When Adobe After Effects opens a file, it reads the container's `head` chunk. If the version integer exceeds the maximum version recognized by the application build, After Effects halts loading immediately with the error:
> *"This project was created in a newer version of After Effects and cannot be opened."*

This tool modifies the container version bytes and stream schema flags so that older releases of After Effects bypass the guard check and proceed to read the composition and effect streams.

### What This Tool Cannot Do
This tool **does not backport missing application features**. If a project or preset relies on features or plugins that do not exist in the target After Effects installation:

1. **Third-Party Plugins:**
   If a preset contains Boris FX Sapphire, Deep Glow 2, or Red Giant Trapcode parameters, and the target machine does not have those exact plugins installed, After Effects will open the file but flag missing effect errors.
2. **Native Effects Introduced in Newer Releases:**
   Features like the Advanced 3D Engine or native `.glb`/`.gltf` model layers introduced in AE 2024 cannot be rendered by AE 2022. The layer will load as an unhandled or blank layer.
3. **Newer Expression Engine Syntaxes:**
   Expressions using modern ECMAScript features will fail if opened in legacy releases using the old ExtendScript engine (pre-16.0).

---

## 2. After Effects Preset (`.ffx`) Requirements

When applying downgraded animation presets in After Effects:
- **Layer Selection is Required:** In Adobe After Effects, presets containing effect filters (`ADBE Effect Parade`) cannot be applied unless an active layer (e.g. an **Adjustment Layer** `Ctrl+Alt+Y` or **Solid** `Ctrl+Y`) is selected in the timeline. If no layer is highlighted in blue in the timeline, After Effects ignores the `Animation > Apply Animation Preset...` command.
- **Viewing Applied Effects:** Applied effects appear in the **Effect Controls** panel (`F3` or `Window > Effect Controls`). If the panel is closed, twirl open the layer arrow in the timeline to view the added effect properties.

---

## 3. Best Practices & Safety Guidelines

- **Always keep backups** of your original project files prior to conversion.
- For maximum cross-studio compatibility, target **After Effects 2024 (v24.x)** or **2023 (v23.x)**.
- If transferring complex projects across distant versions (e.g., AE 2026 to CC 2018), test rendering a single composition first to verify that no expressions or third-party effect properties were dropped.
