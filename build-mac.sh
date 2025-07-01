#!/bin/bash
set -e

# build-mac.sh: KleverDesktop signing script (notarization disabled)
# This script signs the app bundle without Apple notarization

echo "⚠️ Running signing process without notarization"
echo "Users will need to manually allow the app in System Settings > Security & Privacy"

# Load environment variables
source .envrc

echo "🔐 Starting KleverDesktop signing..."
echo "Developer ID: $APPLE_DEVELOPER_ID"

# Extract version info
APP_VERSION=$(./gradlew -q printVersion --no-configuration-cache | tail -n 1)
echo "Building KleverDesktop version $APP_VERSION"

# Build the app
echo "Building app bundle..."
./gradlew createDistributable --no-daemon

# App bundle path
APP_BUNDLE="app/build/compose/binaries/main/app/KleverDesktop.app"

# Check if app bundle exists
if [ ! -d "$APP_BUNDLE" ]; then
  echo "❌ App bundle not found: $APP_BUNDLE"
  echo "Run Gradle build first"
  exit 1
fi

# Create entitlements file (hardened runtime)
echo "📄 Creating entitlements file..."
ENTITLEMENTS="entitlements.plist"
cat > $ENTITLEMENTS << EOL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.cs.allow-dyld-environment-variables</key>
    <true/>
    <key>com.apple.security.automation.apple-events</key>
    <true/>
    <key>com.apple.security.cs.debugger</key>
    <true/>
    <key>com.apple.security.device.audio-input</key>
    <true/>
    <key>com.apple.security.device.camera</key>
    <true/>
</dict>
</plist>
EOL

# Signing function
sign_file() {
  local file="$1"
  
  if [ ! -e "$file" ]; then
    echo "  ⚠️ File not found: $file"
    return 1
  fi
  
  echo "  Signing: $(basename "$file")"
  if codesign --force --options runtime --timestamp --entitlements "$ENTITLEMENTS" -s "$APPLE_DEVELOPER_ID" "$file" 2>/dev/null; then
    echo "  ✓ Successfully signed: $(basename "$file")"
    return 0
  else
    echo "  ✗ Failed to sign: $(basename "$file")"
    return 1
  fi
}

# Sign key files first
echo "🔍 Signing key binaries..."
sign_file "$APP_BUNDLE/Contents/MacOS/KleverDesktop"
sign_file "$APP_BUNDLE/Contents/app/libskiko-macos-arm64.dylib"

# Sign entire app bundle
echo "📦 Signing complete app bundle..."
codesign --force --deep --options runtime --timestamp --entitlements "$ENTITLEMENTS" -s "$APPLE_DEVELOPER_ID" "$APP_BUNDLE"

# Verify signature
echo "✅ Verifying signature..."
if codesign --verify --deep --strict "$APP_BUNDLE" 2>/dev/null; then
  echo "✅ App bundle signature verification successful"
else
  echo "⚠️ App bundle signature verification failed"
  codesign --verify --deep --verbose "$APP_BUNDLE"
  exit 1
fi

# Create DMG
echo "💿 Creating DMG..."
./gradlew packageDmg --no-daemon

# DMG path
DMG_PATH="app/build/compose/binaries/main/dmg/KleverDesktop-$APP_VERSION.dmg"

# Check if DMG exists
if [ ! -f "$DMG_PATH" ]; then
  echo "⚠️ DMG not found at: $DMG_PATH"
  FOUND_DMG=$(find app/build/compose/binaries/main/dmg -name "*.dmg" | head -n 1)
  if [ -n "$FOUND_DMG" ]; then
    DMG_PATH="$FOUND_DMG"
    echo "✓ Found DMG at: $DMG_PATH"
    
    # Extract version from filename if needed
    if [ -z "$APP_VERSION" ]; then
      FILENAME=$(basename "$FOUND_DMG")
      APP_VERSION=$(echo $FILENAME | sed 's/KleverDesktop-\(.*\)\.dmg/\1/')
      echo "Extracted version from filename: $APP_VERSION"
    fi
  else
    echo "❌ No DMG file found"
    exit 1
  fi
fi

# Copy to distribution directory
mkdir -p dist
DIST_DMG="dist/KleverDesktop-$APP_VERSION.dmg"
cp "$DMG_PATH" "$DIST_DMG"
echo "✅ DMG copied to: $DIST_DMG"

echo ""
echo "✅ Build and signing completed!"
echo "📦 Signed DMG file: $DIST_DMG"
echo ""
echo "⚠️ Important Note:"
echo "This app is signed but NOT notarized."
echo "Users will need to either:"
echo "1. Right-click > Open on first launch, or"
echo "2. Click 'Open Anyway' in System Settings > Security & Privacy"
echo ""
echo "🚀 Ready for distribution! (without notarization)" 