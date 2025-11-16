#!/bin/bash

# =================================================================
# Klever Desktop - Mac DMG Build Script (Electron)
# Creates standard Mac DMG and ZIP for distribution outside App Store
# Includes code signing and notarization
# =================================================================

set -e # Exit immediately if a command exits with a non-zero status

echo "🚀 Starting Klever Desktop Mac DMG build process..."

# --- Configuration ---
APP_NAME="Klever Desktop"
BUNDLE_ID="com.klever.desktop"
BUILD_DIR="dist-electron"
USE_ENVIRONMENT_VERSION="${USE_ENVIRONMENT_VERSION:-false}"

# --- Check Node.js and dependencies ---
echo "🔍 Checking build environment..."

if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo "   Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js 18+ is required (current: $(node -v))"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

if ! command -v yarn &> /dev/null; then
    echo "❌ Error: Yarn is not installed"
    echo "   Please install Yarn: npm install -g yarn"
    exit 1
fi

echo "✅ Yarn $(yarn -v) detected"

# --- Environment Variables Configuration ---
echo ""
echo "🔍 Checking environment variables..."

# Apple Developer Configuration (optional for DMG, required for notarization)
if [ -z "$APPLE_ID" ]; then
    echo "⚠️  APPLE_ID not set (required for notarization)"
    echo "   Notarization will be skipped"
else
    echo "✅ APPLE_ID set: $APPLE_ID"
fi

if [ -z "$APPLE_APP_SPECIFIC_PASSWORD" ]; then
    echo "⚠️  APPLE_APP_SPECIFIC_PASSWORD not set (required for notarization)"
    echo "   Notarization will be skipped"
else
    echo "✅ APPLE_APP_SPECIFIC_PASSWORD set"
fi

if [ -z "$APPLE_TEAM_ID" ]; then
    echo "⚠️  APPLE_TEAM_ID not set"
else
    echo "✅ APPLE_TEAM_ID set: $APPLE_TEAM_ID"
fi

# Code Signing Identity (optional for DMG)
if [ -z "$CSC_NAME" ]; then
    echo "⚠️  CSC_NAME not set"
    echo "   Build will be unsigned (not recommended for distribution)"
    echo "   Example: export CSC_NAME=\"Developer ID Application: Your Name (TEAM_ID)\""
else
    echo "✅ Code Sign Identity set: $CSC_NAME"
fi

echo ""

# --- Version Configuration ---
echo "📋 Setting up version information..."

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")

if [ "$USE_ENVIRONMENT_VERSION" = "true" ]; then
    if [ -z "$APP_VERSION" ]; then
        echo "❌ Error: USE_ENVIRONMENT_VERSION is true but APP_VERSION is not set"
        exit 1
    fi
    echo "✅ Using version from environment: $APP_VERSION"
else
    APP_VERSION="$CURRENT_VERSION"
    echo "✅ Using version from package.json: $APP_VERSION"
fi

echo ""
echo "📋 Build configuration:"
echo "   - App Name: $APP_NAME"
echo "   - Bundle ID: $BUNDLE_ID"
echo "   - Version: $APP_VERSION"
echo "   - Build Dir: $BUILD_DIR"
echo "   - Code Signing: $([ -n "$CSC_NAME" ] && echo "Enabled" || echo "Disabled")"
echo "   - Notarization: $([ -n "$APPLE_ID" ] && [ -n "$APPLE_APP_SPECIFIC_PASSWORD" ] && echo "Enabled" || echo "Disabled")"
echo ""

# --- Step 1: Install dependencies ---
echo "📦 [Step 1/5] Installing dependencies..."
yarn install --frozen-lockfile
echo "✅ Dependencies installed"

# --- Step 2: Build the application ---
echo "🔨 [Step 2/5] Building Klever Desktop..."

# Clean previous builds
if [ -d "$BUILD_DIR" ]; then
    echo "   🧹 Cleaning previous build..."
    rm -rf "$BUILD_DIR"
fi

# Build main process
echo "   🔧 Building main process..."
yarn build:main

# Build renderer process
echo "   🎨 Building renderer process..."
yarn build:renderer

echo "✅ Application built successfully"

# --- Step 3: Package for Mac ---
echo "📦 [Step 3/5] Packaging for Mac..."

# Set environment variables for electron-builder
export ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES=true

# Build for Mac (DMG and ZIP)
echo "   🍎 Creating Mac DMG and ZIP..."

yarn run electron-builder --mac --config.mac.target=dmg --config.mac.target=zip \
    --config.appId="$BUNDLE_ID" \
    --config.productName="$APP_NAME" \
    --config.mac.category="public.app-category.developer-tools" \
    --config.directories.output="$BUILD_DIR"

echo "✅ Mac packages created"

# --- Step 4: Verify the build ---
echo "🔍 [Step 4/5] Verifying build..."

DMG_PATH="$BUILD_DIR/$APP_NAME-$APP_VERSION.dmg"
ZIP_PATH="$BUILD_DIR/$APP_NAME-$APP_VERSION-mac.zip"

if [ -f "$DMG_PATH" ]; then
    DMG_SIZE=$(du -h "$DMG_PATH" | cut -f1)
    echo "✅ DMG file found: $DMG_PATH ($DMG_SIZE)"
else
    echo "⚠️  DMG file not found at expected location: $DMG_PATH"
    # List actual DMG files
    find "$BUILD_DIR" -name "*.dmg" 2>/dev/null | while read dmg; do
        echo "   Found: $dmg"
    done
fi

if [ -f "$ZIP_PATH" ]; then
    ZIP_SIZE=$(du -h "$ZIP_PATH" | cut -f1)
    echo "✅ ZIP file found: $ZIP_PATH ($ZIP_SIZE)"
else
    echo "⚠️  ZIP file not found at expected location: $ZIP_PATH"
    # List actual ZIP files
    find "$BUILD_DIR" -name "*.zip" 2>/dev/null | while read zip; do
        echo "   Found: $zip"
    done
fi

# Verify code signature if app was signed
APP_PATH="$BUILD_DIR/mac/$APP_NAME.app"
if [ -d "$APP_PATH" ] && [ -n "$CSC_NAME" ]; then
    echo "   📝 Verifying code signature..."
    codesign --verify --verbose "$APP_PATH" && echo "   ✅ Code signature valid" || echo "   ⚠️  Code signature verification failed"

    # Check notarization status
    spctl -a -vvv -t install "$APP_PATH" && echo "   ✅ Gatekeeper approved" || echo "   ⚠️  Not notarized or Gatekeeper check failed"
else
    echo "   ⚠️  App bundle not found or not signed, skipping signature verification"
fi

echo "✅ Build verification completed"

# --- Step 5: Notarization (Optional) ---
echo ""
echo "📤 [Step 5/5] Notarization..."

if [ -n "$APPLE_ID" ] && [ -n "$APPLE_APP_SPECIFIC_PASSWORD" ] && [ -n "$APPLE_TEAM_ID" ]; then
    echo "   🔐 Notarization is handled automatically by electron-builder"
    echo "   Check the build logs above for notarization status"

    # If electron-builder notarization fails, you can manually notarize with:
    # xcrun notarytool submit "$DMG_PATH" --apple-id "$APPLE_ID" --password "$APPLE_APP_SPECIFIC_PASSWORD" --team-id "$APPLE_TEAM_ID" --wait
else
    echo "   ⚠️  Notarization not configured"
    echo "   To enable notarization, set:"
    echo "     export APPLE_ID=\"your-apple-id@email.com\""
    echo "     export APPLE_APP_SPECIFIC_PASSWORD=\"xxxx-xxxx-xxxx-xxxx\""
    echo "     export APPLE_TEAM_ID=\"YOUR_TEAM_ID\""
fi

# --- Summary ---
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "🎯 BUILD SUMMARY - Klever Desktop"
echo "═══════════════════════════════════════════════════════════════"
echo "📱 App Name: $APP_NAME"
echo "📦 Version: $APP_VERSION"
echo "🆔 Bundle ID: $BUNDLE_ID"
echo "📂 Build Output: $BUILD_DIR/"
echo ""
echo "📦 Build Artifacts:"
if [ -f "$DMG_PATH" ]; then
    echo "   ✅ DMG: $(basename "$DMG_PATH") ($DMG_SIZE)"
else
    # Try to find any DMG
    ACTUAL_DMG=$(find "$BUILD_DIR" -name "*.dmg" 2>/dev/null | head -1)
    if [ -n "$ACTUAL_DMG" ]; then
        echo "   ✅ DMG: $(basename "$ACTUAL_DMG") ($(du -h "$ACTUAL_DMG" | cut -f1))"
    else
        echo "   ❌ DMG: Not found"
    fi
fi
if [ -f "$ZIP_PATH" ]; then
    echo "   ✅ ZIP: $(basename "$ZIP_PATH") ($ZIP_SIZE)"
else
    # Try to find any ZIP
    ACTUAL_ZIP=$(find "$BUILD_DIR" -name "*.zip" 2>/dev/null | head -1)
    if [ -n "$ACTUAL_ZIP" ]; then
        echo "   ✅ ZIP: $(basename "$ACTUAL_ZIP") ($(du -h "$ACTUAL_ZIP" | cut -f1))"
    else
        echo "   ❌ ZIP: Not found"
    fi
fi
echo ""
echo "🚀 Next Steps:"
echo "   1. Test the DMG file on a clean Mac"
echo "   2. Verify the app launches correctly"
echo "   3. Distribute via:"
echo "      - Direct download from your website"
echo "      - GitHub Releases"
echo "      - Other distribution channels"
echo ""
echo "📚 Documentation:"
echo "   - Electron Builder: https://www.electron.build/configuration/mac"
echo "   - Code Signing: https://www.electron.build/code-signing"
echo "   - Notarization: https://www.electron.build/configuration/mac#notarization"
echo "═══════════════════════════════════════════════════════════════"
