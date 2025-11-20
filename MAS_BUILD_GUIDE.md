# Mac App Store Build Guide

Complete guide for building and distributing Klever Desktop on the Mac App Store.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Certificate Setup](#certificate-setup)
- [Provisioning Profile](#provisioning-profile)
- [Understanding the Build Process](#understanding-the-build-process)
- [Building for MAS](#building-for-mas)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### 1. Apple Developer Account

- Enrolled in [Apple Developer Program](https://developer.apple.com/programs/) ($99/year)
- Consider [Small Business Program](https://developer.apple.com/app-store/small-business-program/) to reduce commission from 30% to 15%

### 2. Required Tools

- **macOS 12+** (Monterey or later)
- **Xcode** with Command Line Tools
- **Node.js 18+**
- **Python 3.11+** (for bundled runtime)

### 3. App Store Connect Setup

1. Create app entry at [App Store Connect](https://appstoreconnect.apple.com)
2. Set Bundle ID matching `package.json`: `com.klever.desktop`
3. Prepare marketing materials (screenshots, description, privacy policy)

---

## Certificate Setup

### Required Certificates

You need **THREE** certificates for MAS distribution:

#### 1. Apple Development (for local testing)

- **Purpose**: Sign mas-dev builds for testing on registered devices
- **Name**: `Apple Development: Your Name (TEAM_ID)`
- **Usage**: Local testing only, not for submission

#### 2. Apple Distribution (for App Store)

- **Purpose**: Sign the .app bundle for Mac App Store
- **Name**: `Apple Distribution: Your Name (TEAM_ID)` or `3rd Party Mac Developer Application: Your Name (TEAM_ID)`
- **Usage**: Electron-builder uses this to sign all binaries inside .app

#### 3. Mac Installer Distribution (for .pkg)

- **Purpose**: Sign the .pkg installer package
- **Name**: `Mac Installer Distribution: Your Name (TEAM_ID)` or `3rd Party Mac Developer Installer: Your Name (TEAM_ID)`
- **Usage**: Electron-builder **automatically** finds this in Keychain to sign .pkg

### How to Create Certificates

#### Option 1: Using Xcode (Recommended)

1. Open Xcode → Settings → Accounts
2. Select your Apple ID → Select Team
3. Click "Manage Certificates..."
4. Click "+" → Select certificate types:
   - Apple Development
   - Apple Distribution
   - Mac Installer Distribution
5. Certificates will be automatically created and added to Keychain

#### Option 2: Using Keychain Access

1. Open Keychain Access
2. Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority
3. Enter your email, select "Saved to disk"
4. Go to [Apple Developer - Certificates](https://developer.apple.com/account/resources/certificates)
5. Click "+" → Select certificate type → Upload CSR
6. Download and double-click to install in Keychain

### Verify Certificates

```bash
# List all code signing identities
security find-identity -v -p codesigning

# Expected output should include:
# 1) ABC123... "Apple Distribution: Your Name (TEAM_ID)"
# 2) DEF456... "Mac Installer Distribution: Your Name (TEAM_ID)"
```

---

## Provisioning Profile

### 1. Create App ID

1. Go to [Certificates, IDs & Profiles](https://developer.apple.com/account/resources/identifiers)
2. Click "+" → Select "App IDs" → Continue
3. Select "App" type
4. Configure:
   - **Description**: Klever Desktop
   - **Bundle ID**: `com.klever.desktop` (Explicit)
   - **Capabilities**: Enable as needed (e.g., Network Extensions)
5. Click "Continue" → "Register"

### 2. Generate Provisioning Profiles

You need **TWO** provisioning profiles:

#### Development Profile (for testing)

1. Click "+" → Select "macOS App Development"
2. Select App ID: `com.klever.desktop`
3. Select "Apple Development" certificate
4. Select development devices (Mac Hardware UUIDs)
5. Name it: `Klever Desktop Development`
6. Download → Rename to `AppleDevelopment.provisionprofile`
7. Place in `build/` directory

#### Distribution Profile (for submission)

1. Click "+" → Select "Mac App Store"
2. Select App ID: `com.klever.desktop`
3. Select "Apple Distribution" certificate
4. Name it: `Klever Desktop Distribution`
5. Download → **Rename to `embedded.provisionprofile`**
6. **Place in `build/` directory**

### Provisioning Profile Locations

```
KleverDesktop/
├── build/
│   ├── embedded.provisionprofile        ← Distribution (REQUIRED)
│   ├── AppleDevelopment.provisionprofile ← Development (optional)
│   ├── entitlements.mas.plist           ← Main entitlements
│   └── entitlements.mas.inherit.plist   ← Child process entitlements
```

**IMPORTANT**: The production provisioning profile **MUST** be named `embedded.provisionprofile` and placed in the `build/` directory.

---

## Understanding the Build Process

### Electron-Builder Signing Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Build Electron App (React + TypeScript)                 │
│    → npm run build                                          │
│    → Outputs: dist/ and dist-electron/                      │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│ 2. Package .app Bundle                                      │
│    → electron-builder copies files into .app structure      │
│    → Embeds provisioning profile                            │
│    → Applies entitlements                                   │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│ 3. Sign All Binaries with "Apple Distribution"             │
│    → Main app binary: Klever Desktop.app/Contents/MacOS/... │
│    → Electron Framework                                     │
│    → Helper processes (GPU, Renderer, Plugin)               │
│    → All .dylib, .so files                                  │
│    Certificate: Auto-detected from Keychain                 │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│ 4. afterSign Hook (scripts/afterSign.js)                   │
│    → Re-sign bundled Python runtime                         │
│    → Re-sign all .so/.dylib in Python site-packages         │
│    → Required because Python binaries need app signature    │
│    Certificate: Uses CSC_NAME environment variable          │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│ 5. Create .pkg Installer                                    │
│    → electron-builder wraps .app in .pkg                    │
│    → Signs .pkg with "Mac Installer Distribution"           │
│    Certificate: Auto-detected from Keychain                 │
│    Output: dist-electron/mas/Klever Desktop-2.0.0.pkg       │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│ 6. Verification                                             │
│    → codesign --verify --deep --strict                      │
│    → pkgutil --check-signature                              │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│ 7. Upload to App Store Connect                             │
│    → xcrun altool --upload-app                              │
│    → Or use Transporter app                                 │
└─────────────────────────────────────────────────────────────┘
```

### Why afterSign.js is Critical

Electron-builder signs all binaries it knows about, but **Python's bundled runtime** contains hundreds of `.so` and `.dylib` files that need signing:

- `python3.11` executable
- Standard library `.so` files (e.g., `_ssl.cpython-311-darwin.so`)
- Third-party packages (Playwright, Ollama, etc.)

**Without afterSign.js**: Apple's validation will **reject** the app due to unsigned binaries.

**With afterSign.js**: All Python binaries are re-signed with the same "Apple Distribution" certificate, ensuring consistency.

---

## Building for MAS

### Quick Start

#### 1. Set Up Environment Variables

```bash
# Copy template
cp .env.mas.example .env.mas

# Edit with your values
nano .env.mas

# Load variables
source .env.mas
```

Required variables:
- `APPLE_ID`: Your Apple ID email
- `APPLE_ID_PASSWORD`: App-specific password from [appleid.apple.com](https://appleid.apple.com)
- `APPLE_TEAM_ID`: Your Team ID (e.g., `ZQC7QNZ4J8`)

#### 2. Run the Build Script

```bash
# Full build and upload
./build-appstore.sh

# Build only (skip upload)
./build-appstore.sh --skip-upload

# Use existing build (upload only)
./build-appstore.sh --skip-build
```

### Manual Build Steps

If you prefer manual control:

#### 1. Install Dependencies

```bash
npm install
# or
yarn install
```

#### 2. Build Python Runtime (if not done)

```bash
node scripts/build-python.js --platform darwin-arm64
# or for Intel Macs:
node scripts/build-python.js --platform darwin-x64
```

#### 3. Build Electron App

```bash
npm run build
# or
yarn build
```

#### 4. Package for MAS

```bash
# Export signing identity
export CSC_NAME="Apple Distribution: Your Name (TEAM_ID)"

# Build with electron-builder
npm run package -- --mac mas
# or
yarn package --mac mas
```

#### 5. Verify Signatures

```bash
# Verify app
codesign --verify --deep --strict --verbose=2 \
  "dist-electron/mas/Klever Desktop.app"

# Display app signature
codesign --display --verbose=4 \
  "dist-electron/mas/Klever Desktop.app"

# Verify pkg
pkgutil --check-signature \
  "dist-electron/mas/Klever Desktop-2.0.0.pkg"
```

#### 6. Upload to App Store

```bash
xcrun altool --upload-app \
  --type osx \
  --file "dist-electron/mas/Klever Desktop-2.0.0.pkg" \
  --username "$APPLE_ID" \
  --password "$APPLE_ID_PASSWORD" \
  --asc-provider "$APPLE_TEAM_ID" \
  --verbose
```

### Alternative: Transporter App

1. Download [Transporter](https://apps.apple.com/app/transporter/id1450874784) from Mac App Store
2. Drag the `.pkg` file into Transporter
3. Click "Deliver"
4. Wait for validation (5-30 minutes)

---

## Troubleshooting

### ❌ "No identity found" error

**Problem**: electron-builder can't find signing certificate

**Solution**:
```bash
# List available certificates
security find-identity -v -p codesigning

# Manually set certificate
export CSC_NAME="Apple Distribution: Your Name (TEAM_ID)"
```

### ❌ PKG signature verification fails

**Problem**: `.pkg` file is not signed or signed with wrong certificate

**Causes**:
1. "Mac Installer Distribution" certificate not in Keychain
2. Multiple certificates with same name (check expiration dates)

**Solution**:
```bash
# Check for installer certificates
security find-identity -v -p codesigning | grep "Installer"

# Remove expired certificates
# Keychain Access → Login → Certificates → Delete expired ones

# Re-run build
./build-appstore.sh
```

### ❌ "Invalid provisioning profile" error

**Problem**: Provisioning profile doesn't match Bundle ID or certificates

**Solution**:
1. Verify Bundle ID in provisioning profile matches `com.klever.desktop`
2. Regenerate provisioning profile with correct App ID
3. Download and replace `build/embedded.provisionprofile`
4. Clean and rebuild:
   ```bash
   rm -rf dist-electron/mas
   ./build-appstore.sh
   ```

### ❌ "App crashes on launch" (MAS build)

**Expected Behavior**: MAS distribution builds **CANNOT** run on local machines without special entitlements. This is normal!

**Testing**:
- Use `mas-dev` target for local testing
- Or install through TestFlight

**Build mas-dev version**:
```bash
# In package.json, temporarily change:
"mas": {
  "type": "development",  // ← Change from "distribution"
  "provisioningProfile": "build/AppleDevelopment.provisionprofile"
}

# Build
npm run package -- --mac mas-dev

# Test
open "dist-electron/mas-dev/Klever Desktop.app"
```

### ❌ "Python not found" in packaged app

**Problem**: Python runtime not bundled or not signed

**Solution**:
1. Check Python is bundled:
   ```bash
   ls -la "dist-electron/mas/Klever Desktop.app/Contents/Resources/extraResources/python"
   ```

2. Check afterSign.js ran:
   ```bash
   # Look for "Post-build code signing complete" in build output
   ```

3. Manually verify Python signature:
   ```bash
   codesign --verify --verbose=2 \
     "dist-electron/mas/Klever Desktop.app/Contents/Resources/extraResources/python/darwin-arm64/python/bin/python3"
   ```

### ❌ Upload fails with "Invalid App Store Icon"

**Problem**: icon.icns not in correct format

**Solution**:
```bash
# Verify icon exists
ls -la build/icon.icns

# If missing, create from PNG:
mkdir icon.iconset
# Add icon files: icon_16x16.png, icon_32x32.png, etc.
iconutil -c icns icon.iconset -o build/icon.icns
```

### ⚠️ "cs.allow-jit" entitlement warning

**Problem**: Apple may warn about `com.apple.security.cs.allow-jit` entitlement

**Explanation**: This is **required** for Python and Playwright to work in App Sandbox. Document this in App Review notes:

```
This app bundles a Python runtime for AI model integration and browser automation.
The following entitlements are required for core functionality:
- com.apple.security.cs.allow-jit: Python JIT compilation
- com.apple.security.cs.allow-unsigned-executable-memory: Chromium (Playwright)
- com.apple.security.cs.disable-library-validation: Third-party Python packages
```

### 🔍 Debug Mode

Enable verbose output:

```bash
export DEBUG=electron-builder
./build-appstore.sh
```

---

## Additional Resources

- [Electron Mac App Store Submission Guide](https://www.electronjs.org/docs/latest/tutorial/mac-app-store-submission-guide)
- [electron-builder Documentation](https://www.electron.build/)
- [Apple Code Signing Guide](https://developer.apple.com/support/code-signing/)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [App Sandbox Entitlements](https://developer.apple.com/documentation/bundleresources/entitlements)

---

## Next Steps After Upload

1. **Wait for Processing** (5-30 minutes)
   - Go to [App Store Connect](https://appstoreconnect.apple.com)
   - Select your app
   - Check "Activity" tab for processing status

2. **Select Build**
   - Once processed, go to "App Store" tab
   - Select the build for your version
   - Add "What's New in This Version" text

3. **Submit for Review**
   - Complete App Information (if first submission)
   - Add screenshots for all required sizes
   - Fill in App Privacy details
   - Click "Submit for Review"

4. **Review Process**
   - Apple typically reviews within 24-48 hours
   - Check email for status updates
   - Respond to any questions promptly

5. **Release**
   - Once approved, choose release option:
     - Automatic release
     - Manual release on specific date
   - Monitor reviews and crash reports

---

**Good luck with your Mac App Store submission! 🚀**
