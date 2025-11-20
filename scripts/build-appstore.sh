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

# Code Signing Identity - Auto-detect if not set
if [ -z "$CSC_NAME" ]; then
    echo "🔍 Auto-detecting Apple Distribution certificate..."

    # Try "Apple Distribution" first (current naming)
    AUTO_CSC_NAME=$(security find-identity -v -p codesigning | grep "Apple Distribution" | head -n 1 | awk -F'"' '{print $2}')

    # Fallback to old naming
    if [ -z "$AUTO_CSC_NAME" ]; then
        AUTO_CSC_NAME=$(security find-identity -v -p codesigning | grep "3rd Party Mac Developer Application" | head -n 1 | awk -F'"' '{print $2}')
    fi

    if [ -n "$AUTO_CSC_NAME" ]; then
        export CSC_NAME="$AUTO_CSC_NAME"
        echo "✅ Auto-detected: $CSC_NAME"
    else
        echo "⚠️  CSC_NAME not set and auto-detection failed"
        echo "   This should be your 'Apple Distribution' certificate"
        echo "   Example: export CSC_NAME=\"Apple Distribution: Your Name (TEAM_ID)\""
        echo ""
        echo "   Available signing identities:"
        security find-identity -v -p codesigning | grep -E "(Apple Distribution|3rd Party Mac Developer)" || echo "   No Mac App Store certificates found"
        echo ""
    fi
fi

if [ -z "$CSC_INSTALLER_NAME" ]; then
    echo "🔍 Auto-detecting Mac Installer Distribution certificate..."

    # Try "Mac Installer Distribution" first (current naming)
    AUTO_INSTALLER=$(security find-identity -v -p codesigning | grep "Mac Installer Distribution" | head -n 1 | awk -F'"' '{print $2}')

    # Fallback to old naming
    if [ -z "$AUTO_INSTALLER" ]; then
        AUTO_INSTALLER=$(security find-identity -v -p codesigning | grep "3rd Party Mac Developer Installer" | head -n 1 | awk -F'"' '{print $2}')
    fi

    if [ -n "$AUTO_INSTALLER" ]; then
        export CSC_INSTALLER_NAME="$AUTO_INSTALLER"
        echo "✅ Auto-detected: $CSC_INSTALLER_NAME"
    else
        echo "⚠️  CSC_INSTALLER_NAME not set and auto-detection failed"
        echo "   Note: electron-builder will try to find it automatically from Keychain"
        echo "   If build fails, export CSC_INSTALLER_NAME=\"Mac Installer Distribution: Your Name (TEAM_ID)\""
    fi
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

# --- Build Number Configuration ---
if [ -n "$BUILD_NUMBER" ]; then
    # BUILD_NUMBER가 환경변수로 이미 설정된 경우
    echo "✅ Using build number from environment: $BUILD_NUMBER"
else
    # 대화형으로 빌드 번호 입력받기
    echo ""
    echo "📝 Build Number (CFBundleVersion) is required for App Store submission."
    echo "   - For first upload of version $APP_VERSION, use: 1"
    echo "   - For subsequent uploads, increment: 2, 3, 4..."
    echo ""
    read -p "Enter build number [default: 1]: " INPUT_BUILD_NUMBER

    # 입력이 없으면 기본값 "1" 사용
    BUILD_NUMBER="${INPUT_BUILD_NUMBER:-1}"

    # 숫자인지 검증
    if ! [[ "$BUILD_NUMBER" =~ ^[0-9]+$ ]]; then
        echo "❌ Error: Build number must be a positive integer"
        exit 1
    fi

    echo "✅ Using build number: $BUILD_NUMBER"
fi

echo ""
echo "📋 Build configuration:"
echo "   - App Name: $APP_NAME"
echo "   - Bundle ID: $BUNDLE_ID"
echo "   - Version: $APP_VERSION"
echo "   - Build Number: $BUILD_NUMBER"
echo "   - Build Dir: $BUILD_DIR"
echo "   - Auto Upload: $([ "$AUTO_UPLOAD" = "true" ] && echo "✅ Enabled" || echo "⏭️  Disabled (use AUTO_UPLOAD=true to enable)")"
echo ""

# --- Step 0: Generate macOS icons ---
echo "🎨 [Step 0/6] Generating macOS icons..."

# Check if icon.icns exists and is recent
ICON_PNG="build/icon.png"
ICON_ICNS="build/icon.icns"
REGENERATE_ICON=false

if [ ! -f "$ICON_ICNS" ]; then
    echo "   ⚠️  icon.icns not found, generating..."
    REGENERATE_ICON=true
elif [ "$ICON_PNG" -nt "$ICON_ICNS" ]; then
    echo "   ⚠️  icon.png is newer than icon.icns, regenerating..."
    REGENERATE_ICON=true
else
    echo "   ✅ icon.icns exists and is up-to-date"
fi

if [ "$REGENERATE_ICON" = true ]; then
    if [ -f "scripts/generate-icons.sh" ]; then
        bash scripts/generate-icons.sh
        echo "✅ Icons generated successfully"
    else
        echo "   ⚠️  Icon generation script not found at scripts/generate-icons.sh"
        echo "   Please run manually or ensure icon.icns exists in build/"

        if [ ! -f "$ICON_ICNS" ]; then
            echo "   ❌ Error: $ICON_ICNS is required for Mac App Store build"
            echo ""
            echo "   To generate icons manually:"
            echo "   1. On macOS: ./scripts/generate-icons.sh"
            echo "   2. Or use online converter: https://cloudconvert.com/png-to-icns"
            echo "   3. Or use: npm install -g png2icons && png2icons build/icon.png build/"
            exit 1
        fi
    fi
fi

# --- Step 1: Install dependencies ---
echo "📦 [Step 1/6] Installing dependencies..."
yarn install --frozen-lockfile
echo "✅ Dependencies installed"

# --- Step 2: Build the application ---
echo "🔨 [Step 2/6] Building Klever Desktop..."

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
echo "📦 [Step 3/6] Packaging for Mac App Store..."

# Set environment variables for electron-builder
export ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES=true

# Build for Mac App Store
echo "   🍎 Creating Mac App Store build..."

# Set CFBundleVersion via environment variable (electron-builder convention)
export ELECTRON_BUILDER_BUILD_NUMBER="$BUILD_NUMBER"

# electron-builder command for mas (Mac App Store)
# Note: electron-builder will use:
# - CSC_NAME for app signing (Apple Distribution)
# - CSC_INSTALLER_NAME (or auto-detect) for pkg signing (Mac Installer Distribution)
# - ELECTRON_BUILDER_BUILD_NUMBER for CFBundleVersion
yarn run electron-builder --mac mas --config.mac.target=mas \
    --config.appId="$BUNDLE_ID" \
    --config.productName="$APP_NAME" \
    --config.mac.category="public.app-category.developer-tools" \
    --config.directories.output="$BUILD_DIR"

echo "✅ Mac App Store package created"

# --- Step 4: Verify the build ---
echo "🔍 [Step 4/6] Verifying build..."

# Find PKG file dynamically (could be in mas/ or mas-arm64/ with various naming patterns)
PKG_PATH=$(find "$BUILD_DIR" -name "*.pkg" -type f | head -1)

if [ -n "$PKG_PATH" ] && [ -f "$PKG_PATH" ]; then
    PKG_SIZE=$(du -h "$PKG_PATH" | cut -f1)
    echo "✅ PKG file found: $PKG_PATH ($PKG_SIZE)"

    # Verify PKG signature
    echo "   📝 Verifying PKG signature..."
    PKG_CHECK_OUTPUT=$(pkgutil --check-signature "$PKG_PATH" 2>&1)
    PKG_CHECK_STATUS=$?

    if [ $PKG_CHECK_STATUS -eq 0 ]; then
        echo "   ✅ PKG signature valid"
        echo ""
        echo "   📋 PKG Signature Details:"
        echo "$PKG_CHECK_OUTPUT" | grep -E "(Status|Developer ID|Certificate)" | sed 's/^/      /'
    else
        echo "   ❌ PKG signature verification FAILED!"
        echo ""
        echo "   Error details:"
        echo "$PKG_CHECK_OUTPUT" | sed 's/^/      /'
        echo ""
        echo "   ⚠️  This PKG may be rejected by App Store Connect!"
        echo "   Common causes:"
        echo "      - Mac Installer Distribution certificate not found"
        echo "      - Certificate expired or revoked"
        echo "      - electron-builder failed to sign the PKG"
        echo ""
        echo "   To fix:"
        echo "      1. Verify certificates: security find-identity -v -p codesigning"
        echo "      2. Check CSC_INSTALLER_NAME environment variable"
        echo "      3. Re-run build with DEBUG=electron-builder for detailed logs"
        echo ""
        read -p "   Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
else
    echo "❌ Error: PKG file not found in $BUILD_DIR"
    echo "   Searching for build artifacts..."
    find "$BUILD_DIR" -type f \( -name "*.pkg" -o -name "*.app" \) 2>/dev/null || echo "   No build artifacts found"
    echo ""
    echo "   Common causes:"
    echo "      - electron-builder failed during packaging"
    echo "      - Code signing failed"
    echo "      - Missing provisioning profile"
    echo ""
    echo "   Check build logs above for errors"
    exit 1
fi

# Find and verify .app bundle
APP_PATH=$(find "$BUILD_DIR" -name "$APP_NAME.app" -type d | head -1)
if [ -n "$APP_PATH" ] && [ -d "$APP_PATH" ]; then
    echo ""
    echo "   📝 Verifying app bundle signature..."
    APP_CHECK_OUTPUT=$(codesign --verify --deep --strict --verbose=2 "$APP_PATH" 2>&1)
    APP_CHECK_STATUS=$?

    if [ $APP_CHECK_STATUS -eq 0 ]; then
        echo "   ✅ App bundle signature valid"

        # Display signature details
        echo ""
        echo "   📋 App Signature Details:"
        codesign --display --verbose=4 "$APP_PATH" 2>&1 | grep -E "(Authority|TeamIdentifier|Identifier|Format)" | sed 's/^/      /'

        # Check if Python runtime was signed (via afterSign.js)
        echo ""
        echo "   🔍 Checking Python runtime signature..."
        PYTHON_PATHS=(
            "$APP_PATH/Contents/Resources/python/darwin-arm64/python/bin/python3"
            "$APP_PATH/Contents/Resources/python/darwin-x64/python/bin/python3"
            "$APP_PATH/Contents/Resources/extraResources/python/darwin-arm64/python/bin/python3"
            "$APP_PATH/Contents/Resources/extraResources/python/darwin-x64/python/bin/python3"
        )

        PYTHON_FOUND=false
        for PYTHON_BIN in "${PYTHON_PATHS[@]}"; do
            if [ -f "$PYTHON_BIN" ]; then
                PYTHON_FOUND=true
                PYTHON_SIG_OUTPUT=$(codesign --verify --verbose "$PYTHON_BIN" 2>&1)
                PYTHON_SIG_STATUS=$?

                if [ $PYTHON_SIG_STATUS -eq 0 ]; then
                    echo "   ✅ Python runtime signed: $(basename $(dirname $(dirname $(dirname "$PYTHON_BIN"))))"
                else
                    echo "   ⚠️  Python runtime NOT signed: $(basename $(dirname $(dirname $(dirname "$PYTHON_BIN"))))"
                    echo "      This may cause App Store rejection!"
                    echo "      Check that scripts/afterSign.js ran successfully"
                fi
                break
            fi
        done

        if [ "$PYTHON_FOUND" = false ]; then
            echo "   ⚠️  Python runtime not found in app bundle"
            echo "      If Python is required, check extraResources packaging"
        fi
    else
        echo "   ❌ App bundle signature verification FAILED!"
        echo ""
        echo "   Error details:"
        echo "$APP_CHECK_OUTPUT" | sed 's/^/      /'
        echo ""
        echo "   ⚠️  This app will be rejected by App Store Connect!"
        exit 1
    fi
else
    echo "   ⚠️  App bundle not found at expected location"
    echo "   Searched for: $APP_NAME.app in $BUILD_DIR"
fi

echo ""
echo "✅ Build verification completed"

# --- Step 5: Upload to App Store Connect (Optional) ---
echo ""
echo "📤 [Step 5/6] Upload to App Store Connect..."

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
echo "🔢 Build Number: $BUILD_NUMBER"
echo "🆔 Bundle ID: $BUNDLE_ID"
if [ -n "$PKG_PATH" ] && [ -f "$PKG_PATH" ]; then
    echo "📂 Build Output: $(dirname "$PKG_PATH")"
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
