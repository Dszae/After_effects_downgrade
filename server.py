#!/usr/bin/env python3
r"""
After Effects AEP & FFX Universal Downgrader
Local Web Server & Command-Line Interface (CLI)

Features:
  - Inspects and downgrades After Effects Project (.aep, .aet) and Preset (.ffx) files.
  - Recursively processes folders of presets in batch.
  - Runs a zero-dependency local HTTP server for the browser interface.
"""

import sys
import os
import argparse
import webbrowser
import http.server
import socketserver
from pathlib import Path

VERSION_MAP = {
    2026: {'major': 26, 'byte': 0x61, 'label': 'AE 2026 (v26.x)'},
    2025: {'major': 25, 'byte': 0x60, 'label': 'AE 2025 (v25.x)'},
    2024: {'major': 24, 'byte': 0x5F, 'label': 'AE 2024 (v24.x)'},
    2023: {'major': 23, 'byte': 0x5E, 'label': 'AE 2023 (v23.x)'},
    2022: {'major': 22, 'byte': 0x5D, 'label': 'AE 2022 (v22.x)'},
    2021: {'major': 18, 'byte': 0x5C, 'label': 'AE 2021 (v18.x)'},
    2020: {'major': 17, 'byte': 0x5B, 'label': 'AE 2020 (v17.x)'},
    2019: {'major': 16, 'byte': 0x5A, 'label': 'AE CC 2019 (v16.x)'},
    2018: {'major': 15, 'byte': 0x59, 'label': 'AE CC 2018 (v15.x)'}
}

def byte_to_year(b: int) -> int:
    """Map binary RIFX major version byte to release year."""
    if 0x50 <= b <= 0x75:
        return 2000 + (b - 0x5b + 20)
    return None

def inspect_file(file_path: Path) -> dict:
    """Parse container headers and return diagnostic metadata."""
    if not file_path.exists():
        return {'valid': False, 'error': f"File not found: {file_path}"}

    ext = file_path.suffix.lower()
    data = file_path.read_bytes()

    info = {
        'path': str(file_path),
        'size': len(data),
        'ext': ext,
        'valid': False,
        'container': None,
        'detected_version': 'Unknown',
        'detected_year': None,
        'head_offset': None
    }

    if ext == '.aepx':
        info['container'] = 'XML'
        text = data[:4000].decode('utf-8', errors='replace')
        import re
        m = re.search(r'bva="([0-9\.]+)"', text) or re.search(r'app_version="([0-9\.]+)"', text)
        if m:
            info['valid'] = True
            info['detected_version'] = m.group(1)
            yr = int(m.group(1).split('.')[0])
            info['detected_year'] = yr > 2000 and yr or (2000 + yr)
        return info

    if len(data) < 32 or data[:4] != b'RIFX':
        info['error'] = "Missing RIFX magic bytes (not a valid After Effects binary file)"
        return info

    form_type = data[8:12]
    info['container'] = f"RIFX ({form_type.decode('ascii', errors='replace')})"

    pos = 12
    head_pos = -1
    while pos + 8 <= min(len(data), 4096):
        cid = data[pos:pos+4]
        csize = int.from_bytes(data[pos+4:pos+8], 'big')
        if csize < 0 or pos + 8 + csize > len(data):
            break
        if cid == b'head':
            head_pos = pos
            break
        pos += 8 + csize
        if pos % 2 == 1:
            pos += 1

    if head_pos == -1:
        head_pos = data.find(b'head')

    if head_pos != -1 and head_pos + 20 <= len(data):
        info['head_offset'] = head_pos
        info['valid'] = True
        if ext == '.ffx':
            ver_byte = data[head_pos + 15]
            yr = byte_to_year(ver_byte)
            info['detected_year'] = yr
            info['detected_version'] = f"AE {yr} (0x{ver_byte:02X})" if yr else f"0x{ver_byte:02X}"
        else:
            ver_byte = data[head_pos + 9]
            yr = byte_to_year(ver_byte)
            info['detected_year'] = yr
            info['detected_version'] = f"AE {yr} (0x{ver_byte:02X})" if yr else f"0x{ver_byte:02X}"
    else:
        info['error'] = "Could not locate valid 'head' chunk"

    return info

def downgrade_file(file_path: Path, target_year: int = 2024, output_path: Path = None, deep_patch: bool = True) -> tuple[bool, str]:
    """
    Downgrades an After Effects project or preset to a target release.
    Returns (success, message).
    """
    if not file_path.exists():
        return False, f"File not found: {file_path}"

    ext = file_path.suffix.lower()
    if ext not in ['.aep', '.ffx', '.aet', '.aepx']:
        return False, f"Unsupported file type: {ext}. Expected .aep, .ffx, .aet, or .aepx."

    if target_year not in VERSION_MAP:
        return False, f"Unsupported target year: {target_year}. Supported: {list(VERSION_MAP.keys())}"

    target_byte = VERSION_MAP[target_year]['byte']
    data = bytearray(file_path.read_bytes())

    if ext == '.aepx':
        # Text-based XML Project
        try:
            text = data.decode('utf-8', errors='replace')
            target_major = target_year - 2000
            import re
            text = re.sub(r'bva="[0-9\.]+"', f'bva="{target_major}.0"', text)
            text = re.sub(r'app_version="[0-9\.]+"', f'app_version="{target_major}.0"', text)
            if deep_patch:
                for y in range(2028, target_year, -1):
                    text = text.replace(f"Adobe After Effects {y}", f"Adobe After Effects {target_year}")
            out_data = text.encode('utf-8')
            orig_str = "XML Project"
        except Exception as e:
            return False, f"Error processing AEPX: {e}"
    else:
        # Binary Big-Endian RIFX container
        if len(data) < 32 or data[:4] != b'RIFX':
            return False, "Not a valid After Effects binary file (missing RIFX header)"

        form_type = data[8:12]
        if ext == '.ffx' and form_type != b'FaFX':
            return False, f"Invalid preset format: expected FaFX form in RIFX container, got {form_type}"
        elif ext in ['.aep', '.aet'] and form_type != b'Egg!':
            return False, f"Invalid project format: expected Egg! form in RIFX container, got {form_type}"

        # Locate head chunk
        pos = 12
        head_pos = -1
        while pos + 8 <= min(len(data), 4096):
            cid = data[pos:pos+4]
            csize = int.from_bytes(data[pos+4:pos+8], 'big')
            if csize < 0 or pos + 8 + csize > len(data):
                break
            if cid == b'head':
                head_pos = pos
                break
            pos += 8 + csize
            if pos % 2 == 1:
                pos += 1

        if head_pos == -1:
            head_pos = data.find(b'head')

        if head_pos == -1 or head_pos + 24 > len(data):
            return False, "Could not locate valid 'head' chunk in RIFX container"

        if ext == '.ffx':
            orig_byte = data[head_pos + 15]
            orig_yr = byte_to_year(orig_byte)
            # Patch entire 16 bytes of head data to match official AE preset schema:
            # 00000003 000000<version> 00000001 01020000
            data[head_pos + 8:head_pos + 24] = bytes([
                0x00, 0x00, 0x00, 0x03,
                0x00, 0x00, 0x00, target_byte,
                0x00, 0x00, 0x00, 0x01,
                0x01, 0x02, 0x00, 0x00
            ])
        else:
            orig_byte = data[head_pos + 9]
            orig_yr = byte_to_year(orig_byte)
            data[head_pos + 9] = target_byte

        # Deep patch XMP metadata XML
        raw_text = bytes(data)
        if deep_patch:
            xmp_count = 0
            for y in range(2028, target_year, -1):
                s1 = f"Adobe After Effects {y}".encode('latin1')
                r1 = f"Adobe After Effects {target_year}".encode('latin1')
                if s1 in raw_text:
                    raw_text = raw_text.replace(s1, r1)
                    xmp_count += 1
                s2 = f"After Effects {y}".encode('latin1')
                r2 = f"After Effects {target_year}".encode('latin1')
                if s2 in raw_text:
                    raw_text = raw_text.replace(s2, r2)
                    xmp_count += 1

        out_data = bytearray(raw_text)
        # Re-ensure head chunk integrity after XMP synchronization
        if ext == '.ffx':
            out_data[head_pos + 8:head_pos + 24] = bytes([
                0x00, 0x00, 0x00, 0x03,
                0x00, 0x00, 0x00, target_byte,
                0x00, 0x00, 0x00, 0x01,
                0x01, 0x02, 0x00, 0x00
            ])
        else:
            out_data[head_pos + 9] = target_byte

        orig_str = f"AE {orig_yr}" if orig_yr else "Unknown"

    if output_path is None:
        stem = file_path.stem
        output_path = file_path.with_name(f"{stem}_AE{target_year}{ext}")

    output_path.write_bytes(out_data)
    return True, f"{file_path.name} ({orig_str} -> AE {target_year}) -> {output_path.name}"

def start_server(port: int = 8000):
    """Serve the browser application locally."""
    web_dir = Path(__file__).resolve().parent
    os.chdir(web_dir)

    class CustomHandler(http.server.SimpleHTTPRequestHandler):
        def end_headers(self):
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
            super().end_headers()

    with socketserver.TCPServer(("", port), CustomHandler) as httpd:
        url = f"http://localhost:{port}"
        print(f"After Effects Downgrader server running at: {url}")
        print("Press Ctrl+C to stop.")
        webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

def main():
    parser = argparse.ArgumentParser(
        description="After Effects Project (.aep) & Animation Preset (.ffx) Version Downgrader"
    )
    parser.add_argument("file", nargs="?", help="Path to .aep, .ffx, .aet, or .aepx file")
    parser.add_argument("-t", "--target", type=int, default=2024, choices=list(VERSION_MAP.keys()),
                        help="Target AE release year (default: 2024)")
    parser.add_argument("-o", "--output", type=str, help="Custom output file path")
    parser.add_argument("-b", "--batch", type=str, help="Directory path to batch convert all .aep and .ffx files")
    parser.add_argument("-i", "--info", action="store_true", help="Inspect file metadata without modifying")
    parser.add_argument("-p", "--port", type=int, default=8000, help="Web server port (default: 8000)")
    parser.add_argument("--no-xmp", action="store_true", help="Skip XMP metadata synchronization")

    args = parser.parse_args()

    if args.info:
        if not args.file:
            print("Error: --info requires a file path.")
            sys.exit(1)
        res = inspect_file(Path(args.file))
        for k, v in res.items():
            print(f"  {k:18}: {v}")
        sys.exit(0)

    if args.batch:
        folder = Path(args.batch)
        if not folder.is_dir():
            print(f"Error: Directory not found: {folder}")
            sys.exit(1)
        files = list(folder.rglob("*.ffx")) + list(folder.rglob("*.aep")) + list(folder.rglob("*.aet")) + list(folder.rglob("*.aepx"))
        if not files:
            print(f"No compatible After Effects files found in {folder}")
            sys.exit(0)
        print(f"Processing {len(files)} files -> Target: AE {args.target}...")
        success = 0
        for f in files:
            ok, msg = downgrade_file(f, target_year=args.target, deep_patch=not args.no_xmp)
            print(f"  [{'✓' if ok else '✗'}] {msg}")
            if ok:
                success += 1
        print(f"Done: {success}/{len(files)} files converted successfully.")
        sys.exit(0 if success == len(files) else 1)

    if args.file:
        out_path = Path(args.output) if args.output else None
        ok, msg = downgrade_file(Path(args.file), target_year=args.target, output_path=out_path, deep_patch=not args.no_xmp)
        print(f"[{'SUCCESS' if ok else 'ERROR'}] {msg}")
        sys.exit(0 if ok else 1)

    # Default action: start browser UI
    start_server(args.port)

if __name__ == "__main__":
    main()
