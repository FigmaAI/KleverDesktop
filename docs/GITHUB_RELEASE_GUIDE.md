# GitHub Release Distribution Guide

This guide covers how to build, sign, and distribute Klever Desktop via GitHub Releases using Developer ID signing (macOS) and code signing (Windows).

## Overview

We've moved away from App Store distributions (Mac App Store and Microsoft Store) to a more flexible GitHub Releases strategy that provides:

- ✅ Faster release cycles (no store review process)
- ✅ Direct distribution to users
- ✅ Auto-updates via Squirrel (Windows) and built-in updaters
- ✅ Developer ID signing for macOS (no sandbox restrictions)
- ✅ Optional code signing for Windows

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [macOS Distribution](#macos-distribution)
3. [Windows Distribution](#windows-distribution)
4. [Linux Distribution](#linux-distribution)
5. [Building and Publishing](#building-and-publishing)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

- **Node.js** 18+ and npm
- **Git** with GitHub account access
- **Electron Forge** 7.10.2+ (already configured)

### Platform-Specific Requirements

**macOS:**
- Apple Developer account ($99/year)
- Developer ID Application certificate
- Developer ID Installer certificate (optional, for PKG)
- Xcode Command Line Tools

**Windows:**
- Code signing certificate (optional but recommended)
  - Options: DigiCert, Sectigo, Certum Open Source Code Signing
  - Or use GitHub's Sigstore for free signing (experimental)

**Linux:**
- No special requirements (unsigned distribution)

---

## macOS Distribution

### 1. Get Developer ID Certificates

**Option A: Use Xcode (Recommended)**

1. Open Xcode → Preferences → Accounts
2. Add your Apple Developer account
3. Click "Manage Certificates"
4. Click "+" → "Developer ID Application"
5. Xcode will automatically create and install the certificate

**Option B: Use Apple Developer Portal**

1. Go to https://developer.apple.com/account/resources/certificates/list
2. Create "Developer ID Application" certificate
3. Download and install in Keychain Access

**Verify Certificate Installation:**

```bash
security find-identity -v -p codesigning
```

You should see something like:
```
1) ABCDEF1234567890 "Developer ID Application: Your Name (TEAM_ID)"
```

### 2. Set Up Notarization

Apple requires notarization for apps distributed outside the App Store.

**Create App-Specific Password:**

1. Go to https://appleid.apple.com/account/manage
2. Sign in with your Apple ID
3. Under "Security" → "App-Specific Passwords" → Generate
4. Save the password (you'll only see it once)

**Set Environment Variables:**

Add these to your `~/.zshrc` or `~/.bash_profile`:

```bash
export APPLE_ID="your-apple-id@example.com"
export APPLE_ID_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # App-specific password
export APPLE_TEAM_ID="ABCDEF1234"  # 10-character Team ID
```

Reload your shell:
```bash
source ~/.zshrc  # or source ~/.bash_profile
```

**Verify Configuration:**

```bash
echo $APPLE_ID
echo $APPLE_ID_PASSWORD
echo $APPLE_TEAM_ID
```

### 3. Build macOS Package

The build process will automatically:
1. Sign the app with Developer ID
2. Create a DMG installer
3. Notarize the DMG with Apple
4. Staple the notarization ticket

```bash
# Build and package
npm run make -- --platform=darwin

# Output will be in:
# out/make/dmg/darwin/arm64/Klever Desktop-2.0.0-arm64.dmg
# out/make/zip/darwin/arm64/klever-desktop-darwin-arm64-2.0.0.zip
```

**Notarization Process:**

Notarization happens automatically if environment variables are set. The process takes 2-10 minutes:

```
✔ Notarizing Klever Desktop-2.0.0-arm64.dmg
  - Uploading to Apple...
  - Waiting for notarization (this may take a few minutes)...
  - Notarization successful!
  - Stapling ticket to DMG...
```

**Verify Notarization:**

```bash
spctl -a -vv -t install "out/make/dmg/darwin/arm64/Klever Desktop-2.0.0-arm64.dmg"

# Should output:
# accepted
# source=Notarized Developer ID
```

### 4. Troubleshooting macOS Signing

**Problem: "Developer ID Application: not found"**

Solution: Install the certificate in Keychain Access first.

**Problem: Notarization fails with "Invalid credentials"**

Solution:
- Verify environment variables are set correctly
- Ensure you're using an app-specific password, not your Apple ID password
- Check Team ID is correct (10 characters)

**Problem: "Could not find notarization credentials"**

Solution: Ensure all three environment variables are exported in your current shell session.

**Problem: App crashes on launch after signing**

Solution: Check entitlements in `build/entitlements.mac.plist`. Ensure:
- `com.apple.security.cs.allow-jit` is enabled (required for Electron)
- `com.apple.security.cs.allow-unsigned-executable-memory` is enabled
- Sandbox is NOT enabled for Developer ID distribution

---

## Windows Distribution

### 1. Get Code Signing Certificate (Optional)

**Free Option: Certum Open Source Code Signing**

Certum offers free code signing for open-source projects:
1. Apply at https://www.certum.eu/en/cert_offer_code_signing_open_source/
2. Provide GitHub repository link and project details
3. Receive certificate within 1-2 weeks

**Paid Options:**
- DigiCert ($474/year)
- Sectigo ($199/year)
- SignPath (free tier available)

**Without Code Signing:**

You can distribute unsigned Windows apps, but users will see:
- "Windows protected your PC" SmartScreen warning
- "Unknown publisher" in installer

After enough users download and run your app, Windows SmartScreen will build reputation and warnings will decrease.

### 2. Configure Code Signing (Optional)

If you have a certificate, set environment variables:

```bash
# Windows (PowerShell)
$env:WINDOWS_CERT_FILE = "C:\path\to\certificate.pfx"
$env:WINDOWS_CERT_PASSWORD = "certificate-password"

# macOS/Linux (if cross-compiling)
export WINDOWS_CERT_FILE="/path/to/certificate.pfx"
export WINDOWS_CERT_PASSWORD="certificate-password"
```

Uncomment the certificate lines in `forge.config.js`:

```javascript
{
  name: '@electron-forge/maker-squirrel',
  config: {
    // ... other config
    certificateFile: process.env.WINDOWS_CERT_FILE,
    certificatePassword: process.env.WINDOWS_CERT_PASSWORD,
  },
}
```

### 3. Build Windows Package

```bash
# Build on Windows
npm run make -- --platform=win32

# Or cross-compile from macOS/Linux (requires Wine)
npm run make -- --platform=win32 --arch=x64
```

Output files:
```
out/make/squirrel.windows/x64/
├── klever-desktop-2.0.0 Setup.exe     # Installer (distribute this)
├── RELEASES                           # Update metadata
└── klever-desktop-2.0.0-full.nupkg   # Full package (for auto-updates)
```

**Important:** Distribute the `Setup.exe` file to users. Keep `RELEASES` and `.nupkg` files for auto-update functionality.

### 4. Troubleshooting Windows Builds

**Problem: "Wine not found" when cross-compiling**

Solution: Install Wine on macOS/Linux:
```bash
# macOS
brew install --cask wine-stable

# Ubuntu/Debian
sudo apt install wine64
```

**Problem: Builds are slow on Windows**

Solution: Add Windows Defender exclusions for:
- `node_modules/`
- `out/`
- Project directory

**Problem: SmartScreen warnings for users**

Solution:
- Get code signing certificate
- Or wait for SmartScreen reputation to build (requires many downloads)
- Inform users this is expected for new apps

---

## Linux Distribution

### Build Linux Packages

```bash
# Build ZIP archive (portable)
npm run make -- --platform=linux

# Output:
# out/make/zip/linux/x64/klever-desktop-linux-x64-2.0.0.zip
```

**Optional: Create AppImage/DEB/RPM**

To create Linux-specific packages, add makers to `forge.config.js`:

```javascript
// Add to makers array
{
  name: '@electron-forge/maker-deb',
  config: {
    options: {
      maintainer: 'Klever Team',
      homepage: 'https://github.com/FigmaAI/KleverDesktop'
    }
  },
  platforms: ['linux']
},
{
  name: '@electron-forge/maker-rpm',
  config: {
    options: {
      homepage: 'https://github.com/FigmaAI/KleverDesktop'
    }
  },
  platforms: ['linux']
}
```

Install makers:
```bash
npm install --save-dev @electron-forge/maker-deb @electron-forge/maker-rpm
```

---

## Building and Publishing

### 1. Build All Platforms

**On macOS (recommended for multi-platform builds):**

```bash
# macOS DMG + ZIP
npm run make -- --platform=darwin --arch=arm64,x64

# Windows Setup (requires Wine)
npm run make -- --platform=win32 --arch=x64

# Linux ZIP
npm run make -- --platform=linux --arch=x64
```

**On Windows:**

```bash
# Windows only
npm run make -- --platform=win32 --arch=x64
```

**On Linux:**

```bash
# Linux only
npm run make -- --platform=linux --arch=x64
```

### 2. Publish to GitHub Releases

**Prerequisites:**

1. Create GitHub Personal Access Token:
   - Go to https://github.com/settings/tokens
   - Generate new token (classic)
   - Enable scope: `repo` (Full control of private repositories)
   - Copy token

2. Set environment variable:
   ```bash
   export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
   ```

**Publish Release:**

```bash
# Build and publish in one command
npm run publish

# Or manually create release after building
npm run make
# Then upload files from out/make/ to GitHub Releases manually
```

The `publish` command will:
1. Build packages for current platform
2. Create a draft release on GitHub
3. Upload all artifacts
4. Mark release as prerelease (by default)

**Edit the Release:**

1. Go to https://github.com/FigmaAI/KleverDesktop/releases
2. Find your draft release
3. Edit release notes
4. Add changelog
5. Uncheck "This is a pre-release" if it's a stable release
6. Click "Publish release"

### 3. Release Checklist

Before publishing:

- [ ] Update version in `package.json`
- [ ] Update `CHANGELOG.md`
- [ ] Test build locally on each platform
- [ ] Verify code signing (macOS: notarization, Windows: certificate)
- [ ] Test installation on clean machines
- [ ] Verify auto-updates work (after first release)
- [ ] Update documentation if needed
- [ ] Create git tag: `git tag v2.0.0 && git push --tags`

### 4. Auto-Updates Configuration

**Windows (Squirrel):**

Auto-updates are built-in. Users will see update notifications automatically.

**macOS (electron-updater):**

To enable auto-updates, add `electron-updater` (future enhancement):

```bash
npm install electron-updater
```

Configure in main process:
```javascript
const { autoUpdater } = require('electron-updater');

autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'FigmaAI',
  repo: 'KleverDesktop'
});

autoUpdater.checkForUpdatesAndNotify();
```

---

## Troubleshooting

### Build Failures

**Error: "Cannot find module '@electron-forge/maker-dmg'"**

Solution:
```bash
npm install --save-dev @electron-forge/maker-dmg @electron-forge/maker-squirrel @electron-forge/publisher-github
```

**Error: "Python not found"**

Solution: Run Python bundling script:
```bash
npm run python:build
```

### Signing Issues

**macOS: "The application cannot be opened"**

Solution:
- Verify certificate is valid: `security find-identity -v -p codesigning`
- Check entitlements file exists: `build/entitlements.mac.plist`
- Ensure notarization completed successfully

**Windows: "This app might harm your device"**

Solution:
- This is normal for unsigned apps
- Get code signing certificate
- Or inform users to click "More info" → "Run anyway"

### Publishing Issues

**Error: "Not found (404)" when publishing**

Solution:
- Verify repository name and owner in `forge.config.js`
- Check GITHUB_TOKEN has `repo` scope
- Ensure repository exists and you have write access

**Error: "Release already exists"**

Solution:
- Delete the draft release on GitHub
- Or increment version in `package.json`

---

## Next Steps

1. **Set up CI/CD**: Automate builds with GitHub Actions
2. **Configure auto-updates**: Implement electron-updater for seamless updates
3. **Monitor downloads**: Track release downloads via GitHub API
4. **Collect feedback**: Add analytics or feedback mechanisms

---

## Additional Resources

- [Electron Forge Documentation](https://www.electronforge.io/)
- [macOS Code Signing Guide](https://developer.apple.com/support/code-signing/)
- [Windows Code Signing Best Practices](https://docs.microsoft.com/en-us/windows/apps/desktop/modernize/windows-app-sdk-security-and-identity)
- [GitHub Releases API](https://docs.github.com/en/rest/releases)

---

**Last Updated**: 2025-11-23
**Version**: 2.0.0
