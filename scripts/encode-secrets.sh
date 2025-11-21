#!/bin/bash

# =================================================================
# Encode Certificates & Provisioning Profile to Base64
# For GitHub Actions Secrets
# =================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Helper functions
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
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

# Show usage
show_usage() {
  cat << EOF
Usage: $0 <certificate.p12> <installer.p12> <embedded.provisionprofile>

Encode certificates and provisioning profile to Base64 for GitHub Secrets.

Arguments:
  certificate.p12             Apple Distribution certificate (.p12)
  installer.p12               Installer certificate (.p12)
  embedded.provisionprofile   Mac App Store provisioning profile

Example:
  $0 certificate.p12 installer.p12 embedded.provisionprofile

Output:
  - Prints Base64 encoded strings for each file
  - Copy these to GitHub Secrets (Settings → Secrets → Actions)

GitHub Secrets to create:
  - CERTIFICATE_P12_BASE64
  - INSTALLER_CERTIFICATE_P12_BASE64
  - PROVISIONING_PROFILE_BASE64

EOF
  exit 1
}

# Check arguments
if [ "$#" -ne 3 ]; then
  log_error "Invalid number of arguments"
  echo ""
  show_usage
fi

CERT_FILE="$1"
INSTALLER_FILE="$2"
PROFILE_FILE="$3"

log_section "🔐 Encoding Certificates & Provisioning Profile"

# Verify files exist
echo "Checking files..."
MISSING_FILES=()

if [ ! -f "$CERT_FILE" ]; then
  MISSING_FILES+=("$CERT_FILE")
fi

if [ ! -f "$INSTALLER_FILE" ]; then
  MISSING_FILES+=("$INSTALLER_FILE")
fi

if [ ! -f "$PROFILE_FILE" ]; then
  MISSING_FILES+=("$PROFILE_FILE")
fi

if [ ${#MISSING_FILES[@]} -ne 0 ]; then
  log_error "Missing files:"
  for file in "${MISSING_FILES[@]}"; do
    echo "   - $file"
  done
  exit 1
fi

log_success "All files found"
echo ""

# Get file sizes
CERT_SIZE=$(du -h "$CERT_FILE" | cut -f1)
INSTALLER_SIZE=$(du -h "$INSTALLER_FILE" | cut -f1)
PROFILE_SIZE=$(du -h "$PROFILE_FILE" | cut -f1)

echo "File sizes:"
echo "  📄 $CERT_FILE: $CERT_SIZE"
echo "  📄 $INSTALLER_FILE: $INSTALLER_SIZE"
echo "  📄 $PROFILE_FILE: $PROFILE_SIZE"
echo ""

# Encode files
log_section "🔄 Encoding to Base64"

echo "Encoding files (this may take a moment)..."
echo ""

# Encode certificate
CERT_BASE64=$(base64 -i "$CERT_FILE")
log_success "Encoded: $CERT_FILE"

# Encode installer
INSTALLER_BASE64=$(base64 -i "$INSTALLER_FILE")
log_success "Encoded: $INSTALLER_FILE"

# Encode provisioning profile
PROFILE_BASE64=$(base64 -i "$PROFILE_FILE")
log_success "Encoded: $PROFILE_FILE"

# Display results
log_section "📋 GitHub Secrets Configuration"

echo "Copy the following values to GitHub Secrets:"
echo ""
echo -e "${CYAN}Settings → Secrets and variables → Actions → New repository secret${NC}"
echo ""

# Certificate
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Secret Name:${NC} ${YELLOW}CERTIFICATE_P12_BASE64${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "$CERT_BASE64"
echo ""

# Installer
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Secret Name:${NC} ${YELLOW}INSTALLER_CERTIFICATE_P12_BASE64${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "$INSTALLER_BASE64"
echo ""

# Provisioning Profile
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Secret Name:${NC} ${YELLOW}PROVISIONING_PROFILE_BASE64${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "$PROFILE_BASE64"
echo ""

# Additional instructions
log_section "📝 Additional Secrets Required"

echo "Don't forget to also add these secrets:"
echo ""
echo -e "  ${YELLOW}CERTIFICATE_PASSWORD${NC}"
echo "    → Password you used when exporting certificate.p12"
echo ""
echo -e "  ${YELLOW}INSTALLER_CERTIFICATE_PASSWORD${NC}"
echo "    → Password you used when exporting installer.p12"
echo ""
echo -e "  ${YELLOW}APPLE_ID${NC}"
echo "    → Your Apple ID email (e.g., your@email.com)"
echo ""
echo -e "  ${YELLOW}APPLE_APP_SPECIFIC_PASSWORD${NC}"
echo "    → Generate at https://appleid.apple.com/account/manage"
echo ""
echo -e "  ${YELLOW}APPLE_TEAM_ID${NC}"
echo "    → Find at https://developer.apple.com/account/#!/membership"
echo ""
echo -e "  ${YELLOW}CSC_NAME${NC}"
echo "    → Run: security find-identity -v -p codesigning"
echo "    → Copy 'Apple Distribution: Your Name (TEAM_ID)'"
echo ""
echo -e "  ${YELLOW}CSC_INSTALLER_NAME${NC}"
echo "    → Run: security find-identity -v -p codesigning"
echo "    → Copy '3rd Party Mac Developer Installer: Your Name (TEAM_ID)'"
echo ""

# Security warning
log_section "🔒 Security Notice"

log_warning "IMPORTANT: Delete local certificate and profile files after uploading to GitHub"
echo ""
echo "  Once you've added these to GitHub Secrets, you can safely delete:"
echo "    - $CERT_FILE"
echo "    - $INSTALLER_FILE"
echo "    - $PROFILE_FILE"
echo ""
echo "  These files contain sensitive information and should not be committed to git."
echo ""

# Completion
log_section "✅ Encoding Complete"

echo "Next steps:"
echo "  1. Copy each Base64 value above to GitHub Secrets"
echo "  2. Add the additional secrets listed above"
echo "  3. Delete local certificate and profile files"
echo "  4. Test the workflow: GitHub Actions → Run workflow"
echo ""
