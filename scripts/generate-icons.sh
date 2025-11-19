#!/bin/bash

# =================================================================
# Klever Desktop - Icon Generation Script
# Generates .icns file from PNG for macOS App Store builds
# =================================================================

set -e

echo "🎨 Generating macOS icon files..."

# --- Configuration ---
SOURCE_ICON="build/icon.png"
ICONSET_DIR="build/icon.iconset"
OUTPUT_ICON="build/icon.icns"

# --- Validation ---
if [ ! -f "$SOURCE_ICON" ]; then
    echo "❌ Error: Source icon not found at $SOURCE_ICON"
    exit 1
fi

# Check if we're on macOS (iconutil is macOS-only)
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "⚠️  Warning: This script requires macOS to generate .icns files"
    echo "   Current OS: $OSTYPE"
    echo ""
    echo "   Alternative solutions:"
    echo "   1. Run this script on a Mac"
    echo "   2. Use online converter: https://cloudconvert.com/png-to-icns"
    echo "   3. Use npm package: npm install -g png2icons"
    exit 1
fi

# Check if sips is available (should be on all macOS)
if ! command -v sips &> /dev/null; then
    echo "❌ Error: 'sips' command not found (required on macOS)"
    exit 1
fi

# Check if iconutil is available
if ! command -v iconutil &> /dev/null; then
    echo "❌ Error: 'iconutil' command not found (required on macOS)"
    exit 1
fi

# --- Step 1: Create iconset directory ---
echo "📁 Creating iconset directory..."
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

# --- Step 2: Generate all required icon sizes ---
echo "🔧 Generating icon sizes..."

# macOS icon sizes and their requirements
# Format: size@scale (e.g., 16x16, 16x16@2x, etc.)
SIZES=(
    "16:icon_16x16.png"
    "32:icon_16x16@2x.png"
    "32:icon_32x32.png"
    "64:icon_32x32@2x.png"
    "128:icon_128x128.png"
    "256:icon_128x128@2x.png"
    "256:icon_256x256.png"
    "512:icon_256x256@2x.png"
    "512:icon_512x512.png"
    "1024:icon_512x512@2x.png"
)

for size_info in "${SIZES[@]}"; do
    size="${size_info%%:*}"
    filename="${size_info##*:}"

    echo "   📐 Generating ${size}x${size} → ${filename}"
    sips -z "$size" "$size" "$SOURCE_ICON" --out "$ICONSET_DIR/$filename" > /dev/null 2>&1
done

echo "✅ All icon sizes generated"

# --- Step 3: Convert iconset to icns ---
echo "🔄 Converting iconset to .icns..."
iconutil -c icns "$ICONSET_DIR" -o "$OUTPUT_ICON"

if [ -f "$OUTPUT_ICON" ]; then
    ICNS_SIZE=$(du -h "$OUTPUT_ICON" | cut -f1)
    echo "✅ Icon file created: $OUTPUT_ICON ($ICNS_SIZE)"
else
    echo "❌ Error: Failed to create .icns file"
    exit 1
fi

# --- Step 4: Cleanup ---
echo "🧹 Cleaning up temporary files..."
rm -rf "$ICONSET_DIR"

# --- Verification ---
echo "🔍 Verifying icon file..."
if file "$OUTPUT_ICON" | grep -q "Mac OS X icon"; then
    echo "✅ Icon file format verified"
else
    echo "⚠️  Warning: Icon file format could not be verified"
fi

# --- Summary ---
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "🎯 ICON GENERATION SUMMARY"
echo "═══════════════════════════════════════════════════════════════"
echo "📂 Source: $SOURCE_ICON"
echo "✅ Output: $OUTPUT_ICON ($ICNS_SIZE)"
echo "📋 Sizes: 10 icon sizes generated (16px to 1024px)"
echo ""
echo "🚀 Next Steps:"
echo "   1. Verify icon looks correct: open $OUTPUT_ICON"
echo "   2. Run your App Store build: ./scripts/build-appstore.sh"
echo "═══════════════════════════════════════════════════════════════"
