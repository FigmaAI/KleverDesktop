#!/bin/bash

# =================================================================
# Klever Desktop - App Store Connect Upload Script
# Following Electron Official Guide
# https://www.electronjs.org/docs/latest/tutorial/mac-app-store-submission-guide
#
# Use Apple Transporter to upload signed PKG to App Store Connect
# =================================================================

set -e # Exit immediately if a command exits with a non-zero status

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
  $0 dist-electron/mas/Klever\\ Desktop-2.0.0.pkg

  # Or use .env file
  source .env.mas
  $0 dist-electron/mas/Klever\\ Desktop-2.0.0.pkg

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
  echo "   source .env.mas"
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

# --- Upload to App Store Connect ---
echo ""
log_section "📤 Uploading to App Store Connect"

log_info "This may take several minutes depending on file size..."
echo ""

# Use altool (works with app-specific password)
log_info "Using xcrun altool..."

# Try upload
if xcrun altool --upload-app \
  --type osx \
  --file "$PKG_FILE" \
  --username "$APPLE_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --asc-provider "$APPLE_TEAM_ID" \
  --verbose; then

  echo ""
  log_success "Upload successful!"

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
  EXIT_CODE=$?
  echo ""
  log_error "Upload failed (exit code: $EXIT_CODE)"
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
  log_warning "Alternative: Use Transporter app (easier troubleshooting)"
  echo "   1. Download Transporter from Mac App Store"
  echo "   2. Drag '$PKG_FILE' into Transporter"
  echo "   3. Click 'Deliver'"
  echo ""
  exit $EXIT_CODE
fi
