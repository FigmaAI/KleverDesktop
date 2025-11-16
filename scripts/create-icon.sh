#!/bin/bash

# =================================================================
# Klever Desktop - ICNS Icon Generator
# Converts PNG to ICNS format for Mac App Store
# Must be run on macOS
# =================================================================

set -e

echo "🎨 Creating ICNS icon for Mac App Store..."

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ Error: This script must be run on macOS"
    echo "   Required tools: sips, iconutil (macOS only)"
    exit 1
fi

# Check if build/icon.png exists
if [ ! -f "build/icon.png" ]; then
    echo "❌ Error: build/icon.png not found"
    echo "   Please ensure build/icon.png exists before running this script"
    exit 1
fi

cd build

# Create iconset directory
echo "📁 Creating iconset directory..."
mkdir -p icon.iconset

# Generate various icon sizes
echo "🔧 Generating icon sizes..."
sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png
sips -z 512 512 icon.png --out icon.iconset/icon_512x512.png
sips -z 512 512 icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 256 256 icon.png --out icon.iconset/icon_256x256.png
sips -z 256 256 icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 128 128 icon.png --out icon.iconset/icon_128x128.png

# Create ICNS file
echo "📦 Creating ICNS file..."
iconutil -c icns icon.iconset -o icon.icns

# Verify ICNS was created
if [ -f "icon.icns" ]; then
    ICNS_SIZE=$(du -h icon.icns | cut -f1)
    echo "✅ icon.icns created successfully ($ICNS_SIZE)"
else
    echo "❌ Error: Failed to create icon.icns"
    exit 1
fi

# Cleanup
echo "🧹 Cleaning up..."
rm -rf icon.iconset

echo ""
echo "═══════════════════════════════════════════"
echo "🎉 Icon creation completed!"
echo "═══════════════════════════════════════════"
echo "📁 Output: build/icon.icns"
echo "📊 Size: $ICNS_SIZE"
echo ""
echo "✅ You can now build for Mac App Store"
echo "   The icon.icns file is ready for use"
echo "═══════════════════════════════════════════"
