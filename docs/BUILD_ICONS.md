# Icon Generation for Klever Desktop

## Quick Start

### macOS
Generate `icon.icns` from `icon.png`:

```bash
./scripts/generate-icons.sh
```

This will create `build/icon.icns` required for macOS builds.

### Windows
Generate `icon.ico` from `icon.png`:

```powershell
.\scripts\generate-icons.ps1
```

This will create `build/icon.ico` required for Windows builds.

---

## Why Generate Icons?

- **macOS builds** require `.icns` format
- **Windows builds** require `.ico` format
- **Linux builds** use `.png` directly

Electron Forge (configured in `forge.config.js`) automatically uses the correct format:
```javascript
icon: './build/icon'  // → icon.icns (macOS), icon.ico (Windows), icon.png (Linux)
```

---

## Alternative Methods

### Online Converters
- **macOS (.icns)**: https://cloudconvert.com/png-to-icns
- **Windows (.ico)**: https://cloudconvert.com/png-to-ico

Upload `build/icon.png` and download the converted file.

### Using npm package
```bash
npm install -g png2icons
png2icons build/icon.png build/
```
Generates both .icns and .ico files.

---

## Icon Requirements

### Source Image (icon.png)
- **Format**: PNG with transparency
- **Size**: At least 1024x1024px (current: 1024x1024)
- **Color Space**: sRGB
- **Bit Depth**: 32-bit (RGBA)

### macOS (.icns)
Must contain sizes: 16x16, 32x32, 128x128, 256x256, 512x512 (all 1x and 2x)

### Windows (.ico)
Recommended sizes: 16x16, 32x32, 48x48, 64x64, 128x128, 256x256

---

## File Structure

```
build/
├── icon.png                           # Source (committed)
├── icon.icns                          # macOS (to be generated and committed)
├── icon.ico                           # Windows (optional, auto-generated)
├── appxmanifest.xml                   # Windows Store manifest
├── entitlements.mas.plist             # Mac App Store entitlements
└── entitlements.mas.inherit.plist     # Child process entitlements
```

---

## Icon Generation Methods

### macOS (.icns)
**Method 1: Built-in script (Recommended)**
```bash
./scripts/generate-icons.sh
```
Uses macOS-native `iconutil` and `sips`.

**Method 2: ImageMagick**
```bash
brew install imagemagick
magick convert build/icon.png -define icon:auto-resize=1024,512,256,128,32,16 build/icon.icns
```

### Windows (.ico)
**Method 1: PowerShell script (Recommended)**
```powershell
.\scripts\generate-icons.ps1
```
Tries ImageMagick first, falls back to .NET System.Drawing.

**Method 2: ImageMagick**
```powershell
# Install via winget
winget install ImageMagick.ImageMagick

# Generate icon
magick convert build/icon.png -define icon:auto-resize=256,128,64,48,32,16 build/icon.ico
```

**Method 3: .NET only (no external dependencies)**
The PowerShell script automatically falls back to .NET if ImageMagick is not available.

---

## Next Steps

1. **macOS users**: Run `./scripts/generate-icons.sh` → commit `icon.icns`
2. **Windows users**: Run `.\scripts\generate-icons.ps1` → commit `icon.ico`
3. Icons will be automatically used during builds

**Note**: Once icons are committed, you won't need to regenerate them unless you update the source `icon.png`.
