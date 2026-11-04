# Contributing to After Effects Downgrader

Thank you for your interest in improving After Effects Downgrader. We welcome bug reports, test cases, build signatures, and code contributions.

---

## Code of Conduct

Please maintain a collaborative, respectful environment. Keep communications constructive and technically precise.

---

## Reporting Issues

When reporting an issue, please include:
1. **Source Version:** The version of After Effects used to create the project or preset (e.g. AE 2026 v26.0).
2. **Target Version:** The target release you selected (e.g. AE 2024 v24.1).
3. **Environment:** OS (Windows 11, macOS Sequoia, Ubuntu) and tool version (Browser or CLI).
4. **Diagnostic Output:** Run `python server.py your_file.aep --info` and share the output.
5. **Observed Behavior:** Exact error message or behavior observed in After Effects.

---

## Submitting Build Signatures

To submit a new verified Adobe build signature:
1. Open `builds-data.js` and `ae-builds.json`.
2. Append the verified 7-byte hex string and readable version string:
   ```json
   {"hex": "006000010F8806", "version": "2025, v25.0.0 (Mac Arm 64)"}
   ```
3. Run the test suite:
   ```bash
   python -m unittest discover -s tests -v
   ```

---

## Development & Testing

1. Clone repository:
   ```bash
   git clone https://github.com/Dszae/After_effects_downgrade.git
   cd After_effects_downgrade
   ```
2. Run test suite:
   ```bash
   python -m unittest discover -s tests -v
   ```
3. Validate browser engine:
   ```bash
   node -c app.js
   node -c builds-data.js
   ```

---

## Pull Request Guidelines

- Ensure all tests pass.
- Maintain pure client-side privacy (no external dependencies, analytics, or remote calls).
- Keep code clean, readable, and well-commented.
