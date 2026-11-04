# Project Roadmap

This roadmap outlines the completed, in-progress, and planned developments for After Effects Downgrader.

---

## Completed (v2.1)
- [x] Client-side binary container parsing for `.aep`, `.aet`, and `.ffx`.
- [x] XML interchange project (`.aepx`) attribute rewriting.
- [x] Full 16-byte preset `head` chunk patching matching official AE schema v1.
- [x] 100% offline standalone execution in browser via HTML5 TypedArrays.
- [x] Python CLI with recursive batch directory processing and diagnostic `--info` mode.
- [x] Embedded database of 139 verified Adobe build signatures.
- [x] Automated unit test suite with 100% pass rate.
- [x] Graphite-neutral unslopped studio UI design.

---

## In Progress
- [ ] Automated regression testing on expanded sets of third-party plugin presets (Trapcode, Element 3D, Magic Bullet).
- [ ] Integration of Web Worker threads for background processing of multi-gigabyte project files in browser.

---

## Planned
- [ ] Standalone desktop executables (Windows `.exe` and macOS `.app`) packaged via PyInstaller.
- [ ] Direct composition dependency inspector (listing installed vs missing effect MatchNames prior to opening in After Effects).
- [ ] Expand build database for upcoming AE releases.
