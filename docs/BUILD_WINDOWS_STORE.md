# Windows Store (MSIX) Build Guide

This guide explains how to build an MSIX package for Microsoft Store submission.

## Prerequisites

1. **Windows SDK 10.0.22621.0 or later**
   - Install via [Visual Studio Installer](https://visualstudio.microsoft.com/downloads/) or [standalone SDK](https://developer.microsoft.com/windows/downloads/windows-sdk/)
   - Required tool: `makeappx.exe`

2. **Microsoft Partner Center Account**
   - Create at [Partner Center](https://partner.microsoft.com/)
   - Reserve your app name
   - Get Publisher ID from Product Identity page

## Configuration

### 1. Get Your Publisher Information

From Microsoft Partner Center:
1. Go to **Apps and games** > Your app > **Product identity**
2. Copy these values:
   - **Package/Identity/Name**: e.g., `CompanyName.AppName`
   - **Package/Identity/Publisher**: e.g., `CN=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`
   - **Publisher display name**: Your company/developer name

### 2. Set Environment Variables (Optional)

For production builds or CI/CD, set these environment variables:

```powershell
# PowerShell
$env:WIN_PUBLISHER_ID = "CN=YOUR-PUBLISHER-ID"
$env:WIN_PUBLISHER_NAME = "Your Name"
$env:WIN_PACKAGE_NAME = "CompanyName.AppName"
$env:WIN_PACKAGE_DISPLAY_NAME = "Your App Name"
$env:WIN_IDENTITY_NAME = "CompanyName.AppName"
```

```bash
# Bash (Git Bash, WSL)
export WIN_PUBLISHER_ID="CN=YOUR-PUBLISHER-ID"
export WIN_PUBLISHER_NAME="Your Name"
export WIN_PACKAGE_NAME="CompanyName.AppName"
export WIN_PACKAGE_DISPLAY_NAME="Your App Name"
export WIN_IDENTITY_NAME="CompanyName.AppName"
```

**Note**: If environment variables are not set, the build will use the default values from `forge.config.js`.

### 3. Alternative: Local .env File

For local development, you can create a `.env` file from the template:

```powershell
Copy-Item .env.example .env
# Then edit .env with your values
```

**Important**: `.env` is git-ignored and will NOT be loaded automatically. You need to:
- Set environment variables manually before running the build, OR
- Use a tool like `dotenv-cli`: `npm install -g dotenv-cli` and run `dotenv npm run make`

## Building the MSIX Package

### Development Build (Quick Test)

```powershell
npm run make -- --platform=win32
```

### Production Build (For Store Submission)

1. Update version in `package.json`:
   ```json
   {
     "version": "2.1.0"  // Will be converted to 2.1.0.0 automatically
   }
   ```

2. Set environment variables (if needed):
   ```powershell
   $env:WIN_PUBLISHER_ID = "CN=YOUR-PUBLISHER-ID"
   $env:WIN_PUBLISHER_NAME = "Your Name"
   # ... (see above)
   ```

3. Build the package:
   ```powershell
   npm run make -- --platform=win32
   ```

4. Find the output:
   ```
   out/make/appx/x64/Klever Desktop-2.1.0.0-x64.appx
   ```

## Uploading to Microsoft Partner Center

1. Go to Partner Center > Your app > **Submissions**
2. Create a new submission
3. Upload the `.appx` file from `out/make/appx/x64/`
4. Fill in store listing details
5. Submit for certification

**Note**: The package is unsigned. Partner Center will sign it during the certification process.

## Version Management

- Version is automatically extracted from `package.json`
- NPM format: `x.x.x` (e.g., `2.1.0`)
- Converted to Windows format: `x.x.x.x` (e.g., `2.1.0.0`)
- To update version: Only edit `package.json`, no need to touch `forge.config.js` or `appxmanifest.xml`

## Troubleshooting

### Error: "makeappx.exe not found"
- Install Windows SDK or set `WINDOWS_KIT_PATH` environment variable
- Example: `$env:WINDOWS_KIT_PATH = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64"`

### Error: "Publisher doesn't match"
- Ensure `WIN_PUBLISHER_ID` matches exactly what's in Partner Center
- Format must be: `CN=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`

### Error: "Package name already exists"
- The package name must be reserved in Partner Center first
- Go to Partner Center > Product identity to verify

## Security Notes

- Publisher ID is public information (visible after app installation)
- No secrets or certificates in the repository
- Actual signing happens on Microsoft's servers during certification
- Environment variables provide flexibility for different environments (dev/staging/prod)

## CI/CD Integration

For GitHub Actions:

```yaml
- name: Build MSIX
  env:
    WIN_PUBLISHER_ID: ${{ secrets.WIN_PUBLISHER_ID }}
    WIN_PUBLISHER_NAME: ${{ secrets.WIN_PUBLISHER_NAME }}
    WIN_PACKAGE_NAME: ${{ secrets.WIN_PACKAGE_NAME }}
    WIN_PACKAGE_DISPLAY_NAME: ${{ secrets.WIN_PACKAGE_DISPLAY_NAME }}
    WIN_IDENTITY_NAME: ${{ secrets.WIN_IDENTITY_NAME }}
  run: npm run make -- --platform=win32
```

Add these secrets in your repository settings.
