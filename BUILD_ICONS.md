# Icon Generation for Klever Desktop

## Quick Start (macOS only)

Generate `icon.icns` from `icon.png`:

```bash
./scripts/generate-icons.sh
```

This will create `build/icon.icns` required for macOS builds.

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

## Alternative Methods (if not on macOS)

### Option 1: Online Converter
1. Visit https://cloudconvert.com/png-to-icns
2. Upload `build/icon.png`
3. Download and save as `build/icon.icns`

### Option 2: Using npm package
```bash
npm install -g png2icons
png2icons build/icon.png build/
```

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

## Next Steps

1. Generate icon.icns on macOS: `./scripts/generate-icons.sh`
2. Commit the generated icon.icns to git
3. Icons will be automatically used during builds

**Note**: Once icon.icns is committed, you won't need to regenerate it unless you update the source icon.png.
