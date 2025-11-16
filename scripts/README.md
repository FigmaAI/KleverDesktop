# Klever Desktop Build Scripts

This folder contains build scripts for packaging and distributing Klever Desktop (Electron app) on macOS and Windows.

## 📋 Available Scripts

### 🍎 macOS Builds

#### 1. `build-appstore.sh` - Mac App Store Build

Creates a signed `.pkg` file for Mac App Store submission.

**Usage:**
```bash
./scripts/build-appstore.sh
```

**Requirements:**
- macOS
- Xcode Command Line Tools
- Apple Developer account
- **3rd Party Mac Developer Application** certificate
- **3rd Party Mac Developer Installer** certificate

**Environment Variables:**
```bash
export CSC_NAME="3rd Party Mac Developer Application: Your Name (TEAM_ID)"
export CSC_INSTALLER_NAME="3rd Party Mac Developer Installer: Your Name (TEAM_ID)"
export APPLE_ID="your-apple-id@email.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="YOUR_TEAM_ID"
```

**Output:**
- `dist-electron/mas/Klever Desktop-{version}.pkg` - Mac App Store package
- `dist-electron/mas/Klever Desktop.app` - Signed app bundle

---

#### 2. `build-mac.sh` - Standard Mac Distribution

Creates DMG and ZIP files for direct distribution (outside App Store).

**Usage:**
```bash
./scripts/build-mac.sh
```

**Requirements:**
- macOS
- Xcode Command Line Tools
- **Developer ID Application** certificate (for code signing)
- **Developer ID Installer** certificate (for notarization)

**Environment Variables (Optional):**
```bash
export CSC_NAME="Developer ID Application: Your Name (TEAM_ID)"
export APPLE_ID="your-apple-id@email.com"              # For notarization
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # For notarization
export APPLE_TEAM_ID="YOUR_TEAM_ID"                    # For notarization
```

**Output:**
- `dist-electron/Klever Desktop-{version}.dmg` - Installer disk image
- `dist-electron/Klever Desktop-{version}-mac.zip` - ZIP archive

**Note:** Code signing and notarization are optional but **highly recommended** for distribution. Unsigned apps will show security warnings on macOS.

---

### 🪟 Windows Build

#### `build-windows.ps1` - Windows Installer

Creates NSIS installer and ZIP archive for Windows distribution.

**Usage:**
```powershell
.\scripts\build-windows.ps1
```

**With specific version:**
```powershell
.\scripts\build-windows.ps1 -Version 1.2.0
```

**Skip build step (only package):**
```powershell
.\scripts\build-windows.ps1 -SkipBuild
```

**Show help:**
```powershell
.\scripts\build-windows.ps1 -Help
```

**Requirements:**
- Windows 10/11 or Windows Server
- Node.js 18+
- Yarn
- Code signing certificate (optional, `.pfx` file)

**Environment Variables (Optional, for code signing):**
```powershell
$env:CSC_LINK = "C:\path\to\certificate.pfx"
$env:CSC_KEY_PASSWORD = "your-certificate-password"
```

**Output:**
- `dist-electron/Klever Desktop Setup {version}.exe` - NSIS installer
- `dist-electron/Klever Desktop-{version}-win.zip` - ZIP archive

**Note:** Code signing is optional but **highly recommended** to avoid Windows SmartScreen warnings.

---

## 🔧 Common Setup

### Prerequisites

All platforms require:
- **Node.js 18+**: [Download](https://nodejs.org)
- **Yarn**: Install with `npm install -g yarn`

### Install Dependencies

Before running any build script:

```bash
yarn install
```

### Version Management

Version is automatically read from `package.json`:

```json
{
  "version": "0.1.0"
}
```

To change the version:
```bash
yarn version --new-version 1.2.0
```

Or manually edit `package.json`.

---

## 🔐 Code Signing Setup

### macOS Code Signing

#### For App Store (`build-appstore.sh`):

1. **Install Certificates in Keychain:**
   - `3rd Party Mac Developer Application: Your Name (TEAM_ID)`
   - `3rd Party Mac Developer Installer: Your Name (TEAM_ID)`

2. **Set Environment Variables:**
   ```bash
   export CSC_NAME="3rd Party Mac Developer Application: Your Name (TEAM_ID)"
   export CSC_INSTALLER_NAME="3rd Party Mac Developer Installer: Your Name (TEAM_ID)"
   ```

3. **Find your certificates:**
   ```bash
   security find-identity -v -p codesigning
   ```

#### For Direct Distribution (`build-mac.sh`):

1. **Install Certificates:**
   - `Developer ID Application: Your Name (TEAM_ID)`
   - `Developer ID Installer: Your Name (TEAM_ID)` (optional)

2. **Set Environment Variables:**
   ```bash
   export CSC_NAME="Developer ID Application: Your Name (TEAM_ID)"
   ```

3. **For Notarization (highly recommended):**
   ```bash
   export APPLE_ID="your-apple-id@email.com"
   export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
   export APPLE_TEAM_ID="YOUR_TEAM_ID"
   ```

   Generate app-specific password at: https://appleid.apple.com/account/manage

### Windows Code Signing

1. **Obtain a Code Signing Certificate:**
   - Purchase from Certificate Authorities (DigiCert, Sectigo, etc.)
   - Export as `.pfx` file with password

2. **Set Environment Variables:**
   ```powershell
   $env:CSC_LINK = "C:\path\to\certificate.pfx"
   $env:CSC_KEY_PASSWORD = "your-password"
   ```

3. **Build:**
   ```powershell
   .\scripts\build-windows.ps1
   ```

---

## 📦 Build Outputs

### macOS App Store
```
dist-electron/
└── mas/
    ├── Klever Desktop.app          # Signed app bundle
    └── Klever Desktop-0.1.0.pkg    # Installer package for App Store
```

### macOS Direct Distribution
```
dist-electron/
├── Klever Desktop-0.1.0.dmg        # Disk image installer
└── Klever Desktop-0.1.0-mac.zip    # ZIP archive
```

### Windows
```
dist-electron/
├── Klever Desktop Setup 0.1.0.exe  # NSIS installer
└── Klever Desktop-0.1.0-win.zip    # ZIP archive
```

---

## 🚀 CI/CD Integration

### GitHub Actions Example

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build-mac:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: yarn install
      - run: ./scripts/build-mac.sh
        env:
          CSC_NAME: ${{ secrets.MAC_CSC_NAME }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
      - uses: actions/upload-artifact@v3
        with:
          name: mac-build
          path: dist-electron/*.dmg

  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: yarn install
      - run: .\scripts\build-windows.ps1
        env:
          CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_PASSWORD }}
      - uses: actions/upload-artifact@v3
        with:
          name: windows-build
          path: dist-electron/*.exe
```

---

## 🐛 Troubleshooting

### macOS

**Problem:** `codesign` fails with "no identity found"

**Solution:** Make sure certificates are installed in Keychain and `CSC_NAME` matches exactly:
```bash
security find-identity -v -p codesigning
```

**Problem:** Notarization fails

**Solution:**
1. Verify Apple ID credentials
2. Generate new app-specific password at https://appleid.apple.com
3. Check Team ID is correct

### Windows

**Problem:** Build fails with "electron-builder" not found

**Solution:**
```powershell
yarn install
```

**Problem:** Code signing fails

**Solution:**
1. Verify `.pfx` file path is correct
2. Check password is correct
3. Ensure certificate is valid and not expired

### All Platforms

**Problem:** Build succeeds but files not found

**Solution:** Check `dist-electron/` directory for actual output locations. File names may vary slightly.

---

## 📚 Additional Resources

- [Electron Builder Documentation](https://www.electron.build/)
- [macOS Code Signing Guide](https://www.electron.build/code-signing)
- [Windows Code Signing Guide](https://www.electron.build/configuration/win)
- [Notarization Guide](https://www.electron.build/configuration/mac#notarization)
- [App Store Distribution Guide](https://developer.apple.com/distribute/)

---

## 📝 License

These build scripts are part of the Klever Desktop project and follow the same license.
