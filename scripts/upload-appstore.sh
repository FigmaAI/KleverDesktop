#!/bin/bash

# =================================================================
# Klever Desktop - App Store Connect Upload Script
# Using App Store Connect API Key (Modern Method)
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

Upload a signed PKG file to App Store Connect using API Key.

Arguments:
  pkg-file          Path to the signed .pkg file

Environment Variables (Option 1 - API Key, Recommended):
  APPSTORE_API_KEY_BASE64    App Store Connect API Key (Base64 encoded .p8 file)
  APPSTORE_API_KEY_ID        API Key ID (10 characters)
  APPSTORE_API_ISSUER_ID     Issuer ID (UUID format)

Environment Variables (Option 2 - Apple ID, Legacy):
  APPLE_ID                   Your Apple ID email
  APPLE_APP_SPECIFIC_PASSWORD App-specific password
  APPLE_TEAM_ID              Your Team ID

Examples:
  # Using API Key (recommended)
  export APPSTORE_API_KEY_BASE64="LS0tLS1CRUdJTi..."
  export APPSTORE_API_KEY_ID="AB12CD34EF"
  export APPSTORE_API_ISSUER_ID="12345678-1234-1234-1234-123456789abc"
  $0 out/make/klever-desktop-2.0.0-universal.pkg

  # Using Apple ID (legacy, not recommended)
  export APPLE_ID="your@email.com"
  export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
  export APPLE_TEAM_ID="ZQC7QNZ4J8"
  $0 out/make/klever-desktop-2.0.0-universal.pkg

EOF
  exit 1
}

# --- Main Script ---
log_section "📤 Klever Desktop - App Store Connect Upload (API Key Method)"

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

# --- Check Authentication Method ---
echo ""
log_section "🔐 Checking Authentication Method"

USE_API_KEY=false
USE_APPLE_ID=false

# Check for API Key credentials (preferred)
if [ -n "${APPSTORE_API_KEY_BASE64:-}" ] && [ -n "${APPSTORE_API_KEY_ID:-}" ] && [ -n "${APPSTORE_API_ISSUER_ID:-}" ]; then
  log_success "API Key credentials found (modern method)"
  USE_API_KEY=true

  # Decode and save API Key to standard location (altool expects it here)
  API_KEY_DIR="$HOME/.private_keys"
  mkdir -p "$API_KEY_DIR"
  API_KEY_FILE="$API_KEY_DIR/AuthKey_${APPSTORE_API_KEY_ID}.p8"
  echo "$APPSTORE_API_KEY_BASE64" | base64 --decode > "$API_KEY_FILE"

  if [ -f "$API_KEY_FILE" ]; then
    log_success "API Key decoded successfully"
    log_info "Key ID: $APPSTORE_API_KEY_ID"
    log_info "Issuer ID: ${APPSTORE_API_ISSUER_ID:0:8}...${APPSTORE_API_ISSUER_ID: -4}"
    log_info "Saved to: ~/.private_keys/AuthKey_${APPSTORE_API_KEY_ID}.p8"
  else
    log_error "Failed to decode API Key"
    rm -f "$API_KEY_FILE"
    exit 1
  fi
fi

# Check for Apple ID credentials (fallback)
if [ "$USE_API_KEY" = false ]; then
  if [ -n "${APPLE_ID:-}" ] && [ -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" ] && [ -n "${APPLE_TEAM_ID:-}" ]; then
    log_warning "Using Apple ID credentials (legacy method)"
    log_warning "Consider migrating to API Key for better reliability"
    USE_APPLE_ID=true
    log_success "Apple ID: $APPLE_ID"
    log_success "Team ID: $APPLE_TEAM_ID"
  fi
fi

# Ensure at least one method is available
if [ "$USE_API_KEY" = false ] && [ "$USE_APPLE_ID" = false ]; then
  log_error "No authentication credentials found"
  echo ""
  log_info "Please set one of the following:"
  echo ""
  echo "Option 1 (Recommended): API Key"
  echo "   export APPSTORE_API_KEY_BASE64=\"...\""
  echo "   export APPSTORE_API_KEY_ID=\"AB12CD34EF\""
  echo "   export APPSTORE_API_ISSUER_ID=\"12345678-1234-...\""
  echo ""
  echo "Option 2 (Legacy): Apple ID"
  echo "   export APPLE_ID=\"your@email.com\""
  echo "   export APPLE_APP_SPECIFIC_PASSWORD=\"xxxx-xxxx-xxxx-xxxx\""
  echo "   export APPLE_TEAM_ID=\"YOUR_TEAM_ID\""
  echo ""
  exit 1
fi

# --- Check Upload Tool ---
echo ""
log_section "🔧 Checking Upload Tool"

if ! command -v xcrun &> /dev/null; then
  log_error "xcrun not found - Xcode Command Line Tools not installed"
  exit 1
fi

# Check for notarytool (modern, but mainly for notarization)
if xcrun notarytool --help &> /dev/null 2>&1; then
  log_success "notarytool is available"
fi

# Check for altool (will use with --apiKey option)
if xcrun altool --help &> /dev/null 2>&1; then
  log_success "altool is available (will use with API Key)"
else
  log_error "altool not found"
  log_info "Please ensure Xcode Command Line Tools are properly installed"
  exit 1
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
    log_info "Upload attempt $attempt of $max_attempts..."
    echo ""

    # Build upload command based on authentication method
    if [ "$USE_API_KEY" = true ]; then
      # Use API Key method (modern, stable)
      log_info "Using API Key authentication..."
      UPLOAD_OUTPUT=$(xcrun altool --upload-app \
        --type osx \
        --file "$PKG_FILE" \
        --apiKey "$APPSTORE_API_KEY_ID" \
        --apiIssuer "$APPSTORE_API_ISSUER_ID" \
        --verbose 2>&1 | tee /tmp/upload_output.log)
      EXIT_CODE=$?
    else
      # Use Apple ID method (legacy)
      log_info "Using Apple ID authentication (legacy)..."
      log_warning "This method is less reliable - consider migrating to API Key"
      UPLOAD_OUTPUT=$(xcrun altool --upload-app \
        --type osx \
        --file "$PKG_FILE" \
        --username "$APPLE_ID" \
        --password "$APPLE_APP_SPECIFIC_PASSWORD" \
        --asc-provider "$APPLE_TEAM_ID" \
        --verbose 2>&1 | tee /tmp/upload_output.log)
      EXIT_CODE=$?
    fi

    # Check for success
    if [ $EXIT_CODE -eq 0 ]; then
      echo ""
      log_success "Upload successful!"

      # Cleanup API Key file if used
      if [ "$USE_API_KEY" = true ] && [ -f "$API_KEY_FILE" ]; then
        rm -f "$API_KEY_FILE"
        log_info "Cleaned up API Key file"
      fi

      return 0
    fi

    # Check for duplicate build (treat as success)
    if echo "$UPLOAD_OUTPUT" | grep -q -i "This bundle Identical to\|already been uploaded\|This bundle is invalid.*The bundle uses the same version"; then
      echo ""
      log_warning "Build number already exists in App Store Connect (duplicate build)"
      log_success "Treating as success - you can proceed with the existing build"
      log_info "To upload a new build, increment the build number in forge.config.js"

      # Cleanup API Key file if used
      if [ "$USE_API_KEY" = true ] && [ -f "$API_KEY_FILE" ]; then
        rm -f "$API_KEY_FILE"
        log_info "Cleaned up API Key file"
      fi

      return 0
    fi

    # Check for other success patterns
    if echo "$UPLOAD_OUTPUT" | grep -q -i "upload successful\|no errors uploading"; then
      echo ""
      log_success "Upload successful!"

      # Cleanup API Key file if used
      if [ "$USE_API_KEY" = true ] && [ -f "$API_KEY_FILE" ]; then
        rm -f "$API_KEY_FILE"
        log_info "Cleaned up API Key file"
      fi

      return 0
    fi

    # Check if error is retryable
    IS_RETRYABLE=true
    if echo "$UPLOAD_OUTPUT" | grep -q -i "Invalid credentials\|authentication failed\|invalid api key\|invalid issuer"; then
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
      tail -30 /tmp/upload_output.log | sed 's/^/   /'
      echo ""

      log_info "Common issues:"
      echo "   1. Invalid API Key credentials"
      echo "      → Verify Key ID and Issuer ID in GitHub Secrets"
      echo "      → Ensure API Key file is correctly Base64 encoded"
      echo ""
      echo "   2. Bundle ID mismatch"
      echo "      → Ensure Bundle ID in PKG matches App Store Connect"
      echo ""
      echo "   3. Duplicate build number"
      echo "      → Increment buildVersion in forge.config.js"
      echo ""
      echo "   4. Network/timeout issues"
      echo "      → Retry the upload"
      echo ""

      # Cleanup API Key file if used
      if [ "$USE_API_KEY" = true ] && [ -f "$API_KEY_FILE" ]; then
        rm -f "$API_KEY_FILE"
        log_info "Cleaned up API Key file"
      fi

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
