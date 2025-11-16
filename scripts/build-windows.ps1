#!/usr/bin/env pwsh

# =================================================================
# Klever Desktop - Windows Build Script (Electron)
# Creates Windows NSIS installer and ZIP for distribution
# Supports code signing with optional certificate
# =================================================================

param(
    [string]$Version = "",
    [switch]$SkipBuild = $false,
    [switch]$Help = $false
)

$ErrorActionPreference = "Stop"

# Show help if requested
if ($Help) {
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "🪟 Windows Build Script - Klever Desktop" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\scripts\build-windows.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Version <version>     Override version from package.json"
    Write-Host "  -SkipBuild            Skip npm build, only run electron-builder"
    Write-Host "  -Help                 Show this help message"
    Write-Host ""
    Write-Host "Environment Variables (optional):"
    Write-Host "  CSC_LINK              Path to .pfx certificate file or base64 certificate"
    Write-Host "  CSC_KEY_PASSWORD      Password for the certificate"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\scripts\build-windows.ps1                    # Build with version from package.json"
    Write-Host "  .\scripts\build-windows.ps1 -Version 1.2.0     # Build with specific version"
    Write-Host "  .\scripts\build-windows.ps1 -SkipBuild         # Skip build step"
    Write-Host ""
    Write-Host "Code Signing (optional):"
    Write-Host "  `$env:CSC_LINK = 'C:\path\to\certificate.pfx'"
    Write-Host "  `$env:CSC_KEY_PASSWORD = 'your-password'"
    Write-Host "  .\scripts\build-windows.ps1"
    Write-Host ""
    exit 0
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "🪟 Windows Build - Klever Desktop" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# --- Configuration ---
$APP_NAME = "Klever Desktop"
$BUNDLE_ID = "com.klever.desktop"
$BUILD_DIR = "dist-electron"

# --- Check build environment ---
Write-Host "🔍 [Step 1/6] Checking build environment..." -ForegroundColor Green
Write-Host ""

# Check Node.js
try {
    $nodeVersion = node --version
    $nodeMajor = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($nodeMajor -lt 18) {
        Write-Host "❌ Error: Node.js 18+ is required (current: $nodeVersion)" -ForegroundColor Red
        Write-Host "   Download from: https://nodejs.org" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "✅ Node.js $nodeVersion detected" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: Node.js is not installed" -ForegroundColor Red
    Write-Host "   Please install Node.js 18+ from https://nodejs.org" -ForegroundColor Yellow
    exit 1
}

# Check Yarn
try {
    $yarnVersion = yarn --version
    Write-Host "✅ Yarn $yarnVersion detected" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: Yarn is not installed" -ForegroundColor Red
    Write-Host "   Install with: npm install -g yarn" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# --- Environment Variables Check ---
Write-Host "🔍 Checking environment variables..." -ForegroundColor Cyan
Write-Host ""

if ($env:CSC_LINK) {
    Write-Host "✅ Code signing certificate configured" -ForegroundColor Green
    Write-Host "   Certificate: $($env:CSC_LINK)" -ForegroundColor Gray
} else {
    Write-Host "⚠️  CSC_LINK not set - build will be unsigned" -ForegroundColor Yellow
    Write-Host "   To enable code signing:" -ForegroundColor Gray
    Write-Host "   `$env:CSC_LINK = 'C:\path\to\certificate.pfx'" -ForegroundColor Gray
    Write-Host "   `$env:CSC_KEY_PASSWORD = 'your-password'" -ForegroundColor Gray
}

if ($env:CSC_KEY_PASSWORD) {
    Write-Host "✅ Certificate password configured" -ForegroundColor Green
} else {
    if ($env:CSC_LINK) {
        Write-Host "⚠️  CSC_KEY_PASSWORD not set" -ForegroundColor Yellow
    }
}

Write-Host ""

# --- Version Configuration ---
Write-Host "📋 [Step 2/6] Setting up version information..." -ForegroundColor Green
Write-Host ""

# Get current version from package.json
$packageJsonPath = "package.json"
if (Test-Path $packageJsonPath) {
    $packageJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
    $CURRENT_VERSION = $packageJson.version
} else {
    Write-Host "❌ Error: package.json not found" -ForegroundColor Red
    exit 1
}

if ([string]::IsNullOrEmpty($Version)) {
    $APP_VERSION = $CURRENT_VERSION
    Write-Host "✅ Using version from package.json: $APP_VERSION" -ForegroundColor Green
} else {
    $APP_VERSION = $Version
    Write-Host "✅ Using specified version: $APP_VERSION" -ForegroundColor Green
}

Write-Host ""
Write-Host "📋 Build configuration:" -ForegroundColor Cyan
Write-Host "   - App Name: $APP_NAME" -ForegroundColor White
Write-Host "   - Bundle ID: $BUNDLE_ID" -ForegroundColor White
Write-Host "   - Version: $APP_VERSION" -ForegroundColor White
Write-Host "   - Build Dir: $BUILD_DIR" -ForegroundColor White
Write-Host "   - Code Signing: $(if ($env:CSC_LINK) { 'Enabled' } else { 'Disabled' })" -ForegroundColor White
Write-Host ""

# --- Install dependencies ---
Write-Host "📦 [Step 3/6] Installing dependencies..." -ForegroundColor Green
Write-Host ""

try {
    yarn install --frozen-lockfile
    Write-Host "✅ Dependencies installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Error installing dependencies: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# --- Build the application ---
if (-not $SkipBuild) {
    Write-Host "🔨 [Step 4/6] Building Klever Desktop..." -ForegroundColor Green
    Write-Host ""

    # Clean previous builds
    if (Test-Path $BUILD_DIR) {
        Write-Host "   🧹 Cleaning previous build..." -ForegroundColor Gray
        Remove-Item -Recurse -Force $BUILD_DIR
    }

    # Build main process
    Write-Host "   🔧 Building main process..." -ForegroundColor Gray
    try {
        yarn build:main
    } catch {
        Write-Host "❌ Main process build failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }

    # Build renderer process
    Write-Host "   🎨 Building renderer process..." -ForegroundColor Gray
    try {
        yarn build:renderer
    } catch {
        Write-Host "❌ Renderer process build failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }

    Write-Host "✅ Application built successfully" -ForegroundColor Green
} else {
    Write-Host "⏭️  [Step 4/6] Skipping build (SkipBuild flag specified)" -ForegroundColor Yellow
}

Write-Host ""

# --- Package for Windows ---
Write-Host "📦 [Step 5/6] Packaging for Windows..." -ForegroundColor Green
Write-Host ""

# Set environment variables for electron-builder
$env:ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES = "true"

Write-Host "   🪟 Creating Windows NSIS installer and ZIP..." -ForegroundColor Gray

try {
    # Build for Windows (NSIS and ZIP)
    yarn run electron-builder --win nsis zip `
        --config.appId="$BUNDLE_ID" `
        --config.productName="$APP_NAME" `
        --config.directories.output="$BUILD_DIR"

    Write-Host "✅ Windows packages created" -ForegroundColor Green
} catch {
    Write-Host "❌ Packaging failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# --- Verify the build ---
Write-Host "🔍 [Step 6/6] Verifying build..." -ForegroundColor Green
Write-Host ""

# Find build artifacts
$NSIS_SETUP = Get-ChildItem -Path $BUILD_DIR -Filter "*Setup*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
$ZIP_FILE = Get-ChildItem -Path $BUILD_DIR -Filter "*win.zip" -ErrorAction SilentlyContinue | Select-Object -First 1

if ($NSIS_SETUP) {
    $setupSize = [math]::Round(($NSIS_SETUP.Length / 1MB), 2)
    Write-Host "✅ NSIS Setup found: $($NSIS_SETUP.Name) ($setupSize MB)" -ForegroundColor Green
} else {
    Write-Host "⚠️  NSIS Setup not found at expected location" -ForegroundColor Yellow
    Write-Host "   Looking for .exe files in $BUILD_DIR..." -ForegroundColor Gray
    Get-ChildItem -Path $BUILD_DIR -Filter "*.exe" -Recurse | ForEach-Object {
        Write-Host "   Found: $($_.FullName)" -ForegroundColor Gray
    }
}

if ($ZIP_FILE) {
    $zipSize = [math]::Round(($ZIP_FILE.Length / 1MB), 2)
    Write-Host "✅ ZIP file found: $($ZIP_FILE.Name) ($zipSize MB)" -ForegroundColor Green
} else {
    Write-Host "⚠️  ZIP file not found at expected location" -ForegroundColor Yellow
    Write-Host "   Looking for .zip files in $BUILD_DIR..." -ForegroundColor Gray
    Get-ChildItem -Path $BUILD_DIR -Filter "*.zip" -Recurse | ForEach-Object {
        Write-Host "   Found: $($_.FullName)" -ForegroundColor Gray
    }
}

Write-Host "✅ Build verification completed" -ForegroundColor Green
Write-Host ""

# --- Summary ---
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🎯 BUILD SUMMARY - Klever Desktop" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "📱 App Name: $APP_NAME" -ForegroundColor White
Write-Host "📦 Version: $APP_VERSION" -ForegroundColor White
Write-Host "🆔 Bundle ID: $BUNDLE_ID" -ForegroundColor White
Write-Host "📂 Build Output: $BUILD_DIR\" -ForegroundColor White
Write-Host "" -ForegroundColor White
Write-Host "📦 Build Artifacts:" -ForegroundColor Cyan
if ($NSIS_SETUP) {
    Write-Host "   ✅ NSIS Setup: $($NSIS_SETUP.Name) ($setupSize MB)" -ForegroundColor Green
} else {
    Write-Host "   ❌ NSIS Setup: Not found" -ForegroundColor Red
}
if ($ZIP_FILE) {
    Write-Host "   ✅ ZIP: $($ZIP_FILE.Name) ($zipSize MB)" -ForegroundColor Green
} else {
    Write-Host "   ❌ ZIP: Not found" -ForegroundColor Red
}
Write-Host ""
Write-Host "🚀 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Test the installer on a clean Windows machine" -ForegroundColor White
Write-Host "   2. Verify the app launches correctly" -ForegroundColor White
Write-Host "   3. Distribute via:" -ForegroundColor White
Write-Host "      - Direct download from your website" -ForegroundColor Gray
Write-Host "      - GitHub Releases" -ForegroundColor Gray
Write-Host "      - Microsoft Store (requires separate packaging)" -ForegroundColor Gray
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Cyan
Write-Host "   - Electron Builder: https://www.electron.build/configuration/win" -ForegroundColor Gray
Write-Host "   - Code Signing: https://www.electron.build/code-signing" -ForegroundColor Gray
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
