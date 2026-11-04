#!/usr/bin/env python3
"""
Unit and regression tests for After Effects AEP & FFX Downgrader.
"""

import unittest
import tempfile
import os
from pathlib import Path
from server import (
    downgrade_file,
    inspect_file,
    byte_to_year,
    VERSION_MAP
)

class TestAfterEffectsDowngrader(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.dir_path = Path(self.temp_dir.name)

    def tearDown(self):
        self.temp_dir.cleanup()

    def create_dummy_ffx(self, version_byte=0x61, schema_byte=0x05):
        """Build a synthetically valid minimal RIFX FaFX preset container."""
        head_data = bytes([
            0x00, 0x00, 0x00, 0x03,
            0x00, 0x00, 0x00, version_byte,
            0x00, 0x00, 0x00, schema_byte,
            0x00, 0x00, 0x00, 0x00
        ])
        head_chunk = b'head' + len(head_data).to_bytes(4, 'big') + head_data
        list_data = b'bescbeso' + bytes(48)
        list_chunk = b'LIST' + len(list_data).to_bytes(4, 'big') + list_data
        content = head_chunk + list_chunk
        rifx_size = 4 + len(content) # Form type 'FaFX' (4) + chunks
        header = b'RIFX' + rifx_size.to_bytes(4, 'big') + b'FaFX'
        xmp = b'<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>\n<xmp:CreatorTool>Adobe After Effects 2026</xmp:CreatorTool>'
        return header + content + xmp

    def create_dummy_aep(self, major_byte=0x61):
        """Build a synthetically valid minimal RIFX Egg! project container."""
        # head data 20 bytes: 00 <ver> 00 00 ...
        head_data = bytes([0x00, major_byte]) + bytes(18)
        svap_chunk = b'svap' + (4).to_bytes(4, 'big') + bytes(4)
        head_chunk = b'head' + (20).to_bytes(4, 'big') + head_data
        content = svap_chunk + head_chunk
        rifx_size = 4 + len(content)
        header = b'RIFX' + rifx_size.to_bytes(4, 'big') + b'Egg!'
        xmp = b'<xmp:CreatorTool>Adobe After Effects 2026</xmp:CreatorTool>'
        return header + content + xmp

    def test_version_mapping(self):
        """Verify mathematical bijection between version byte and AE release year."""
        self.assertEqual(byte_to_year(0x61), 2026)
        self.assertEqual(byte_to_year(0x60), 2025)
        self.assertEqual(byte_to_year(0x5F), 2024)
        self.assertEqual(byte_to_year(0x5E), 2023)
        self.assertEqual(byte_to_year(0x5D), 2022)
        self.assertEqual(byte_to_year(0x5C), 2021)
        self.assertEqual(byte_to_year(0x5B), 2020)

    def test_inspect_ffx(self):
        """Verify diagnostic inspection of .ffx presets."""
        sample_path = self.dir_path / "test.ffx"
        sample_path.write_bytes(self.create_dummy_ffx(version_byte=0x61))

        res = inspect_file(sample_path)
        self.assertTrue(res['valid'])
        self.assertEqual(res['detected_year'], 2026)
        self.assertIn("FaFX", res['container'])

    def test_inspect_aep(self):
        """Verify diagnostic inspection of .aep projects."""
        sample_path = self.dir_path / "test.aep"
        sample_path.write_bytes(self.create_dummy_aep(major_byte=0x60))

        res = inspect_file(sample_path)
        self.assertTrue(res['valid'])
        self.assertEqual(res['detected_year'], 2025)
        self.assertIn("Egg!", res['container'])

    def test_downgrade_ffx(self):
        """Verify FFX conversion rewrites both version byte, schema version (0x01), and XMP."""
        source_path = self.dir_path / "source.ffx"
        out_path = self.dir_path / "out_2024.ffx"
        source_path.write_bytes(self.create_dummy_ffx(version_byte=0x61, schema_byte=0x05))

        ok, msg = downgrade_file(source_path, target_year=2024, output_path=out_path)
        self.assertTrue(ok)
        self.assertTrue(out_path.exists())

        out_data = out_path.read_bytes()
        # Byte 27 (head version) must be 0x5F
        self.assertEqual(out_data[27], 0x5F)
        # Byte 28..31 (head schema) must be 0x01
        self.assertEqual(int.from_bytes(out_data[28:32], 'big'), 1)
        # XMP string replaced
        self.assertIn(b"Adobe After Effects 2024", out_data)
        self.assertNotIn(b"Adobe After Effects 2026", out_data)

    def test_downgrade_aep(self):
        """Verify AEP conversion rewrites head_data[1] at offset 33."""
        source_path = self.dir_path / "project.aep"
        out_path = self.dir_path / "project_2023.aep"
        source_path.write_bytes(self.create_dummy_aep(major_byte=0x61))

        ok, msg = downgrade_file(source_path, target_year=2023, output_path=out_path)
        self.assertTrue(ok)
        self.assertTrue(out_path.exists())

        out_data = out_path.read_bytes()
        self.assertEqual(out_data[33], 0x5E) # 0x5E = AE 2023

    def test_malformed_files(self):
        """Verify error handling on corrupt or non-RIFX files."""
        corrupt_path = self.dir_path / "corrupt.ffx"
        corrupt_path.write_bytes(b"NOT_A_RIFX_FILE_1234567890")

        ok, msg = downgrade_file(corrupt_path, target_year=2024)
        self.assertFalse(ok)
        self.assertIn("Not a valid After Effects binary file", msg)

        # Truncated RIFX
        trunc_path = self.dir_path / "truncated.aep"
        trunc_path.write_bytes(b"RIFX\x00\x00\x00\x08Egg!")
        ok, msg = downgrade_file(trunc_path, target_year=2024)
        self.assertFalse(ok)

    def test_canonical_pixel_ffx(self):
        """Test conversion on real sample preset if available."""
        real_sample = Path(__file__).resolve().parent.parent / "samples" / "pixel_source_2026.ffx"
        if real_sample.exists():
            out_target = self.dir_path / "real_pixel_2024.ffx"
            ok, msg = downgrade_file(real_sample, target_year=2024, output_path=out_target)
            self.assertTrue(ok)
            out_bytes = out_target.read_bytes()
            self.assertEqual(out_bytes[27], 0x5F)
            self.assertEqual(out_bytes[20:36].hex(), "000000030000005f0000000101020000")

if __name__ == '__main__':
    unittest.main()
