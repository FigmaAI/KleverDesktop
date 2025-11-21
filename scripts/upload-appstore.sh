#!/bin/bash

# =================================================================
# Klever Desktop - App Store Connect Upload Script
# Following Electron Official Guide
# https://www.electronjs.org/docs/latest/tutorial/mac-app-store-submission-guide
#
# Use Apple Transporter to upload signed PKG to App Store Connect
# =================================================================

set -e # Exit immediately if a command exits with a non-zero status
set -o pipefail # Ensure pipeline failures are caught

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# --- Configuration ---
PKG_FILE="${1:-}"

# --- Helper Functions ---
log_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
  echo -e "${RED}❌ $1${NC}"
}

log_section() {
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

# --- Show Usage ---
show_usage() {
  cat << EOF
Usage: $0 <pkg-file>

Upload a signed PKG file to App Store Connect using altool or Transporter.

Arguments:
  pkg-file          Path to the signed .pkg file

Environment Variables (Required):
  APPLE_ID                    Your Apple ID email
  APPLE_APP_SPECIFIC_PASSWORD App-specific password from appleid.apple.com
  APPLE_TEAM_ID              Your Team ID (e.g., ZQC7QNZ4J8)

Examples:
  # Set environment variables
  export APPLE_ID="your@email.com"
  export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
  export APPLE_TEAM_ID="ZQC7QNZ4J8"

  # Upload
  $0 out/make/pkg/Klever\\ Desktop-2.0.0.pkg

  # Or use .env file
  # source .env.mas  # No longer needed with electron-forge
  $0 out/make/pkg/Klever\\ Desktop-2.0.0.pkg

Alternative:
  Use Transporter app (download from Mac App Store)
  - Simpler UI
  - Better error messages
  - No command line needed

EOF
  exit 1
}

# --- Main Script ---
log_section "📤 Klever Desktop - App Store Connect Upload"

# Check if PKG file provided
if [ -z "$PKG_FILE" ]; then
  log_error "No PKG file specified"
  echo ""
  show_usage
fi

# Check if PKG file exists
if [ ! -f "$PKG_FILE" ]; then
  log_error "PKG file not found: $PKG_FILE"
  exit 1
fi

log_success "PKG file found: $PKG_FILE"
PKG_SIZE=$(du -h "$PKG_FILE" | cut -f1)
log_info "Size: $PKG_SIZE"

# Verify PKG signature
echo ""
log_info "Verifying PKG signature..."
PKG_CHECK_OUTPUT=$(pkgutil --check-signature "$PKG_FILE" 2>&1)
PKG_CHECK_STATUS=$?

if [ $PKG_CHECK_STATUS -eq 0 ]; then
  log_success "PKG signature valid"
  echo "$PKG_CHECK_OUTPUT" | grep -E "(Status|Developer ID|Certificate)" | sed 's/^/   /'
else
  log_error "PKG signature verification FAILED!"
  echo "$PKG_CHECK_OUTPUT" | sed 's/^/   /'
  echo ""
  log_warning "App Store Connect will likely reject this PKG"
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# --- Check Environment Variables ---
echo ""
log_section "🔐 Checking App Store Connect Credentials"

MISSING_VARS=()

if [ -z "${APPLE_ID:-}" ]; then
  MISSING_VARS+=("APPLE_ID")
fi

if [ -z "${APPLE_APP_SPECIFIC_PASSWORD:-}" ]; then
  MISSING_VARS+=("APPLE_APP_SPECIFIC_PASSWORD")
fi

if [ -z "${APPLE_TEAM_ID:-}" ]; then
  MISSING_VARS+=("APPLE_TEAM_ID")
fi

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
  log_error "Missing required environment variables:"
  for var in "${MISSING_VARS[@]}"; do
    echo "   - $var"
  done
  echo ""
  log_info "Set these variables:"
  echo "   export APPLE_ID=\"your@email.com\""
  echo "   export APPLE_APP_SPECIFIC_PASSWORD=\"xxxx-xxxx-xxxx-xxxx\""
  echo "   export APPLE_TEAM_ID=\"YOUR_TEAM_ID\""
  echo ""
  log_info "Or use .env.mas file:"
  echo "   cp .env.mas.example .env.mas"
  echo "   nano .env.mas  # Edit with your values"
  echo "   # source .env.mas  # No longer needed with electron-forge"
  echo ""
  log_info "Generate app-specific password:"
  echo "   https://appleid.apple.com/account/manage"
  echo ""
  log_warning "Alternative: Use Transporter app (no credentials needed in terminal)"
  echo "   Download from Mac App Store: https://apps.apple.com/app/transporter/id1450874784"
  exit 1
fi

log_success "Apple ID: $APPLE_ID"
log_success "Team ID: $APPLE_TEAM_ID"
log_success "App-Specific Password: Set"

# --- Check Upload Tool ---
echo ""
log_section "🔧 Checking Upload Tool"

if ! command -v xcrun &> /dev/null; then
  log_error "xcrun not found - Xcode Command Line Tools not installed"
  exit 1
fi

# Try altool first (deprecated but may still work)
USE_ALTOOL=false
USE_TRANSPORTER=false

log_info "Checking xcrun altool availability..."
if xcrun altool --help &> /dev/null 2>&1; then
  log_success "xcrun altool is available"
  log_warning "Note: altool is deprecated by Apple"
  USE_ALTOOL=true
else
  log_warning "xcrun altool not available (deprecated by Apple)"
fi

# Check for iTMSTransporter (modern alternative)
log_info "Checking iTMSTransporter availability..."
if xcrun iTMSTransporter -h &> /dev/null 2>&1; then
  log_success "iTMSTransporter is available (modern tool)"
  USE_TRANSPORTER=true
else
  log_warning "iTMSTransporter not found"
fi

# Ensure at least one tool is available
if [ "$USE_ALTOOL" = false ] && [ "$USE_TRANSPORTER" = false ]; then
  log_error "No upload tool available"
  log_info "Please use Transporter app from Mac App Store:"
  log_info "https://apps.apple.com/app/transporter/id1450874784"
  exit 1
fi

# Prefer Transporter over altool
if [ "$USE_TRANSPORTER" = true ]; then
  log_success "Will use iTMSTransporter"
  UPLOAD_TOOL="transporter"
else
  log_success "Will use altool (fallback)"
  UPLOAD_TOOL="altool"
fi

# --- Upload to App Store Connect ---
echo ""
log_section "📤 Uploading to App Store Connect"

log_info "This may take several minutes depending on file size..."
echo ""

# Function to upload with retries
upload_with_retry() {
  local max_attempts=3
  local attempt=1
  local wait_time=30

  while [ $attempt -le $max_attempts ]; do
    log_info "Upload attempt $attempt of $max_attempts (using $UPLOAD_TOOL)..."
    echo ""

    # Capture output to check for specific error patterns
    if [ "$UPLOAD_TOOL" = "transporter" ]; then
      # Use iTMSTransporter (modern tool)
      log_info "Using iTMSTransporter..."
      UPLOAD_OUTPUT=$(xcrun iTMSTransporter \
        -m upload \
        -f "$PKG_FILE" \
        -u "$APPLE_ID" \
        -p "$APPLE_APP_SPECIFIC_PASSWORD" \
        -t Signiant \
        -v eXtreme 2>&1 | tee /tmp/transporter_output.log)
      EXIT_CODE=$?
    else
      # Use altool (deprecated)
      log_info "Using altool..."
      UPLOAD_OUTPUT=$(xcrun altool --upload-app \
        --type osx \
        --file "$PKG_FILE" \
        --username "$APPLE_ID" \
        --password "$APPLE_APP_SPECIFIC_PASSWORD" \
        --asc-provider "$APPLE_TEAM_ID" \
        --verbose 2>&1 | tee /tmp/altool_output.log)
      EXIT_CODE=$?
    fi

    # Check for success
    if [ $EXIT_CODE -eq 0 ]; then
      echo ""
      log_success "Upload successful!"
      return 0
    fi

    # Check for duplicate build (treat as success)
    if echo "$UPLOAD_OUTPUT" | grep -q -i "This bundle Identical to\|already been uploaded\|This bundle is invalid.*The bundle uses the same version"; then
      echo ""
      log_warning "Build number already exists in App Store Connect (duplicate build)"
      log_success "Treating as success - you can proceed with the existing build"
      log_info "To upload a new build, increment the build number in forge.config.js"
      return 0
    fi

    # Check for other success patterns
    if echo "$UPLOAD_OUTPUT" | grep -q -i "upload successful\|no errors uploading"; then
      echo ""
      log_success "Upload successful!"
      return 0
    fi

    # Check if error is retryable (not authentication/config issues)
    IS_RETRYABLE=true
    if echo "$UPLOAD_OUTPUT" | grep -q -i "Invalid credentials\|authentication failed\|invalid username or password"; then
      IS_RETRYABLE=false
      log_error "Authentication failed - credentials are invalid"
    elif echo "$UPLOAD_OUTPUT" | grep -q -i "No valid bundle id\|bundle identifier is invalid"; then
      IS_RETRYABLE=false
      log_error "Bundle ID configuration issue"
    fi

    # Retry if appropriate
    if [ "$IS_RETRYABLE" = true ] && [ $attempt -lt $max_attempts ]; then
      log_warning "Upload attempt $attempt failed (exit code: $EXIT_CODE)"
      log_info "This may be a transient error. Waiting ${wait_time}s before retry..."
      sleep $wait_time
      attempt=$((attempt + 1))
      wait_time=$((wait_time * 2)) # Exponential backoff
    else
      # Final attempt failed or non-retryable error
      echo ""
      if [ "$IS_RETRYABLE" = true ]; then
        log_error "Upload failed after $max_attempts attempts (exit code: $EXIT_CODE)"
      else
        log_error "Upload failed with non-retryable error (exit code: $EXIT_CODE)"
      fi
      echo ""

      # Show last output
      log_info "Last upload output:"
      if [ "$UPLOAD_TOOL" = "transporter" ]; then
        tail -30 /tmp/transporter_output.log | sed 's/^/   /'
      else
        tail -30 /tmp/altool_output.log | sed 's/^/   /'
      fi
      echo ""

      log_info "Common issues:"
      echo "   1. Invalid app-specific password"
      echo "      → Generate new at https://appleid.apple.com/account/manage"
      echo ""
      echo "   2. Incorrect Team ID"
      echo "      → Find at https://developer.apple.com/account/#!/membership"
      echo ""
      echo "   3. App not created in App Store Connect"
      echo "      → Create app first at https://appstoreconnect.apple.com"
      echo ""
      echo "   4. Bundle ID mismatch"
      echo "      → Ensure Bundle ID in PKG matches App Store Connect"
      echo ""
      echo "   5. Duplicate build number"
      echo "      → Increment buildVersion in forge.config.js if build already exists"
      echo ""
      echo "   6. altool is deprecated (Apple's tool, not ours)"
      echo "      → Consider migrating to App Store Connect API"
      echo "      → See: https://developer.apple.com/documentation/appstoreconnectapi"
      echo ""
      log_warning "Alternative: Use Transporter app (easier troubleshooting)"
      echo "   1. Download Transporter from Mac App Store"
      echo "   2. Drag '$PKG_FILE' into Transporter"
      echo "   3. Click 'Deliver'"
      echo ""

      return $EXIT_CODE
    fi
  done
}

# Execute upload with retry logic
if upload_with_retry; then
  echo ""
  log_section "🎉 Next Steps"

  echo "1. Wait for processing (5-30 minutes)"
  echo "   - Go to https://appstoreconnect.apple.com"
  echo "   - Select your app"
  echo "   - Check 'Activity' tab for processing status"
  echo ""
  echo "2. Once processed, prepare for submission:"
  echo "   - Go to 'App Store' tab"
  echo "   - Select the build for your version"
  echo "   - Add 'What's New in This Version' text"
  echo "   - Complete App Privacy details if needed"
  echo ""
  echo "3. Submit for Review"
  echo "   - Click 'Submit for Review'"
  echo "   - Apple typically reviews within 24-48 hours"
  echo ""
  echo "4. Monitor status via email or App Store Connect"
  echo ""
else
  exit 1
fi
