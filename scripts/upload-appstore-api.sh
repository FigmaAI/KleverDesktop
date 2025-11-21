#!/bin/bash

# =================================================================
# Klever Desktop - App Store Connect Upload Script (API Version)
# Using App Store Connect API instead of deprecated altool
# =================================================================

set -e
set -o pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Helper Functions
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_section() {
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

# Configuration
PKG_FILE="${1:-}"

# Show Usage
show_usage() {
  cat << EOF
Usage: $0 <pkg-file>

Upload PKG to App Store Connect using App Store Connect API (not deprecated altool).

Arguments:
  pkg-file          Path to the signed .pkg file

Environment Variables (Required):
  APP_STORE_CONNECT_API_KEY_PATH    Path to .p8 API key file
  APP_STORE_CONNECT_API_KEY_ID      Key ID (e.g., ABC123XYZ)
  APP_STORE_CONNECT_API_ISSUER_ID   Issuer ID (UUID format)

Setup Instructions:
  1. Create API Key in App Store Connect:
     - Go to https://appstoreconnect.apple.com/access/api
     - Click '+' to create new key
     - Select 'App Manager' or 'Developer' role
     - Download .p8 key file (SAVE IT - can't download again!)
     - Note the Key ID and Issuer ID

  2. Save key securely:
     mkdir -p ~/.appstoreconnect/private_keys
     mv ~/Downloads/AuthKey_ABC123XYZ.p8 ~/.appstoreconnect/private_keys/

  3. Set environment variables:
     export APP_STORE_CONNECT_API_KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_ABC123XYZ.p8"
     export APP_STORE_CONNECT_API_KEY_ID="ABC123XYZ"
     export APP_STORE_CONNECT_API_ISSUER_ID="your-issuer-uuid"

  4. Run:
     $0 out/make/Klever\\ Desktop-2.0.0.pkg

EOF
  exit 1
}

# Main Script
log_section "📤 Klever Desktop - App Store Connect Upload (API)"

# Check PKG file
if [ -z "$PKG_FILE" ]; then
  log_error "No PKG file specified"
  echo ""
  show_usage
fi

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
if pkgutil --check-signature "$PKG_FILE" > /dev/null 2>&1; then
  log_success "PKG signature valid"
else
  log_error "PKG signature verification FAILED!"
  exit 1
fi

# Check Environment Variables
echo ""
log_section "🔐 Checking App Store Connect API Credentials"

MISSING_VARS=()

if [ -z "${APP_STORE_CONNECT_API_KEY_PATH:-}" ]; then
  MISSING_VARS+=("APP_STORE_CONNECT_API_KEY_PATH")
fi

if [ -z "${APP_STORE_CONNECT_API_KEY_ID:-}" ]; then
  MISSING_VARS+=("APP_STORE_CONNECT_API_KEY_ID")
fi

if [ -z "${APP_STORE_CONNECT_API_ISSUER_ID:-}" ]; then
  MISSING_VARS+=("APP_STORE_CONNECT_API_ISSUER_ID")
fi

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
  log_error "Missing required environment variables:"
  for var in "${MISSING_VARS[@]}"; do
    echo "   - $var"
  done
  echo ""
  log_info "See setup instructions above (run with --help)"
  exit 1
fi

# Verify API key file exists
if [ ! -f "$APP_STORE_CONNECT_API_KEY_PATH" ]; then
  log_error "API key file not found: $APP_STORE_CONNECT_API_KEY_PATH"
  exit 1
fi

log_success "API Key ID: $APP_STORE_CONNECT_API_KEY_ID"
log_success "Issuer ID: $APP_STORE_CONNECT_API_ISSUER_ID"
log_success "API Key File: $APP_STORE_CONNECT_API_KEY_PATH"

# Check if notarytool is available (requires Xcode 13+)
echo ""
log_section "🔧 Checking Upload Tool"

if ! command -v xcrun &> /dev/null; then
  log_error "xcrun not found - Xcode Command Line Tools not installed"
  exit 1
fi

# Use notarytool for upload (modern approach)
log_info "Using xcrun notarytool with App Store Connect API..."

# Upload to App Store Connect
echo ""
log_section "📤 Uploading to App Store Connect"

log_info "This may take several minutes..."
echo ""

upload_with_retry() {
  local max_attempts=3
  local attempt=1
  local wait_time=30

  while [ $attempt -le $max_attempts ]; do
    log_info "Upload attempt $attempt of $max_attempts..."
    echo ""

    # Use notarytool store-credentials to setup keychain profile, then submit
    # First, store credentials (creates a profile named "AC_PASSWORD")
    if [ $attempt -eq 1 ]; then
      log_info "Setting up API credentials..."
      echo "$APP_STORE_CONNECT_API_KEY_ID" | xcrun notarytool store-credentials "AC_API_KEY" \
        --key "$APP_STORE_CONNECT_API_KEY_PATH" \
        --key-id "$APP_STORE_CONNECT_API_KEY_ID" \
        --issuer "$APP_STORE_CONNECT_API_ISSUER_ID" 2>&1 || true
    fi

    # Submit to App Store Connect using notarytool
    # Note: notarytool submit is for notarization, not App Store upload
    # We need to use altool's replacement: xcrun notarytool OR Transporter

    # Actually, for App Store uploads, we should use Transporter CLI
    if command -v iTMSTransporter &> /dev/null; then
      log_info "Using iTMSTransporter (Transporter CLI)..."

      UPLOAD_OUTPUT=$(iTMSTransporter \
        -m upload \
        -f "$PKG_FILE" \
        -apiKey "$APP_STORE_CONNECT_API_KEY_ID" \
        -apiIssuer "$APP_STORE_CONNECT_API_ISSUER_ID" \
        -jwt "$APP_STORE_CONNECT_API_KEY_PATH" \
        -t Signiant \
        -v eXtreme 2>&1 | tee /tmp/transporter_output.log)
      EXIT_CODE=$?
    else
      log_error "iTMSTransporter not found"
      log_info "Looking for alternative upload method..."

      # Try xcrun iTMSTransporter
      UPLOAD_OUTPUT=$(xcrun iTMSTransporter \
        -m upload \
        -f "$PKG_FILE" \
        -apiKey "$APP_STORE_CONNECT_API_KEY_ID" \
        -apiIssuer "$APP_STORE_CONNECT_API_ISSUER_ID" \
        -jwt "$APP_STORE_CONNECT_API_KEY_PATH" \
        -t Signiant \
        -v eXtreme 2>&1 | tee /tmp/transporter_output.log)
      EXIT_CODE=$?
    fi

    # Check for success
    if [ $EXIT_CODE -eq 0 ]; then
      echo ""
      log_success "Upload successful!"
      return 0
    fi

    # Check for duplicate build
    if echo "$UPLOAD_OUTPUT" | grep -q -i "This bundle Identical to\|already been uploaded\|same version"; then
      echo ""
      log_warning "Build already exists in App Store Connect"
      log_success "Treating as success"
      return 0
    fi

    # Retry logic
    if [ $attempt -lt $max_attempts ]; then
      log_warning "Upload failed (exit code: $EXIT_CODE)"
      log_info "Retrying in ${wait_time}s..."
      sleep $wait_time
      attempt=$((attempt + 1))
      wait_time=$((wait_time * 2))
    else
      echo ""
      log_error "Upload failed after $max_attempts attempts"
      log_info "Last output:"
      tail -50 /tmp/transporter_output.log | sed 's/^/   /'
      return $EXIT_CODE
    fi
  done
}

# Execute upload
if upload_with_retry; then
  echo ""
  log_section "🎉 Success!"
  echo "Build uploaded to App Store Connect"
  echo ""
  echo "Next steps:"
  echo "  1. Wait 5-30 minutes for processing"
  echo "  2. Check https://appstoreconnect.apple.com"
  echo "  3. Submit for review when ready"
  echo ""
else
  exit 1
fi
