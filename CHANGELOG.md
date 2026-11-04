# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.1.0] - 2026-11-04

### Added
- Comprehensive test suite (`tests/test_converter.py`) verifying binary RIFX container parsing, boundary checks, and version mapping.
- Diagnostic `--info` flag in Python CLI to inspect container metadata and offsets without modifying files.
- Custom output file path option (`-o` / `--output`) in CLI.
- Modular documentation suite (`docs/architecture.md`, `docs/supported-versions.md`, `docs/cli-usage.md`, `docs/limitations.md`).
- Formal `LICENSE` (MIT), `CONTRIBUTING.md`, `SECURITY.md`, and `ROADMAP.md`.

### Changed
- Complete unslopped design system implementation: studio graphite ramp, quiet chrome, tabular typography, and restrained hairlines.
- Canonical test files organized cleanly into `samples/`.
- Enhanced boundary checks in Python and JavaScript parsers.

---

## [2.0.0] - 2026-11-01

### Added
- Universal browser-based interface running 100% client-side with zero external dependencies.
- Dual-format conversion engine for both `.aep` (Project) and `.ffx` (Animation Preset) files.
- Preset stream schema version patching (Schema 1 `00 00 00 01 01 02 00 00`) fixing silent effect drop in AE 2024.
- In-place XMP metadata XML string synchronization.
- Real-time binary inspector and hex difference viewer.
- Bundled offline ZIP archive creation via JSZip.
- Embedded database of 139 verified Adobe After Effects release build signatures.
