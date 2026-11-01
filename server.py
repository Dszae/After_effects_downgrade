#!/usr/bin/env python3
r"""
After Effects AEP & FFX Universal Downgrader
Local Web Server & CLI Downgrader Tool

Usage:
  1. Start Web Server:
       python server.py
       (Automatically launches the web interface in your default browser at http://localhost:8000)

  2. Command-Line Interface (CLI):
       python server.py input.ffx --target 2024
       python server.py project.aep --target 2024
       python server.py --batch "C:\MyPresets" --target 2024
"""

import sys
import os
import argparse
import webbrowser
import http.server
import socketserver
from pathlib import Path

VERSION_MAP = {
    2026: {'major': 26, 'byte': 0x61, 'label': 'AE 2026'},
    2025: {'major': 25, 'byte': 0x60, 'label': 'AE 2025'},
    2024: {'major': 24, 'byte': 0x5F, 'label': 'AE 2024'},
    2023: {'major': 23, 'byte': 0x5E, 'label': 'AE 2023'},
    2022: {'major': 22, 'byte': 0x5D, 'label': 'AE 2022'},
    2021: {'major': 18, 'byte': 0x5C, 'label': 'AE 2021'},
    2020: {'major': 17, 'byte': 0x5B, 'label': 'AE 2020'},
    2019: {'major': 16, 'byte': 0x5A, 'label': 'AE CC 2019'},
    2018: {'major': 15, 'byte': 0x59, 'label': 'AE CC 2018'}
}

def byte_to_year(b: int) -> int:
    if 0x50 <= b <= 0x75:
        return 2000 + (b - 0x5b + 20)
    return None

def downgrade_file(file_path: Path, target_year: int = 2024, output_path: Path = None) -> tuple[bool, str]:
    if not file_path.exists():
        return False, f"File not found: {file_path}"

    ext = file_path.suffix.lower()
    if ext not in ['.aep', '.ffx', '.aet', '.aepx']:
        return False, f"Unsupported file type: {ext}"

    if target_year not in VERSION_MAP:
        return False, f"Unsupported target year: {target_year}. Supported: {list(VERSION_MAP.keys())}"

    target_byte = VERSION_MAP[target_year]['byte']
    data = bytearray(file_path.read_bytes())

    if ext == '.aepx':
        # XML Project
        try:
            text = data.decode('utf-8', errors='replace')
            target_major = target_year - 2000
            import re
            text = re.sub(r'bva="[0-9\.]+"', f'bva="{target_major}.0"', text)
            text = re.sub(r'app_version="[0-9\.]+"', f'app_version="{target_major}.0"', text)
            for y in range(2028, target_year, -1):
                text = text.replace(f"Adobe After Effects {y}", f"Adobe After Effects {target_year}")
            out_data = text.encode('utf-8')
        except Exception as e:
            return False, f"Error processing AEPX: {e}"
    else:
        # Binary RIFX (.aep, .ffx, .aet)
        if data[:4] != b'RIFX':
            return False, "Not a valid After Effects file (missing RIFX header)"

        form_type = data[8:12]
        if ext == '.ffx' and form_type != b'FaFX':
            return False, f"Expected FaFX form in FFX preset, got: {form_type}"
        elif ext in ['.aep', '.aet'] and form_type != b'Egg!':
            return False, f"Expected Egg! form in AEP project, got: {form_type}"

        # Locate head chunk
        pos = 12
        head_pos = -1
        while pos + 8 <= min(len(data), 2048):
            cid = data[pos:pos+4]
            csize = int.from_bytes(data[pos+4:pos+8], 'big')
            if cid == b'head':
                head_pos = pos
                break
            pos += 8 + csize
            if pos % 2 == 1:
                pos += 1

        if head_pos == -1:
            head_pos = data.find(b'head')

        if head_pos == -1:
            return False, "Could not locate 'head' chunk in file"

        if ext == '.ffx':
            # In FFX, the full 16-byte head chunk is:
            # 00000003 000000<version> 00000001 01020000
            orig_byte = data[head_pos + 15]
            orig_yr = byte_to_year(orig_byte)
            # Patch entire 16 bytes of head data (pos+8 to pos+24) with standard AE schema version 1
            data[head_pos + 8:head_pos + 24] = bytes([
                0x00, 0x00, 0x00, 0x03,
                0x00, 0x00, 0x00, target_byte,
                0x00, 0x00, 0x00, 0x01,
                0x01, 0x02, 0x00, 0x00
            ])
        else:
            # In AEP, version is byte at head + 8 + 1 (head_data[1], byte 33)
            orig_byte = data[head_pos + 9]
            orig_yr = byte_to_year(orig_byte)
            data[head_pos + 9] = target_byte

        # Deep patch XMP metadata
        raw_text = bytes(data)
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
        # Ensure head byte is preserved
        if ext == '.ffx':
            out_data[head_pos + 8:head_pos + 24] = bytes([
                0x00, 0x00, 0x00, 0x03,
                0x00, 0x00, 0x00, target_byte,
                0x00, 0x00, 0x00, 0x01,
                0x01, 0x02, 0x00, 0x00
            ])
        else:
            out_data[head_pos + 9] = target_byte

    if output_path is None:
        stem = file_path.stem
        output_path = file_path.with_name(f"{stem}_AE{target_year}{ext}")

    output_path.write_bytes(out_data)
    orig_str = f"AE {orig_yr}" if 'orig_yr' in locals() and orig_yr else "Unknown"
    return True, f"Successfully downgraded {file_path.name} ({orig_str} -> AE {target_year}) -> {output_path.name}"

def start_server(port: int = 8000):
    web_dir = Path(__file__).resolve().parent
    os.chdir(web_dir)

    class CustomHandler(http.server.SimpleHTTPRequestHandler):
        def end_headers(self):
            # Avoid aggressive caching during local development
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
            super().end_headers()

    with socketserver.TCPServer(("", port), CustomHandler) as httpd:
        url = f"http://localhost:{port}"
        print("=" * 65)
        print(f"  After Effects AEP & FFX Universal Downgrader")
        print(f"  Server running at: {url}")
        print("=" * 65)
        print("  Press Ctrl+C to stop the server.")
        webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

def main():
    parser = argparse.ArgumentParser(description="After Effects AEP & FFX Downgrader")
    parser.add_argument("file", nargs="?", help="AEP or FFX file to downgrade")
    parser.add_argument("--target", type=int, default=2024, help="Target AE Year (e.g. 2024, 2023, 2022)")
    parser.add_argument("--batch", type=str, help="Directory of presets/projects to downgrade in batch")
    parser.add_argument("--port", type=int, default=8000, help="Web server port (default 8000)")
    parser.add_argument("--cli", action="store_true", help="Force CLI mode")

    args = parser.parse_args()

    if args.batch:
        folder = Path(args.batch)
        if not folder.is_dir():
            print(f"Error: Directory not found: {folder}")
            sys.exit(1)
        files = list(folder.rglob("*.ffx")) + list(folder.rglob("*.aep"))
        print(f"Found {len(files)} files to downgrade to AE {args.target}...")
        success = 0
        for f in files:
            ok, msg = downgrade_file(f, args.target)
            print(f"  [{'✓' if ok else '✗'}] {msg}")
            if ok: success += 1
        print(f"Done! {success}/{len(files)} files downgraded successfully.")
    elif args.file:
        ok, msg = downgrade_file(Path(args.file), args.target)
        print(f"[{'SUCCESS' if ok else 'ERROR'}] {msg}")
    else:
        # Default: Launch web server and browser
        start_server(args.port)

if __name__ == "__main__":
    main()
