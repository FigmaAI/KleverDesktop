#!/bin/bash

# =================================================================
# Klever Desktop - Mac App Store Build Script (Electron)
# Creates Mac App Store build and pkg file for submission
# Supports automatic upload to App Store Connect
# =================================================================

set -e # Exit immediately if a command exits with a non-zero status

echo "🚀 Starting Klever Desktop Mac App Store build process..."

# --- Configuration ---
APP_NAME="Klever Desktop"
BUNDLE_ID="com.klever.desktop"
BUILD_DIR="dist-electron"
USE_ENVIRONMENT_VERSION="${USE_ENVIRONMENT_VERSION:-false}"
AUTO_UPLOAD="${AUTO_UPLOAD:-false}"  # Set to 'true' to automatically upload to App Store Connect

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

# Apple Developer Configuration
if [ -z "$APPLE_ID" ]; then
    echo "⚠️  APPLE_ID not set (required for notarization)"
    echo "   To enable automatic notarization, set:"
    echo "   export APPLE_ID=\"your-apple-id@email.com\""
fi

if [ -z "$APPLE_APP_SPECIFIC_PASSWORD" ]; then
    echo "⚠️  APPLE_APP_SPECIFIC_PASSWORD not set (required for notarization)"
    echo "   Generate at: https://appleid.apple.com/account/manage"
fi

if [ -z "$APPLE_TEAM_ID" ]; then
    echo "⚠️  APPLE_TEAM_ID not set"
    echo "   Find at: https://developer.apple.com/account/#!/membership"
fi

# Code Signing Identity
if [ -z "$CSC_NAME" ]; then
    echo "⚠️  CSC_NAME not set"
    echo "   This should be your '3rd Party Mac Developer Application' certificate name"
    echo "   Example: export CSC_NAME=\"3rd Party Mac Developer Application: Your Name (TEAM_ID)\""
    echo ""
    echo "   Available signing identities:"
    security find-identity -v -p codesigning | grep "3rd Party Mac Developer Application" || echo "   No 3rd Party Mac Developer Application certificates found"
    echo ""
fi

if [ -z "$CSC_INSTALLER_NAME" ]; then
    echo "⚠️  CSC_INSTALLER_NAME not set"
    echo "   This should be your '3rd Party Mac Developer Installer' certificate name"
    echo "   Example: export CSC_INSTALLER_NAME=\"3rd Party Mac Developer Installer: Your Name (TEAM_ID)\""
fi

# Show configuration summary
echo ""
echo "📋 Environment Variables Summary:"
echo "   - Apple ID: ${APPLE_ID:-❌ Not set}"
echo "   - Apple Team ID: ${APPLE_TEAM_ID:-❌ Not set}"
echo "   - App Specific Password: $([ -n "$APPLE_APP_SPECIFIC_PASSWORD" ] && echo "✅ Set" || echo "❌ Not set")"
echo "   - Code Sign Identity: ${CSC_NAME:-❌ Not set}"
echo "   - Installer Identity: ${CSC_INSTALLER_NAME:-❌ Not set}"
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
echo "   - Auto Upload: $([ "$AUTO_UPLOAD" = "true" ] && echo "✅ Enabled" || echo "⏭️  Disabled (use AUTO_UPLOAD=true to enable)")"
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

# --- Step 3: Package for Mac App Store ---
echo "📦 [Step 3/5] Packaging for Mac App Store..."

# Set environment variables for electron-builder
export ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES=true

# Build for Mac App Store
echo "   🍎 Creating Mac App Store build..."

# electron-builder command for mas (Mac App Store)
yarn run electron-builder --mac mas --config.mac.target=mas \
    --config.appId="$BUNDLE_ID" \
    --config.productName="$APP_NAME" \
    --config.mac.category="public.app-category.developer-tools" \
    --config.directories.output="$BUILD_DIR"

echo "✅ Mac App Store package created"

# --- Step 4: Verify the build ---
echo "🔍 [Step 4/5] Verifying build..."

PKG_PATH="$BUILD_DIR/mas/$APP_NAME-$APP_VERSION.pkg"
if [ -f "$PKG_PATH" ]; then
    PKG_SIZE=$(du -h "$PKG_PATH" | cut -f1)
    echo "✅ PKG file found: $PKG_PATH ($PKG_SIZE)"
else
    echo "❌ Error: PKG file not found at expected location"
    echo "   Expected: $PKG_PATH"
    ls -la "$BUILD_DIR/mas/" 2>/dev/null || echo "   Directory does not exist"
    exit 1
fi

# Verify code signature
APP_PATH="$BUILD_DIR/mas/$APP_NAME.app"
if [ -d "$APP_PATH" ]; then
    echo "   📝 Verifying code signature..."
    codesign --verify --verbose "$APP_PATH" && echo "   ✅ Code signature valid" || echo "   ⚠️  Code signature verification failed"
else
    echo "   ⚠️  App bundle not found, skipping signature verification"
fi

echo "✅ Build verification completed"

# --- Step 5: Upload to App Store Connect (Optional) ---
echo ""
echo "📤 [Step 5/5] Upload to App Store Connect..."

if [ "$AUTO_UPLOAD" = "true" ]; then
    if [ -n "$APPLE_ID" ] && [ -n "$APPLE_APP_SPECIFIC_PASSWORD" ]; then
        echo "   🚀 Attempting automatic upload..."

        # Try to upload using altool (deprecated but still works)
        # xcrun altool --upload-app --type osx --file "$PKG_PATH" \
        #     --username "$APPLE_ID" \
        #     --password "$APPLE_APP_SPECIFIC_PASSWORD" \
        #     --verbose

        # Try to upload using newer notarytool + altool
        if command -v xcrun &> /dev/null; then
            echo "   📤 Uploading to App Store Connect..."
            xcrun altool --upload-app --type osx --file "$PKG_PATH" \
                --username "$APPLE_ID" \
                --password "$APPLE_APP_SPECIFIC_PASSWORD" \
                --verbose

            if [ $? -eq 0 ]; then
                echo "   ✅ Upload successful!"
            else
                echo "   ❌ Upload failed. Please upload manually."
            fi
        else
            echo "   ⚠️  xcrun not available, skipping upload"
        fi
    else
        echo "   ⚠️  Automatic upload not configured"
        echo "   Set APPLE_ID and APPLE_APP_SPECIFIC_PASSWORD to enable automatic upload"
    fi
else
    echo "   ⏭️  Automatic upload disabled (AUTO_UPLOAD=$AUTO_UPLOAD)"
    echo "   To enable automatic upload, run with: AUTO_UPLOAD=true ./scripts/build-appstore.sh"
    echo "   Or manually upload using Xcode Organizer or xcrun altool (see Next Steps below)"
fi

# --- Summary ---
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "🎯 BUILD SUMMARY - Klever Desktop"
echo "═══════════════════════════════════════════════════════════════"
echo "📱 App Name: $APP_NAME"
echo "📦 Version: $APP_VERSION"
echo "🆔 Bundle ID: $BUNDLE_ID"
echo "📂 Build Output: $BUILD_DIR/mas/"
if [ -f "$PKG_PATH" ]; then
    echo "✅ PKG File: $(basename "$PKG_PATH") ($PKG_SIZE)"
else
    echo "❌ PKG File: Not found"
fi
echo ""
echo "🚀 Next Steps:"
echo "   1. Test the app locally if needed"
echo "   2. Upload to App Store Connect (if not done automatically):"
echo "      - Use Xcode → Window → Organizer"
echo "      - Or use: xcrun altool --upload-app --type osx --file \"$PKG_PATH\" \\"
echo "                        --username \"[APPLE_ID]\" --password \"[APP_SPECIFIC_PASSWORD]\""
echo "   3. Submit for review in App Store Connect"
echo ""
echo "📚 Documentation:"
echo "   - App Store Connect: https://appstoreconnect.apple.com"
echo "   - Electron Builder: https://www.electron.build/configuration/mas"
echo "═══════════════════════════════════════════════════════════════"
