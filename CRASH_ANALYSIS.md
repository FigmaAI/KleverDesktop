# Crash Analysis - Build 12

## Summary

**Build 12의 수정사항**은 성공적으로 초기 V8 initialization crash를 해결했습니다. 하지만 새로운 크래시가 6.6초 후에 발생하고 있습니다.

---

## Two Different Crashes

### ✅ Crash 1: FIXED in Build 12 (Commit 50bc3af)
- **Timing**: ~120ms after launch
- **Location**: V8 initialization in ElectronMain
- **Cause**: Helper processes not signed with JIT entitlements
- **Fix**: Added `optionsForFile` callback in forge.config.js
- **Status**: **RESOLVED** ✅

### ❌ Crash 2: CURRENT ISSUE (New crash in Build 12)
- **Timing**: ~6.6 seconds after launch
- **Location**: V8 compiler in DNS resolution (`ares_dns_rr_get_name`)
- **Platform**: macOS Sequoia 15.2 **beta** (25B78)
- **Electron**: 31.7.7 (package.json shows ^31.0.0)
- **App Name**: "Klever - Instance UT" (unusual naming)
- **Status**: **ACTIVE** ❌

---

## Current Crash Details

### Stack Trace
```
Thread 0 Crashed:: CrBrowserMain
0   Electron Framework  0x11776971c ares_dns_rr_get_name + 4449780
1   Electron Framework  0x117769600 ares_dns_rr_get_name + 4449496
2   Electron Framework  0x1177692e4 ares_dns_rr_get_name + 4448700
...
5   Electron Framework  0x116af3144 v8::internal::compiler::CompilationDependencies
```

### Key Observations

1. **DNS Function**: `ares_dns_rr_get_name` suggests DNS resolution crash
2. **Timing**: 6.6 seconds = likely during React app initialization/IPC call
3. **macOS Beta**: Running on Sequoia 15.2 **beta** - known for Electron issues
4. **V8 Compiler**: Crash in V8's compilation pipeline, not initialization

### App State at Crash Time
- ✅ App launched successfully (passed 120ms crash point)
- ✅ Main window created
- ✅ Renderer process started
- ✅ React app loading
- ❌ Crash likely during `checkSetup()` IPC call or network request

---

## Root Cause Analysis

### Primary Suspect: macOS Sequoia Beta + Electron 31

**Evidence**:
1. Electron 31.0.0 is 11+ versions behind latest (31.7.7 in crash report)
2. macOS Sequoia 15.2 is **beta** - not stable release
3. DNS crashes are common in Electron on beta macOS versions
4. V8 compiler bugs have been fixed in newer Electron versions

### Secondary Factors:
1. **Network Entitlements**: May need additional network-specific entitlements
2. **React StrictMode**: Double-rendering can expose race conditions
3. **IPC Race Conditions**: 6.6s timing suggests IPC call trigger

---

## Recommended Fixes

### Fix Priority 1: Update Electron 🔥 CRITICAL

**Current**: Electron 31.0.0
**Target**: Electron 33.4.11 (latest stable)

**Why**:
- 33.4.11 includes macOS Sequoia compatibility fixes
- DNS/network bug fixes in 31.1.0 - 33.x
- V8 compiler improvements
- Security updates

**Change**:
```diff
// package.json
- "electron": "^31.0.0"
+ "electron": "^33.4.11"
```

### Fix Priority 2: Add V8 Crash Workarounds

**Problem**: V8 compiler crashes on macOS beta
**Solution**: Disable aggressive optimizations

**Changes to `main/index.ts`**:
```typescript
// Add BEFORE app.whenReady()
import { app } from 'electron';

// Disable V8 optimizations that crash on macOS Sequoia beta
app.commandLine.appendSwitch('js-flags', '--no-opt');
// Disable macOS-specific features causing crashes
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
// Reduce DNS/network complexity
app.commandLine.appendSwitch('disable-http-cache');
```

### Fix Priority 3: Add Network Entitlements to Main App

**Current**: Only inherit plist has network entitlements
**Fix**: Add to main app too

**Changes to `build/entitlements.mas.plist`**:
```xml
<!-- Add if not present -->
<key>com.apple.security.network.client</key>
<true/>
<key>com.apple.security.network.server</key>
<true/>
```

### Fix Priority 4: Add Defensive IPC Error Handling

**Problem**: IPC call may trigger DNS resolution that crashes
**Solution**: Add timeout and delay

**Changes to `src/App.tsx`**:
```typescript
useEffect(() => {
  const checkSetup = async () => {
    // Add timeout protection
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Setup check timeout')), 5000)
    );

    try {
      const result = await Promise.race([
        window.electronAPI.checkSetup(),
        timeoutPromise
      ]);
      setSetupComplete(result.setupComplete);
    } catch (error) {
      console.error('Setup check failed:', error);
      setSetupComplete(false); // Safe default
    } finally {
      setIsChecking(false);
    }
  }

  // Delay to let Electron fully initialize
  setTimeout(checkSetup, 500);
}, [])
```

### Fix Priority 5: Add Crash Reporter

**Purpose**: Capture crash data for debugging

**Changes to `main/index.ts`**:
```typescript
import { app, crashReporter } from 'electron';

crashReporter.start({
  productName: 'Klever Desktop',
  submitURL: '',
  uploadToServer: false,
  compress: true,
});
```

---

## Testing Strategy

### 1. Test on Stable macOS First
- ✅ macOS 15.0/15.1 (stable Sequoia)
- ✅ macOS 14 (Sonoma)
- ❌ macOS 15.2 beta (known issues)

### 2. Incremental Testing
1. Apply Fix 1 (Electron update) → test
2. Apply Fix 2 (V8 flags) → test
3. Apply Fix 3 (network entitlements) → test
4. Apply Fix 4 (defensive IPC) → test

### 3. Verification
```bash
# After fixes
npm install
npm run start

# Expected: No crash after 6.6 seconds
# Expected: App fully functional
```

---

## Comparison with Previous Fix

| Aspect | Build 11 → 12 Fix | Build 12 → 13 Fix |
|--------|-------------------|-------------------|
| **Crash Timing** | 120ms | 6.6 seconds |
| **Location** | V8 init | V8 compiler (DNS) |
| **Cause** | Missing JIT entitlements | macOS beta + old Electron |
| **Fix** | Helper process signing | Electron update + V8 flags |
| **Complexity** | Simple (config only) | Medium (deps + code) |

---

## Expected Outcome

After applying these fixes:
1. ✅ App launches (already working in Build 12)
2. ✅ App runs past 6.6 second mark
3. ✅ DNS/network requests work without crashes
4. ✅ IPC calls complete successfully
5. ✅ App is stable on macOS Sequoia beta

---

## Next Steps

1. Create new branch: `claude/fix-dns-crash-build13`
2. Apply fixes in priority order
3. Update buildVersion: 12 → 13
4. Test on macOS stable version
5. Submit for App Store review

---

**Generated**: 2025-11-21
**For**: Build 13 (fixing DNS crash in Build 12)
