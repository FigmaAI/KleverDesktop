#!/bin/bash
set -e

echo "Starting macOS build and signing process"

# Check if environment variables exist
if [ -z "$APPLE_DEVELOPER_ID" ] || [ -z "$APPLE_ID" ] || [ -z "$APPLE_APP_PASSWORD" ] || [ -z "$APPLE_TEAM_ID" ]; then
    echo "Required environment variables are not set. Please set the following variables:"
    echo "APPLE_DEVELOPER_ID, APPLE_ID, APPLE_APP_PASSWORD, APPLE_TEAM_ID"
    echo "For local development, use: ./load-env.sh ./build-mac.sh"
    exit 1
fi

# Create build.properties with values from environment variables
echo "Creating build.properties from environment variables..."
cat > build.properties << EOF
# macOS Signing Properties
apple.signing.identity=$APPLE_DEVELOPER_ID
apple.notarization.username=$APPLE_ID
apple.notarization.password=$APPLE_APP_PASSWORD
apple.notarization.teamid=$APPLE_TEAM_ID
EOF

# if DMG_INPUT_PATH, BUILD_VERSION is set in CI/CD pipeline, use it
# otherwise, extract it from Gradle project
if [ -z "$BUILD_VERSION" ]; then
    # Extract version from Gradle project
    if [ -z "$CI_COMMIT_TAG" ]; then
        # Get version from Gradle
        echo "Extracting version from Gradle project..."
        BUILD_VERSION=$(./gradlew -q printVersion --no-configuration-cache | tail -n 1)
        if [ -z "$BUILD_VERSION" ]; then
            echo "Failed to extract version from Gradle, falling back to default"
            BUILD_VERSION="1.0.2"
        fi
    else
        # Parse semantic version from CI tag (e.g., 1.0.2-bugfix -> 1.0.2)
        RAW_VERSION="$CI_COMMIT_TAG"
        BUILD_VERSION=$(echo $RAW_VERSION | sed 's/\([0-9]*\.[0-9]*\.[0-9]*\).*/\1/')
        echo "Parsed version from tag: $BUILD_VERSION (original: $RAW_VERSION)"
    fi
fi

echo "Using version: $BUILD_VERSION"

# Set DMG path based on version if not already set
if [ -z "$DMG_INPUT_PATH" ]; then
    DMG_INPUT_PATH="app/build/compose/binaries/main/dmg/KleverDesktop-${BUILD_VERSION}.dmg"
fi

# Always run Gradle build to ensure the .app bundle exists for deep signing
if [ -f "$DMG_INPUT_PATH" ]; then
    echo "Existing DMG detected ($DMG_INPUT_PATH); it will be regenerated to allow deep signing."
    rm "$DMG_INPUT_PATH"
fi

echo "Running Gradle build to produce fresh DMG and app bundle..."
./gradlew packageDmg --no-daemon

# Check if DMG was created
if [ ! -f "$DMG_INPUT_PATH" ]; then
    echo "DMG file not found at path: $DMG_INPUT_PATH"
    echo "Searching for generated DMG file..."
    FOUND_DMG=$(find app/build/compose/binaries/main/dmg -name "*.dmg" | head -n 1)
    if [ ! -z "$FOUND_DMG" ]; then
        echo "Found DMG at: $FOUND_DMG"
        DMG_INPUT_PATH="$FOUND_DMG"
        
        # Extract version from filename if needed
        if [ -z "$BUILD_VERSION" ]; then
            FILENAME=$(basename "$FOUND_DMG")
            BUILD_VERSION=$(echo $FILENAME | sed 's/KleverDesktop-\(.*\)\.dmg/\1/')
            echo "Extracted version from filename: $BUILD_VERSION"
        fi
    else
        echo "No DMG file found. Build failed."
        rm build.properties
        exit 1
    fi
fi

# ---------------- Recursive Code Signing ----------------
# Sign all Mach-O binaries, dylibs, and JARs that contain native executables

echo "Recursively signing embedded binaries in the application bundle..."

# Path to the temp working app bundle (it lives inside the DMG build workspace)
APP_BUNDLE_PATH="app/build/compose/tmp/dmg/KleverDesktop.app"

# If the expected tmp path does not exist (Gradle version differences), try to locate the .app dynamically
if [ ! -d "$APP_BUNDLE_PATH" ]; then
  APP_BUNDLE_PATH=$(find app/build/compose -type d -name "KleverDesktop.app" | head -n 1 || true)
fi

if [ -z "$APP_BUNDLE_PATH" ] || [ ! -d "$APP_BUNDLE_PATH" ]; then
  echo "Warning: Could not locate temporary .app bundle to perform deep signing. Skipping recursive signing step."
else
  echo "Found app bundle at: $APP_BUNDLE_PATH"

  # Helper to sign individual files safely
  sign_file() {
    local file="$1"
    if codesign -dv "$file" 2>/dev/null; then
      # Already signed – force re-sign to ensure hardened runtime & timestamp
      :
    fi
    codesign --force --options runtime --timestamp -s "$APPLE_DEVELOPER_ID" "$file" || {
      echo "Failed to sign $file";
    }
  }

  # Sign all Mach-O executables, dylibs, and native libs
  find "$APP_BUNDLE_PATH" -type f \( -perm -u+x -o -name "*.dylib" -o -name "*.so" -o -name "*.jnilib" \) | while read -r bin; do
    sign_file "$bin"
  done

  # Sign JARs that may contain binaries (e.g., Selenium Manager)
  find "$APP_BUNDLE_PATH" -type f -name "*.jar" | while read -r jar; do
    echo "Processing JAR: $jar"
    # Temporary work dir for jar extraction
    tmpdir=$(mktemp -d)
    # Extract only executable candidates to save time
    unzip -q "$jar" -d "$tmpdir"

    native_found=false
    # Find executable Mach-O or shared libs inside jar
    while IFS= read -r -d '' native; do
      native_found=true
      echo "  Signing native binary inside jar: $native"
      sign_file "$native"
    done < <(find "$tmpdir" -type f \( -perm -u+x -o -name "*.dylib" -o -name "*.so" -o -name "*.jnilib" \) -print0)

    if [ "$native_found" = true ]; then
      # Update jar with signed binaries (paths relative to tmpdir)
      pushd "$tmpdir" >/dev/null
      jar uf "$jar" $(find . -type f \( -perm -u+x -o -name "*.dylib" -o -name "*.so" -o -name "*.jnilib" \))
      popd >/dev/null
    fi

    # Clean up
    rm -rf "$tmpdir"

    # Finally sign the jar itself so its signature matches new content
    sign_file "$jar"
  done

  # Finally, re-sign the top-level .app bundle with --deep to ensure all nested items are sealed
  codesign --force --deep --options runtime --timestamp -s "$APPLE_DEVELOPER_ID" "$APP_BUNDLE_PATH"
fi

# ---------------- Notarization & Stapling ----------------
echo "Submitting for notarization (this may take a few minutes)..."

# Capture submission result as JSON so we can extract the request ID and status
SUBMIT_RESULT=$(xcrun notarytool submit "$DMG_INPUT_PATH" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_APP_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait \
  --output-format json)

# Basic status parsing without external tools (jq may not be available)
REQUEST_ID=$(echo "$SUBMIT_RESULT" | grep -m1 '"id"' | sed -E 's/.*"id"[ ]*:[ ]*"([^"]+)".*/\1/')
REQUEST_STATUS=$(echo "$SUBMIT_RESULT" | grep -m1 '"status"' | sed -E 's/.*"status"[ ]*:[ ]*"([^"]+)".*/\1/')

echo "Notarization request ID: $REQUEST_ID"
echo "Notarization status    : $REQUEST_STATUS"

if [[ "$REQUEST_STATUS" != "Accepted" ]]; then
  echo "Notarization failed (status: $REQUEST_STATUS). Fetching detailed log..."
  xcrun notarytool log "$REQUEST_ID" \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_APP_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" || true
  echo "Aborting due to failed notarization."
  rm build.properties
  exit 1
fi

# Staple the notarization ticket to the DMG (retry once if it fails)
echo "Stapling notarization ticket..."
if ! xcrun stapler staple "$DMG_INPUT_PATH"; then
  echo "Stapler failed. Attempting to fetch log and exit."
  xcrun notarytool log "$REQUEST_ID" \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_APP_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" || true
  rm build.properties
  exit 1
fi

# Set output path if not already set
if [ -z "$DMG_OUTPUT_PATH" ]; then
    DMG_OUTPUT_PATH="app/build/compose/binaries/main/dmg/KleverDesktop-${BUILD_VERSION}-signed.dmg"
fi

# Create a copy with -signed suffix
echo "Creating signed copy at: $DMG_OUTPUT_PATH"
cp "$DMG_INPUT_PATH" "$DMG_OUTPUT_PATH"

echo "Build and notarization complete: $DMG_INPUT_PATH"

# dist directory management is handled in CI/CD pipeline
# check if running in CI/CD environment
if [ -z "$CI_JOB_ID" ]; then
  # local build
  echo "Running in local environment, copying to dist directory..."
  mkdir -p dist
  cp "$DMG_INPUT_PATH" "dist/KleverDesktop-${BUILD_VERSION}.dmg"
  
  # if CI_COMMIT_TAG is set and different from BUILD_VERSION, copy to tag version
  if [ ! -z "$CI_COMMIT_TAG" ] && [ "$CI_COMMIT_TAG" != "$BUILD_VERSION" ]; then
      echo "Creating tagged copy: dist/KleverDesktop-${CI_COMMIT_TAG}.dmg"
      cp "dist/KleverDesktop-${BUILD_VERSION}.dmg" "dist/KleverDesktop-${CI_COMMIT_TAG}.dmg"
  fi
else
  echo "Running in CI/CD environment, skipping local dist directory copy..."
fi

# Clean up
rm build.properties

echo "Process completed successfully!" 