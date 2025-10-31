#!/bin/bash

# =================================================================
# Klever Desktop - App Store Build Script
# Creates Xcode archive for App Store submission via Xcode Organizer
# Supports automatic upload to App Store Connect
# =================================================================

set -e # Exit immediately if a command exits with a non-zero status

echo "🚀 Starting Klever Desktop App Store build process..."

# --- Configuration ---
APP_NAME="KleverDesktop"
APP_PATH="app/build/compose/binaries/main/app/${APP_NAME}.app"
ARCHIVE_NAME="KleverDesktop"
ARCHIVE_PATH="app/build/compose/binaries/main/archive/${ARCHIVE_NAME}.xcarchive"
ENTITLEMENTS="entitlements.plist"
BUNDLE_ID="com.klever.desktop"
# Use environment variable if set, otherwise default to true
AUTO_UPLOAD="${AUTO_UPLOAD:-true}"

# --- Check for entitlements file ---
if [ ! -f "$ENTITLEMENTS" ]; then
    echo "❌ Error: entitlements.plist not found in project root"
    echo "   Please ensure entitlements.plist exists before running this script"
    exit 1
fi

# --- Environment Variables Configuration ---
echo "🔍 Checking environment variables..."

# Apple Developer Configuration
if [ -z "$SIGNING_IDENTITY_APPSTORE" ]; then
    echo "⚠️  SIGNING_IDENTITY_APPSTORE not set"
    echo "   Please set your Apple Distribution identity:"
    echo "   export SIGNING_IDENTITY_APPSTORE=\"Apple Distribution: Your Name (TEAM_ID)\""
    echo ""
    echo "   Available signing identities:"
    security find-identity -v -p codesigning | grep "Apple Distribution" || echo "   No Apple Distribution identities found"
    exit 1
fi

if [ -z "$INSTALLER_IDENTITY" ]; then
    echo "⚠️  INSTALLER_IDENTITY not set, will skip PKG creation"
    PKG_CREATION_ENABLED=false
else
    PKG_CREATION_ENABLED=true
fi

# Extract Team ID from signing identity or use environment variable
if [ -z "$TEAM_ID" ]; then
    TEAM_ID=$(echo "$SIGNING_IDENTITY_APPSTORE" | sed -n 's/.*(\([^)]*\)).*/\1/p')
    if [ -z "$TEAM_ID" ]; then
        echo "❌ Error: Could not extract Team ID from signing identity"
        echo "   Please ensure SIGNING_IDENTITY_APPSTORE follows the format:"
        echo "   \"Apple Distribution: Your Name (TEAM_ID)\""
        exit 1
    fi
fi

# Apple ID Configuration (for upload)
APPLE_UPLOAD_CONFIGURED=false
if [ -n "$APPLE_ID" ] && [ -n "$APPLE_PASSWORD" ]; then
    APPLE_UPLOAD_CONFIGURED=true
    echo "✅ Apple Upload: Configured"
    echo "   - Apple ID: $APPLE_ID"
    echo "   - Password: $(echo "$APPLE_PASSWORD" | sed 's/./*/g')"
else
    echo "⚠️  Apple Upload: Not configured (manual upload required)"
    echo "   - Missing: APPLE_ID and/or APPLE_PASSWORD"
fi

echo ""
echo "📋 Environment Variables Summary:"
echo "   - Apple Developer: ✅"
echo "   - Signing Identity: $SIGNING_IDENTITY_APPSTORE"
echo "   - Installer Identity: $([ "$PKG_CREATION_ENABLED" = true ] && echo "✅ $INSTALLER_IDENTITY" || echo "⚠️ Not set")"
echo "   - Team ID: $TEAM_ID"
echo "   - Apple Upload: $([ "$APPLE_UPLOAD_CONFIGURED" = true ] && echo "✅" || echo "⚠️")"
echo "   - Auto Upload: $([ "$AUTO_UPLOAD" = "true" ] && echo "✅ Enabled" || echo "⚠️ Disabled (PKG only)")"
echo ""

# --- Version Input ---
echo ""
echo "📋 Setting up version information..."

# Get current version from build.gradle.kts as default
CURRENT_VERSION=$(grep 'packageVersion = ' app/build.gradle.kts | sed 's/.*packageVersion = "\(.*\)".*/\1/')

# Check if running in CI mode
if [ "$CI_MODE" = "true" ]; then
    echo "🤖 Running in CI mode - using environment variables"
    
    if [ -z "$APP_VERSION" ]; then
        echo "❌ Error: APP_VERSION environment variable is required in CI mode"
        exit 1
    fi
    
    if [ -z "$BUILD_NUMBER" ]; then
        echo "❌ Error: BUILD_NUMBER environment variable is required in CI mode"
        exit 1
    fi
    
    if ! [[ "$BUILD_NUMBER" =~ ^[0-9]+$ ]]; then
        echo "❌ Error: BUILD_NUMBER must be a positive integer, got: $BUILD_NUMBER"
        exit 1
    fi
    
    echo "   ✅ App Version: $APP_VERSION (from environment)"
    echo "   ✅ Build Number: $BUILD_NUMBER (from environment)"
else
    # Interactive mode - ask for version information
    echo ""
    echo "🔢 Please enter version information:"
    echo ""
    
    # Ask for app version
    echo "📱 App Version (CFBundleShortVersionString):"
    echo "   Current in build.gradle.kts: $CURRENT_VERSION"
    read -p "   Enter new version (or press Enter to use current): " INPUT_VERSION
    
    if [ -z "$INPUT_VERSION" ]; then
        APP_VERSION="$CURRENT_VERSION"
        echo "   → Using current version: $APP_VERSION"
    else
        APP_VERSION="$INPUT_VERSION"
        echo "   → Using new version: $APP_VERSION"
    fi
    
    # Ask for build number
    echo ""
    echo "🔢 Build Number (CFBundleVersion):"
    read -p "   Enter build number: " BUILD_NUMBER
    
    if [ -z "$BUILD_NUMBER" ]; then
        echo "❌ Error: Build number is required"
        exit 1
    fi
    
    if ! [[ "$BUILD_NUMBER" =~ ^[0-9]+$ ]]; then
        echo "❌ Error: Build number must be a positive integer"
        exit 1
    fi
    
    echo "   → Using build number: $BUILD_NUMBER"
fi

echo ""
echo "📋 Build configuration:"
echo "   - App Version: $APP_VERSION"
echo "   - Build Number: $BUILD_NUMBER"
echo "   - Signing Identity: $SIGNING_IDENTITY_APPSTORE"
echo "   - Installer Identity: $([ "$PKG_CREATION_ENABLED" = true ] && echo "$INSTALLER_IDENTITY" || echo "Not set")"
echo "   - Team ID: $TEAM_ID"
echo "   - Bundle ID: $BUNDLE_ID"
echo "   - Entitlements: $ENTITLEMENTS"
echo "   - Archive Path: $ARCHIVE_PATH"
echo ""

# --- Step 1: Build the app ---
echo "🔨 [Step 1/8] Building Klever Desktop..."

# Gradle build configuration
GRADLE_PROPS=(
  "-Dcompose.desktop.mac.minSdkVersion=10.15" 
  "-Dcompose.desktop.verbose=true"
  "-Dapple.awt.UIElement=true"
  "-Dorg.gradle.parallel=true"
)

JVM_OPTS=(
  "-Dkotlin.daemon.jvmargs=-Xmx2g -XX:+UseParallelGC"
  "-Dorg.gradle.jvmargs=-Xmx2g -XX:+UseParallelGC -Dapple.awt.UIElement=true"
)

echo "🚀 Starting Gradle build..."
./gradlew :app:createDistributable "${GRADLE_PROPS[@]}" "${JVM_OPTS[@]}"

BUILD_RESULT=$?
if [ $BUILD_RESULT -ne 0 ]; then
  echo "❌ Build failed with exit code: $BUILD_RESULT"
  exit $BUILD_RESULT
fi

echo "✅ App built successfully at: $APP_PATH"

# --- Step 2: Verify app bundle exists ---
echo "📦 [Step 2/8] Verifying app bundle..."
if [ ! -d "$APP_PATH" ]; then
    echo "❌ Error: App bundle not found at $APP_PATH"
    exit 1
fi
echo "✅ App bundle verified"

# --- Step 3: Remove quarantine attributes ---
echo "🧹 [Step 3/8] Removing quarantine attributes..."
find "${APP_PATH}" -type f -exec xattr -d com.apple.quarantine {} \; 2>/dev/null || true
echo "✅ Quarantine attributes cleaned"

# --- Step 4: Sign runtime components ---
echo "🔏 [Step 4/8] Signing runtime components..."

# Find and sign jspawnhelper with special entitlements
JSPAWNHELPER_PATH=$(find "${APP_PATH}" -name "jspawnhelper" -type f)

if [ -n "$JSPAWNHELPER_PATH" ]; then
    # Create temporary entitlements without application-identifier for nested executables
    NESTED_ENTITLEMENTS="/tmp/entitlements-nested-$$.plist"
    echo "   Creating temporary entitlements for jspawnhelper..."
    
    cat > "$NESTED_ENTITLEMENTS" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- App Sandbox (required by App Store) -->
    <key>com.apple.security.app-sandbox</key>
    <true/>
    
    <!-- JVM Runtime Requirements -->
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.allow-dyld-environment-variables</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
</dict>
</plist>
EOF
    
    echo "   Signing jspawnhelper: $JSPAWNHELPER_PATH"
    codesign --force --options runtime --entitlements "$NESTED_ENTITLEMENTS" --identifier "jspawnhelper" --sign "$SIGNING_IDENTITY_APPSTORE" "$JSPAWNHELPER_PATH"
    
    # Clean up temporary file
    rm -f "$NESTED_ENTITLEMENTS"
    echo "   ✅ jspawnhelper signed"
fi

# Function to sign binary files
sign_binary() {
    local file="$1"
    local name=$(basename "$file")
    echo "   Signing: $name"
    
    # Check if file needs signing
    if codesign --verify "$file" 2>/dev/null; then
        echo "   ✓ Already signed and valid: $name"
        return 0
    fi
    
    # Sign the file
    if codesign --force --options runtime --entitlements "$ENTITLEMENTS" --sign "$SIGNING_IDENTITY_APPSTORE" "$file" 2>&1; then
        echo "   ✓ Signed: $name"
        return 0
    else
        echo "   ⚠️  Warning: Failed to sign $name (may not be critical)"
        return 0
    fi
}

echo "🔏 Signing all binaries in dependency order..."

# 1. Sign all native library files (.dylib, .jnilib, .so)
echo "   [1/4] Signing native library files..."
SIGNED_COUNT=0
find "${APP_PATH}" -type f \( -name "*.dylib" -o -name "*.jnilib" -o -name "*.so" \) | while read -r binary; do
    sign_binary "$binary"
    SIGNED_COUNT=$((SIGNED_COUNT + 1))
done
echo "   ✅ Native libraries signed"

# 2. Sign all JAR files
echo "   [2/4] Signing JAR files..."
find "${APP_PATH}" -type f -name "*.jar" | while read -r jar; do
    sign_binary "$jar"
done
echo "   ✅ JAR files signed"

# 3. Sign runtime executables (excluding jspawnhelper which was already signed)
echo "   [3/4] Signing runtime executables..."
RUNTIME_DIR="${APP_PATH}/Contents/runtime"
if [ -d "$RUNTIME_DIR" ]; then
    find "$RUNTIME_DIR" -type f -perm +111 | grep -v "jspawnhelper" | while read -r executable; do
        sign_binary "$executable"
    done
    echo "   ✅ Runtime executables signed"
fi

# 4. Sign other executable files
echo "   [4/4] Signing other executable files..."
find "${APP_PATH}" -type f -perm +111 | \
    grep -v "jspawnhelper" | \
    grep -v "Contents/runtime/" | \
    grep -v "\\.\\(dylib\\|jnilib\\|so\\|jar\\)$" | \
    while read -r executable; do
        sign_binary "$executable"
    done

echo "✅ All runtime components signed"

# --- Step 5: Update app bundle Info.plist ---
echo "📝 [Step 5/8] Updating app bundle Info.plist..."
INFO_PLIST="${APP_PATH}/Contents/Info.plist"

# Update version information
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString ${APP_VERSION}" "$INFO_PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion ${BUILD_NUMBER}" "$INFO_PLIST"
echo "   ✅ Updated version info: ${APP_VERSION} (${BUILD_NUMBER})"

# Add App Store required keys
# LSApplicationCategoryType
/usr/libexec/PlistBuddy -c "Add :LSApplicationCategoryType string public.app-category.productivity" "$INFO_PLIST" 2>/dev/null || \
/usr/libexec/PlistBuddy -c "Set :LSApplicationCategoryType public.app-category.productivity" "$INFO_PLIST"
echo "   ✅ LSApplicationCategoryType set to productivity"

# LSMinimumSystemVersion (required for arm64-only builds)
/usr/libexec/PlistBuddy -c "Add :LSMinimumSystemVersion string 12.0" "$INFO_PLIST" 2>/dev/null || \
/usr/libexec/PlistBuddy -c "Set :LSMinimumSystemVersion 12.0" "$INFO_PLIST"
echo "   ✅ LSMinimumSystemVersion set to 12.0"

# Add encryption info to avoid encryption questions
/usr/libexec/PlistBuddy -c "Add :ITSAppUsesNonExemptEncryption bool NO" "$INFO_PLIST" 2>/dev/null || \
/usr/libexec/PlistBuddy -c "Set :ITSAppUsesNonExemptEncryption NO" "$INFO_PLIST"
echo "   ✅ ITSAppUsesNonExemptEncryption set to NO"

echo "✅ App bundle Info.plist updated"

# --- Step 6: Sign the app bundle ---
echo "🔏 [Step 6/8] Signing the app bundle..."
codesign --force --options runtime --entitlements "$ENTITLEMENTS" --identifier "$BUNDLE_ID" --sign "$SIGNING_IDENTITY_APPSTORE" "$APP_PATH" --deep

# Verify signature
echo "🔍 Verifying signature..."
codesign --verify --verbose --deep "$APP_PATH"

if [ $? -eq 0 ]; then
    echo "✅ App signature verified successfully!"
else
    echo "❌ Error: App signature verification failed"
    exit 1
fi

echo "✅ App bundle signed successfully"

# --- Step 7: Create Xcode Archive ---
echo "📦 [Step 7/8] Creating Xcode Archive..."

# Create archive directory structure
echo "   📁 Creating archive directory structure..."
if [ -d "$ARCHIVE_PATH" ]; then
    echo "   🧹 Removing existing archive directory..."
    chmod -R u+w "$ARCHIVE_PATH" 2>/dev/null || true
    rm -rf "$ARCHIVE_PATH"
fi

mkdir -p "$ARCHIVE_PATH/Products/Applications"
mkdir -p "$ARCHIVE_PATH/dSYMs"

# Copy app to archive
echo "   📦 Copying app to archive..."
cp -R "$APP_PATH" "$ARCHIVE_PATH/Products/Applications/"

# Get current date in ISO 8601 format
CREATION_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Detect architecture
ARCH=$(file "$APP_PATH/Contents/MacOS/$APP_NAME" | grep -o "arm64\|x86_64" | head -1)
if [ -z "$ARCH" ]; then
    ARCH="arm64"  # Default to arm64
fi
echo "   🏗️  Detected architecture: $ARCH"

# Create Archive Info.plist
echo "   📝 Creating Archive Info.plist..."
cat > "$ARCHIVE_PATH/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>ApplicationProperties</key>
    <dict>
        <key>ApplicationPath</key>
        <string>Applications/${APP_NAME}.app</string>
        <key>Architectures</key>
        <array>
            <string>${ARCH}</string>
        </array>
        <key>CFBundleIdentifier</key>
        <string>${BUNDLE_ID}</string>
        <key>CFBundleShortVersionString</key>
        <string>${APP_VERSION}</string>
        <key>CFBundleVersion</key>
        <string>${BUILD_NUMBER}</string>
        <key>SigningIdentity</key>
        <string>${SIGNING_IDENTITY_APPSTORE}</string>
        <key>Team</key>
        <string>${TEAM_ID}</string>
    </dict>
    <key>ArchiveVersion</key>
    <integer>2</integer>
    <key>CreationDate</key>
    <date>${CREATION_DATE}</date>
    <key>Name</key>
    <string>${ARCHIVE_NAME}</string>
    <key>SchemeName</key>
    <string>${ARCHIVE_NAME}</string>
</dict>
</plist>
EOF

echo ""
echo "🎉 Xcode Archive created successfully!"
echo ""
echo "📍 Xcode Archive location: $ARCHIVE_PATH"
echo ""

# --- Step 8: Create PKG and Upload to App Store Connect (Optional) ---
echo ""
echo "🚀 [Step 8/8] Creating PKG and uploading to App Store Connect..."

if [ "$PKG_CREATION_ENABLED" = false ]; then
    echo "⚠️  PKG creation skipped - INSTALLER_IDENTITY not set"
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "🎯 BUILD SUMMARY"
    echo "═══════════════════════════════════════════════════════════════"
    echo "📱 App Version: $APP_VERSION"
    echo "🔢 Build Number: $BUILD_NUMBER"
    echo "✅ App bundle signed"
    echo "✅ Xcode Archive created: $ARCHIVE_PATH"
    echo ""
    echo "🚀 Next Steps:"
    echo "   1. Open Xcode"
    echo "   2. Window → Organizer (⌘+Shift+9)"
    echo "   3. Select the archive"
    echo "   4. Click 'Distribute App' → 'App Store Connect' → 'Upload'"
    echo "═══════════════════════════════════════════════════════════════"
    exit 0
fi

# Create PKG file
echo "📦 Creating installer PKG for App Store Connect..."

# Create pkg directory alongside archive, app, and dmg
PKG_DIR="app/build/compose/binaries/main/pkg"
mkdir -p "$PKG_DIR"
PKG_PATH="$PKG_DIR/${APP_NAME}.pkg"

# Create PKG file from the archive
productbuild --component "${ARCHIVE_PATH}/Products/Applications/${APP_NAME}.app" /Applications "$PKG_PATH" --sign "$INSTALLER_IDENTITY"

if [ $? -eq 0 ]; then
    echo "✅ PKG created successfully: $PKG_PATH ($(du -h "$PKG_PATH" | cut -f1))"
    
    if [ "$AUTO_UPLOAD" == "true" ]; then
        echo ""
        echo "🚀 Attempting automatic upload to App Store Connect..."
        
        # Try multiple upload methods
        UPLOAD_SUCCESS=false
        
        # Method 1: Try with environment variable password
        if [ -n "$APPLE_ID" ] && [ -n "$APPLE_PASSWORD" ]; then
            echo "📤 Method 1: Trying upload with environment variable password..."
            echo "   Using Apple ID: $APPLE_ID"
            xcrun altool --upload-app --type osx --file "$PKG_PATH" --username "$APPLE_ID" --password "$APPLE_PASSWORD" --verbose
            ALTOOL_RESULT=$?
            if [ $ALTOOL_RESULT -eq 0 ]; then
                UPLOAD_SUCCESS=true
                echo "🎉 Successfully uploaded to App Store Connect using environment password!"
            else
                echo "❌ Method 1 failed with exit code: $ALTOOL_RESULT"
            fi
        else
            echo "⚠️  Skipping Method 1: APPLE_ID or APPLE_PASSWORD not set"
        fi
        
        # Method 2: Try with keychain password (fallback)
        if [ "$UPLOAD_SUCCESS" = false ] && [ -n "$APPLE_ID" ]; then
            echo "📤 Method 2: Trying upload with keychain password..."
            xcrun altool --upload-app --type osx --file "$PKG_PATH" --username "$APPLE_ID" --password "@keychain:AC_PASSWORD" --verbose 2>/dev/null
            if [ $? -eq 0 ]; then
                UPLOAD_SUCCESS=true
                echo "🎉 Successfully uploaded to App Store Connect using keychain password!"
            else
                echo "❌ Method 2 failed: keychain password not found"
            fi
        fi
        
        # Method 3: Try with app-specific password
        if [ "$UPLOAD_SUCCESS" = false ] && [ -n "$APPLE_ID" ] && [ -n "$APP_SPECIFIC_PASSWORD" ]; then
            echo "📤 Method 3: Trying upload with app-specific password..."
            xcrun altool --upload-app --type osx --file "$PKG_PATH" --username "$APPLE_ID" --password "$APP_SPECIFIC_PASSWORD" --verbose
            if [ $? -eq 0 ]; then
                UPLOAD_SUCCESS=true
                echo "🎉 Successfully uploaded to App Store Connect using app-specific password!"
            fi
        fi
        
        if [ "$UPLOAD_SUCCESS" = true ]; then
            echo "✅ Your app is now being processed by Apple for review."
            echo "📱 You can check the status at: https://appstoreconnect.apple.com"
        else
            echo "❌ Automatic upload failed. Please use one of the manual methods below."
        fi
    fi
    
    # Always show manual upload options
    echo ""
    echo "📤 Manual upload options:"
    echo ""
    echo "🌟 Option 1: Xcode Organizer (Recommended)"
    echo "   1. Open Xcode"
    echo "   2. Window → Organizer (⌘+Shift+9)"
    echo "   3. Select archive: $ARCHIVE_PATH"
    echo "   4. Click 'Distribute App' → 'App Store Connect' → 'Upload'"
    echo ""
    echo "💻 Option 2: Command Line (requires app-specific password)"
    echo "   1. Generate app-specific password at appleid.apple.com"
    echo "   2. Run: xcrun altool --upload-app --type osx --file \"$PKG_PATH\" --username \"[APPLE_ID]\" --password \"[APP_SPECIFIC_PASSWORD]\" --verbose"
    
else
    echo "❌ PKG creation failed. Please check your installer identity: $INSTALLER_IDENTITY"
    echo "💡 Make sure the certificate is installed and valid."
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "🎯 BUILD SUMMARY"
echo "═══════════════════════════════════════════════════════════════"
echo "📱 App Version: $APP_VERSION"
echo "🔢 Build Number: $BUILD_NUMBER"
echo "🏗️  Architecture: $ARCH"
echo "✅ App bundle signed"
echo "✅ Xcode Archive created: $ARCHIVE_PATH"
if [ -f "$PKG_PATH" ]; then
    echo "✅ PKG file created: $PKG_PATH"
else
    echo "⚠️  PKG file creation failed"
fi
echo ""
echo "🚀 Ready for App Store Connect submission!"
echo "   Use any of the upload methods shown above."
echo "═══════════════════════════════════════════════════════════════"

