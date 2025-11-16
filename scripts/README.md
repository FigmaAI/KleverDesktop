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

**⚠️ Important Notes:**

**Code Signing & Re-signing:**
- Electron apps require **all internal components** to be signed with your certificates:
  - Electron Framework and Helper apps (handled automatically by `electron-builder`)
  - Native node modules (handled automatically)
  - **Bundled Python runtime** (`extraResources/python/`) - requires custom signing script
  - All `.dylib` and `.so` files in the bundle

- The build script uses `electron-osx-sign` under the hood to re-sign all frameworks
- Python runtime binaries may need manual re-signing via `afterSign` hook (see Configuration section)

**Entitlements:**
- Mac App Store apps require proper entitlements files
- Two entitlements files needed:
  - Parent app entitlements (sandbox, network access, etc.)
  - Child/helper process entitlements (inherit sandbox)
- See `build/entitlements.mas.plist` and `build/entitlements.mas.inherit.plist` (to be created)

---

### 🪟 Windows Build

#### `build-windows.ps1` - Microsoft Store Build

Creates MSIX package for Microsoft Store submission.

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
- Windows 10/11 (version 1809 or later)
- Node.js 18+
- Yarn
- Windows 10 SDK (for MSIX packaging)
- Microsoft Store developer account

**Environment Variables (Optional, for app identity):**
```powershell
$env:WINDOWS_STORE_PUBLISHER = "CN=YourPublisherName"
$env:WINDOWS_STORE_IDENTITY_NAME = "YourCompany.KleverDesktop"
```

**Output:**
- `dist-electron/Klever Desktop-{version}.appx` - MSIX package for Microsoft Store

**Note:** The MSIX package will be automatically signed during the Store submission process.

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
  "version": "2.0.0"
}
```

To change the version:
```bash
yarn version --new-version 2.0.0
```

Or manually edit `package.json`.

---

## ⚙️ Configuration for Store Distribution

### Mac App Store Configuration

To properly build for Mac App Store, you need to configure `electron-builder` in `package.json`:

#### 1. Add MAS Target and Entitlements

```json
{
  "build": {
    "appId": "com.klever.desktop",
    "mac": {
      "target": ["mas"],
      "category": "public.app-category.developer-tools",
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "build/entitlements.mas.plist",
      "entitlementsInherit": "build/entitlements.mas.inherit.plist"
    },
    "mas": {
      "type": "distribution",
      "hardenedRuntime": false,
      "entitlements": "build/entitlements.mas.plist",
      "entitlementsInherit": "build/entitlements.mas.inherit.plist"
    }
  }
}
```

#### 2. Create Entitlements Files

**`build/entitlements.mas.plist`** (Parent app):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.app-sandbox</key>
  <true/>
  <key>com.apple.security.network.client</key>
  <true/>
  <key>com.apple.security.network.server</key>
  <true/>
  <key>com.apple.security.files.user-selected.read-write</key>
  <true/>
  <key>com.apple.security.files.downloads.read-write</key>
  <true/>
  <!-- Required for Python subprocess -->
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.disable-library-validation</key>
  <true/>
</dict>
</plist>
```

**`build/entitlements.mas.inherit.plist`** (Helper processes):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.app-sandbox</key>
  <true/>
  <key>com.apple.security.inherit</key>
  <true/>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
</dict>
</plist>
```

#### 3. Python Runtime Re-signing (If Bundled)

If you bundle Python runtime, create `scripts/afterSign.js`:

```javascript
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.default = async function(context) {
  const appPath = context.appOutDir + '/' + context.packager.appInfo.productFilename + '.app';
  const pythonPath = path.join(appPath, 'Contents/Resources/python');

  if (!fs.existsSync(pythonPath)) {
    console.log('No bundled Python found, skipping re-signing');
    return;
  }

  console.log('Re-signing bundled Python runtime...');

  // Get signing identity
  const identity = process.env.CSC_NAME;
  if (!identity) {
    throw new Error('CSC_NAME environment variable not set');
  }

  // Find all executables and libraries
  const files = execSync(`find "${pythonPath}" -type f \\( -name "*.so" -o -name "*.dylib" -o -perm +111 \\)`)
    .toString()
    .trim()
    .split('\n');

  // Re-sign each file
  for (const file of files) {
    if (file) {
      try {
        execSync(`codesign --force --sign "${identity}" --timestamp "${file}"`, {
          stdio: 'inherit'
        });
        console.log(`✓ Signed: ${file}`);
      } catch (error) {
        console.error(`✗ Failed to sign: ${file}`);
      }
    }
  }

  console.log('Python runtime re-signing complete!');
};
```

Add to `package.json`:
```json
{
  "build": {
    "afterSign": "scripts/afterSign.js"
  }
}
```

### Windows MSIX Configuration

Add Windows configuration to `package.json`:

```json
{
  "build": {
    "appx": {
      "applicationId": "KleverDesktop",
      "backgroundColor": "#FFFFFF",
      "displayName": "Klever Desktop",
      "identityName": "YourCompany.KleverDesktop",
      "publisher": "CN=YourPublisherName",
      "publisherDisplayName": "Your Company Name"
    },
    "win": {
      "target": [
        {
          "target": "appx",
          "arch": ["x64", "arm64"]
        }
      ]
    }
  }
}
```

**Note:** Replace `identityName` and `publisher` with values from Microsoft Partner Center.

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

### Windows App Identity

For Microsoft Store distribution, you need to configure your app identity:

1. **Register Your App:**
   - Create an app in [Microsoft Partner Center](https://partner.microsoft.com/dashboard)
   - Reserve your app name (e.g., "Klever Desktop")
   - Get your Publisher Display Name and Identity Name

2. **Set Environment Variables (Optional):**
   ```powershell
   $env:WINDOWS_STORE_PUBLISHER = "CN=YourPublisherName"
   $env:WINDOWS_STORE_IDENTITY_NAME = "YourCompany.KleverDesktop"
   ```

3. **Build:**
   ```powershell
   .\scripts\build-windows.ps1
   ```

4. **Submit to Store:**
   - Upload the generated `.appx` file to Partner Center
   - Microsoft will sign the package during certification process

---

## 📦 Build Outputs

### macOS App Store
```
dist-electron/
└── mas/
    ├── Klever Desktop.app          # Signed app bundle
    └── Klever Desktop-0.1.0.pkg    # Installer package for App Store
```

### Windows Microsoft Store
```
dist-electron/
└── Klever Desktop-0.1.0.appx       # MSIX package for Microsoft Store
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
  build-mac-appstore:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: yarn install
      - run: ./scripts/build-appstore.sh
        env:
          CSC_NAME: ${{ secrets.MAC_APP_STORE_CSC_NAME }}
          CSC_INSTALLER_NAME: ${{ secrets.MAC_APP_STORE_INSTALLER_NAME }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
      - uses: actions/upload-artifact@v3
        with:
          name: mac-appstore-build
          path: dist-electron/mas/*.pkg

  build-windows-msix:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: yarn install
      - run: .\scripts\build-windows.ps1
        env:
          WINDOWS_STORE_PUBLISHER: ${{ secrets.WINDOWS_STORE_PUBLISHER }}
          WINDOWS_STORE_IDENTITY_NAME: ${{ secrets.WINDOWS_STORE_IDENTITY_NAME }}
      - uses: actions/upload-artifact@v3
        with:
          name: windows-msix-build
          path: dist-electron/*.appx
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

**Problem:** Python runtime re-signing fails

**Solution:**
1. Ensure CSC_NAME environment variable is set correctly
2. Verify all Python binaries have correct permissions
3. Check that `afterSign.js` script is executable
4. Try signing manually:
   ```bash
   find "path/to/app/Contents/Resources/python" -type f \( -name "*.so" -o -name "*.dylib" \) -exec codesign --force --sign "YOUR_IDENTITY" --timestamp {} \;
   ```

**Problem:** App Store validation fails with "Invalid Code Signature"

**Solution:**
1. Ensure all nested binaries are signed with the correct certificate
2. Verify entitlements match between parent and child processes
3. Check for unsigned `.so` or `.dylib` files:
   ```bash
   find "path/to/app" -type f \( -name "*.so" -o -name "*.dylib" \) -exec codesign -dv {} \; 2>&1 | grep -i "not signed"
   ```

### Windows

**Problem:** Build fails with "electron-builder" not found

**Solution:**
```powershell
yarn install
```

**Problem:** MSIX packaging fails

**Solution:**
1. Ensure Windows 10 SDK is installed
2. Verify app identity settings in `electron-builder` config
3. Check Publisher and Identity Name match your Partner Center registration

**Problem:** Microsoft Store submission rejected

**Solution:**
1. Ensure all required capabilities are declared
2. Verify app meets [Microsoft Store Policies](https://docs.microsoft.com/en-us/windows/uwp/publish/store-policies)
3. Check that app version follows semantic versioning

### All Platforms

**Problem:** Build succeeds but files not found

**Solution:** Check `dist-electron/` directory for actual output locations. File names may vary slightly.

---

## 📚 Additional Resources

- [Electron Builder Documentation](https://www.electron.build/)
- [macOS Code Signing Guide](https://www.electron.build/code-signing)
- [macOS App Store Distribution Guide](https://developer.apple.com/distribute/)
- [Notarization Guide](https://www.electron.build/configuration/mac#notarization)
- [Windows MSIX Packaging](https://www.electron.build/configuration/appx)
- [Microsoft Partner Center](https://partner.microsoft.com/dashboard)
- [Microsoft Store Policies](https://docs.microsoft.com/en-us/windows/uwp/publish/store-policies)

---

## 📝 License

These build scripts are part of the Klever Desktop project and follow the same license.
