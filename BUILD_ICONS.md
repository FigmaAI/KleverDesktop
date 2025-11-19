# Icon Generation for macOS App Store

## Problem

Mac App Store builds require `.icns` icon format, but the project currently only has `build/icon.png`. This causes build failures during App Store upload with icon-related errors.

## Solution

### Automatic (Recommended)

The `build-appstore.sh` script now automatically generates `icon.icns` from `icon.png` before building.

Just run:
```bash
./scripts/build-appstore.sh
```

### Manual Generation

If you need to generate icons manually:

#### Option 1: Using the included script (macOS only)
```bash
./scripts/generate-icons.sh
```

This will:
- Create an iconset with all required sizes (16px to 1024px)
- Convert it to `build/icon.icns`
- Clean up temporary files

#### Option 2: Using online converter
1. Visit https://cloudconvert.com/png-to-icns
2. Upload `build/icon.png`
3. Download the generated `.icns` file
4. Save it as `build/icon.icns`

#### Option 3: Using npm package
```bash
npm install -g png2icons
png2icons build/icon.png build/
```

#### Option 4: Using macOS native tools
```bash
# Create iconset directory
mkdir build/icon.iconset

# Generate all required sizes
sips -z 16 16     build/icon.png --out build/icon.iconset/icon_16x16.png
sips -z 32 32     build/icon.png --out build/icon.iconset/icon_16x16@2x.png
sips -z 32 32     build/icon.png --out build/icon.iconset/icon_32x32.png
sips -z 64 64     build/icon.png --out build/icon.iconset/icon_32x32@2x.png
sips -z 128 128   build/icon.png --out build/icon.iconset/icon_128x128.png
sips -z 256 256   build/icon.png --out build/icon.iconset/icon_128x128@2x.png
sips -z 256 256   build/icon.png --out build/icon.iconset/icon_256x256.png
sips -z 512 512   build/icon.png --out build/icon.iconset/icon_256x256@2x.png
sips -z 512 512   build/icon.png --out build/icon.iconset/icon_512x512.png
sips -z 1024 1024 build/icon.png --out build/icon.iconset/icon_512x512@2x.png

# Convert to icns
iconutil -c icns build/icon.iconset -o build/icon.icns

# Cleanup
rm -rf build/icon.iconset
```

## Icon Requirements

### macOS (.icns)
The `.icns` file must contain the following sizes:
- 16x16 (1x and 2x)
- 32x32 (1x and 2x)
- 128x128 (1x and 2x)
- 256x256 (1x and 2x)
- 512x512 (1x and 2x)

### Source Icon Recommendations
- **Format**: PNG with transparency
- **Size**: At least 1024x1024px
- **Color Space**: sRGB
- **Bit Depth**: 32-bit (RGBA)

## Verification

After generating the icon, verify it:
```bash
# Check file type
file build/icon.icns
# Should output: build/icon.icns: Mac OS X icon, ...

# Preview the icon
open build/icon.icns
```

## Troubleshooting

### "icon.icns not found" error
Run `./scripts/generate-icons.sh` or use one of the manual methods above.

### "This script requires macOS" error
If you're not on macOS:
1. Use the online converter (Option 2)
2. Use the npm package (Option 3)
3. Generate on a Mac and commit the `.icns` file to git

### Icon looks blurry
Your source `build/icon.png` should be at least 1024x1024px. Regenerate with a higher resolution source image.

## Files Structure

```
build/
├── icon.png                 # Source icon (256KB PNG)
├── icon.icns               # Generated macOS icon (auto-generated)
├── entitlements.mas.plist  # App Store entitlements
└── entitlements.mas.inherit.plist
```

## References

- [Apple Icon Design Guidelines](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- [iconutil man page](https://ss64.com/osx/iconutil.html)
- [Electron Builder - macOS](https://www.electron.build/configuration/mac)
