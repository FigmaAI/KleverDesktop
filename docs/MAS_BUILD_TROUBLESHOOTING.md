# Mac App Store Build Troubleshooting Guide

## Overview

This document provides solutions for common issues when building Klever Desktop for the Mac App Store, specifically addressing the EXC_BREAKPOINT crash during V8 initialization.

## Critical Fix: V8 Initialization Crash

### Symptoms
- App crashes immediately on launch (~120ms)
- Exception: `EXC_BREAKPOINT (SIGTRAP)`
- Crash in Electron Framework during V8/JavaScript engine initialization
- Stack trace shows: `ElectronMain → v8::Isolate::Initialize`

### Root Cause
The crash occurs when Electron helper processes are not properly signed with the required entitlements, particularly:
- `com.apple.security.cs.allow-jit` (JIT compilation)
- `com.apple.security.cs.allow-unsigned-executable-memory` (V8 memory management)
- `com.apple.security.cs.allow-dyld-environment-variables` (dynamic linking)
- `com.apple.security.cs.disable-library-validation` (native modules)

### Solution Applied

#### 1. Updated `forge.config.js` (Lines 32-57)

**Added `optionsForFile` callback** to ensure ALL Electron helper processes are signed with inherit entitlements:

```javascript
osxSign: {
  // ... existing config
  optionsForFile: (filePath) => {
    // Helper processes MUST use inherit entitlements
    if (filePath.includes('Helper')) {
      return {
        entitlements: 'build/entitlements.mas.inherit.plist',
      };
    }
    // Main app uses main entitlements
    return {
      entitlements: 'build/entitlements.mas.plist',
    };
  },
  hardenedRuntime: true,
  gatekeeperAssess: false,
  signatureFlags: ['runtime'],
}
```

**Fixed provisioning profile reference** to use environment variable:
```javascript
provisioningProfile: process.env.MAS_PROVISIONING_PROFILE || undefined,
```

#### 2. Enhanced `build/entitlements.mas.inherit.plist`

Added network access entitlements for helper processes:
```xml
<key>com.apple.security.network.client</key>
<true/>
<key>com.apple.security.network.server</key>
<true/>
```

## Electron Helper Processes

Electron apps consist of multiple processes:
- **Main App**: `Klever Desktop.app/Contents/MacOS/klever-desktop`
- **Helper (GPU)**: GPU acceleration process
- **Helper (Renderer)**: Web content rendering process
- **Helper (Plugin)**: Plugin execution process

**ALL helpers must be signed with `entitlements.mas.inherit.plist`** or V8 will fail to initialize.

## Build Process

### 1. Prerequisites

```bash
# Set up signing identities (environment variables)
export CSC_NAME="3rd Party Mac Developer Application: Your Name (TEAM_ID)"
export CSC_INSTALLER_NAME="3rd Party Mac Developer Installer: Your Name (TEAM_ID)"

# Optional: Provisioning profile (if you have one)
export MAS_PROVISIONING_PROFILE="/path/to/profile.provisionprofile"
```

### 2. Build for Mac App Store

```bash
# Clean previous builds
rm -rf out/

# Build and package
npm run make -- --platform=mas --arch=universal

# Output will be in: out/make/
# - out/make/klever-desktop-2.0.0-universal.pkg (Mac App Store installer)
```

### 3. Verify Signing

```bash
# Check main app signature
codesign -dv --verbose=4 "out/klever-desktop-mas-universal/Klever Desktop.app"

# Check helper signatures (CRITICAL)
codesign -dv --verbose=4 "out/klever-desktop-mas-universal/Klever Desktop.app/Contents/Frameworks/Electron Framework.framework/Versions/A/Helpers/Electron Helper (GPU).app"
codesign -dv --verbose=4 "out/klever-desktop-mas-universal/Klever Desktop.app/Contents/Frameworks/Electron Framework.framework/Versions/A/Helpers/Electron Helper (Renderer).app"
codesign -dv --verbose=4 "out/klever-desktop-mas-universal/Klever Desktop.app/Contents/Frameworks/Electron Framework.framework/Versions/A/Helpers/Electron Helper (Plugin).app"

# Verify entitlements are applied
codesign -d --entitlements - "out/klever-desktop-mas-universal/Klever Desktop.app"
codesign -d --entitlements - "out/klever-desktop-mas-universal/Klever Desktop.app/Contents/Frameworks/Electron Framework.framework/Versions/A/Helpers/Electron Helper (Renderer).app"
```

Expected output should show:
- Authority: `3rd Party Mac Developer Application`
- Entitlements including `com.apple.security.cs.allow-jit`
- All helpers signed with inherit entitlements

### 4. Test Locally (Optional)

```bash
# Install to /Applications
sudo installer -pkg "out/make/klever-desktop-2.0.0-universal.pkg" -target /

# Run and check for crashes
open "/Applications/Klever Desktop.app"

# Check Console.app for crash reports if it fails
```

## Common Issues

### Issue: Provisioning Profile Not Found

**Error**: `Error: Could not find provisioning profile at path: build/klever.provisionprofile`

**Solution**: The fix now uses an environment variable. Either:
1. Set `MAS_PROVISIONING_PROFILE` to your profile path, OR
2. Leave it unset (profile is optional for local builds)

### Issue: Helper Process Crashes

**Symptoms**: Main app launches but immediately crashes with V8 errors

**Solution**: Verify helpers are signed with inherit entitlements using `codesign -d --entitlements -` command above

### Issue: Code Signing Identity Not Found

**Error**: `Error: No identity found for signing`

**Solution**:
```bash
# List available signing identities
security find-identity -v -p codesigning

# Ensure you have both certificates installed:
# - "3rd Party Mac Developer Application"
# - "3rd Party Mac Developer Installer"
```

### Issue: Sandbox Violations

**Symptoms**: App launches but features don't work (network, file access, USB)

**Solution**: Check entitlements in `build/entitlements.mas.plist` and ensure they match your App Store Connect capabilities

## Testing Checklist

Before submitting to App Store:

- [ ] App launches without crashes
- [ ] All helper processes properly signed
- [ ] Network connectivity works (API calls, Ollama)
- [ ] File access works (project storage, workspace folders)
- [ ] USB device access works (ADB for Android)
- [ ] V8/JavaScript engine initializes successfully
- [ ] Python subprocess execution works
- [ ] No sandbox violations in Console.app

## References

- [Electron Forge Mac App Store Guide](https://www.electronforge.io/guides/code-signing/code-signing-macos#mac-app-store)
- [Apple Code Signing Guide](https://developer.apple.com/library/archive/documentation/Security/Conceptual/CodeSigningGuide/)
- [Electron Entitlements Documentation](https://www.electronjs.org/docs/latest/tutorial/mac-app-store-submission-guide)

## Changelog

**2025-11-20**: Fixed V8 initialization crash
- Added `optionsForFile` callback for proper helper process signing
- Enhanced inherit entitlements with network access
- Fixed provisioning profile reference
- Added hardened runtime flags
