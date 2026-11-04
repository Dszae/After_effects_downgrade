# Command-Line Interface (CLI) Usage

The Python CLI (`server.py`) provides headless conversion, diagnostic file inspection, recursive batch processing, and a local web server runner without external package dependencies.

---

## 1. Requirements

- Python 3.8 or later.
- No `pip` installations required (uses Python standard library).

---

## 2. Command Synopsis

```bash
python server.py [FILE] [OPTIONS]
```

### Options

| Flag | Short | Description | Default |
| :--- | :--- | :--- | :--- |
| `--target YEAR` | `-t` | Target release year (`2018` to `2026`) | `2024` |
| `--output PATH` | `-o` | Custom output path for converted file | `[name]_AE[year].[ext]` |
| `--batch DIR` | `-b` | Recursively convert all `.aep`, `.ffx`, `.aet`, and `.aepx` in a folder | `None` |
| `--info` | `-i` | Inspect binary container metadata without modifying | `False` |
| `--port PORT` | `-p` | Local web server port | `8000` |
| `--no-xmp` | | Skip XMP XML metadata string synchronization | `False` |

---

## 3. Practical Examples

### Inspecting a File
Inspect container headers, detected version, and chunk offsets:
```bash
python server.py my_project.aep --info
```
Output:
```text
  path              : my_project.aep
  size              : 971633
  ext               : .aep
  valid             : True
  container         : RIFX (Egg!)
  detected_version  : AE 2024 (0x5F)
  detected_year     : 2024
  head_offset       : 24
```

### Downgrading a Single Preset (`.ffx`)
Convert an AE 2026 animation preset down to AE 2024:
```bash
python server.py samples/pixel_source_2026.ffx -t 2024 -o pixel_2024.ffx
```

### Downgrading a Project File (`.aep`)
Convert a project file down to AE 2023:
```bash
python server.py commercial_edit.aep -t 2023
```
Produces `commercial_edit_AE2023.aep`.

### Recursive Batch Conversion
Convert an entire folder of animation presets for team distribution:
```bash
python server.py --batch "C:\Presets\Pack" --target 2024
```

### Running the Local Web Server
Launch the browser GUI at `http://localhost:8000`:
```bash
python server.py
# or specify a custom port:
python server.py --port 8888
```

---

## 4. Exit Codes

- `0`: Success (file converted or all batch files processed successfully).
- `1`: Error (file not found, invalid RIFX format, or batch conversion failures).
