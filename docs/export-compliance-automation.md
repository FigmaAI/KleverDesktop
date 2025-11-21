# Export Compliance Automation for App Store Connect

## Problem

Every time you upload a build to TestFlight, App Store Connect shows an "App Encryption Documentation" dialog that requires manual input to proceed.

## Solution

Add `ITSAppUsesNonExemptEncryption` key to the app's Info.plist to automatically declare that the app does not use non-exempt encryption.

---

## Implementation

### Modified File: `forge.config.js`

Added `extendInfo` section to `packagerConfig`:

```javascript
packagerConfig: {
  // ... existing config

  // Export compliance: Skip encryption dialog in App Store Connect
  // We only use standard HTTPS/TLS which is exempt from export regulations
  extendInfo: {
    ITSAppUsesNonExemptEncryption: false
  },

  // ... rest of config
}
```

---

## What Does This Mean?

### `ITSAppUsesNonExemptEncryption: false`

This tells Apple:

✅ **"This app does NOT use non-exempt encryption"**

Meaning:
- Only uses standard HTTPS/TLS encryption (exempt)
- Only uses system APIs like URLSession, WebSocket (exempt)
- Does NOT implement custom encryption algorithms
- Does NOT use proprietary encryption methods

---

## Effect

### Before (Build 14 and earlier)
```
1. Create MAS build
2. Upload to TestFlight
3. ❌ Manually answer encryption questions in App Store Connect
4. Select "None of the algorithms mentioned above"
5. Click Save
6. Build appears in TestFlight
```

### After (Build 15 and later)
```
1. Create MAS build
2. Upload to TestFlight
3. ✅ Automatically processed (no dialog)
4. Build immediately appears in TestFlight (pending approval)
```

---

## Build 15 Changes Summary

| Item | Before | After |
|------|--------|-------|
| **Default Workspace Path** | `~/Documents/apps/` | `~/Library/.../workspaces/` |
| **Integration Test Path** | `~/Documents/` | `~/.../integration-tests/` |
| **UI Placeholder** | "Default: ~/Documents" | "Default: App container (MAS-safe)" |
| **Export Compliance** | ❌ Manual input required | ✅ Automatic |

---

## User Scenarios (No Change)

### Scenario 1: Default Path
```
1. Leave workspace empty when creating project
2. ✅ Uses ~/Library/.../workspaces/MyProject/
3. ✅ Works in MAS sandbox
```

### Scenario 2: Custom Folder
```
1. Click "Browse" button
2. Select desired folder (e.g., ~/Documents/MyProjects)
3. ✅ Security-scoped bookmark grants access
4. ✅ User can view files in Finder
```

---

## Reference

### Apple Export Compliance Documentation
- [Complying with Encryption Export Regulations](https://developer.apple.com/documentation/security/complying_with_encryption_export_regulations)

### Key Points
1. **Standard encryption is exempt**: HTTPS, TLS, SSL, etc.
2. **System API usage is exempt**: URLSession, Network.framework, etc.
3. **Custom encryption requires declaration**: Only if you implement AES, RSA, etc. directly

### Klever Desktop's Case
- ✅ Uses Electron's default network stack (Chromium)
- ✅ HTTPS communication with APIs (OpenAI, Anthropic, etc.)
- ✅ No custom encryption algorithms
- ✅ No proprietary encryption methods

**Conclusion**: `ITSAppUsesNonExemptEncryption: false` is the correct choice

---

## Next Steps

### 1. Build MAS (Build 15)
```bash
npm run make -- --platform=mas --arch=universal
```

### 2. Upload to TestFlight
```bash
bash scripts/upload-appstore.sh out/make/klever-desktop-2.0.0-universal.pkg
```

### 3. Verification
- ✅ No encryption dialog appears (automatic)
- ✅ Build immediately shows "Processing" status
- ✅ Available for testing after approval

### 4. TestFlight Testing
- Create project (default path)
- Create project (file picker)
- Run task
- Integration test

---

## Security Considerations

This setting provides **accurate information** to Apple:

- ❌ Does NOT bypass or weaken encryption
- ✅ Standard HTTPS/TLS encryption still fully functional
- ✅ User data remains securely protected
- ✅ Complies with U.S. export regulations

---

## Additional Information

### Info.plist Location
Electron Forge automatically adds `extendInfo` contents to:
```
out/klever-desktop-mas-universal/klever-desktop.app/Contents/Info.plist
```

### Verification Method
After building, check Info.plist:
```bash
plutil -p out/klever-desktop-mas-universal/klever-desktop.app/Contents/Info.plist | grep -A2 ITSAppUsesNonExemptEncryption
```

Expected output:
```
"ITSAppUsesNonExemptEncryption" => false
```

---

## Checklist

- [x] Add `extendInfo` to `forge.config.js`
- [x] Set `ITSAppUsesNonExemptEncryption: false`
- [x] Add comments explaining intent
- [ ] Build MAS Build 15
- [ ] Upload to TestFlight and verify automation
- [ ] Test darwin build (workspace paths)

---

**Date**: 2025-11-21
**Build Version**: 15
**Files Modified**: 1 (forge.config.js)