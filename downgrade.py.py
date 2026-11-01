import os

input_file = "pixel.ffx"
output_file = "pixel_2024.ffx"

# Read the original binary file
with open(input_file, "rb") as f:
    data = f.read()

# Replace the specific version string in bytes
target = b"Adobe After Effects 2026"
replacement = b"Adobe After Effects 2024"

if target in data:
    new_data = data.replace(target, replacement)
    
    # Write the preserved binary structure to a new file
    with open(output_file, "wb") as f:
        f.write(new_data)
    print(f"Success! Saved as {output_file}")
else:
    print("Version string not found. Ensure this is the original 2026 file.")