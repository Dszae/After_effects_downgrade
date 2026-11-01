import os

input_file = "pixel.ffx"
output_file = "pixel_2024.ffx"

try:
    with open(input_file, "rb") as f:
        data = f.read()

    # The version string appears twice in the XMP metadata of an FFX file
    target = b"Adobe After Effects 2026"
    replacement = b"Adobe After Effects 2024"

    if target in data:
        new_data = data.replace(target, replacement)
        
        with open(output_file, "wb") as f:
            f.write(new_data)
        print(f"Success! Downgraded preset saved as '{output_file}'.")
        print("You can now apply this from the Animation > Apply Animation Preset... menu in AE 2024.")
    else:
        print(f"Error: Could not find '{target.decode()}' in the file.")
        print("Ensure 'pixel.ffx' is the original, unmodified file created in AE 2026.")

except FileNotFoundError:
    print(f"Error: Could not find '{input_file}' in the current directory.")
    print(f"Make sure this script and '{input_file}' are in the same folder.")
except Exception as e:
    print(f"An unexpected error occurred: {e}")
