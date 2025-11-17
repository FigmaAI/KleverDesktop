#!/usr/bin/env pwsh

# =================================================================
# Klever Desktop - Windows Build Script (Electron)
# Creates Windows MSIX package for Microsoft Store submission
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
    Write-Host "  WINDOWS_STORE_PUBLISHER        Publisher name from Partner Center"
    Write-Host "  WINDOWS_STORE_IDENTITY_NAME    Identity name from Partner Center"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\scripts\build-windows.ps1                    # Build with version from package.json"
    Write-Host "  .\scripts\build-windows.ps1 -Version 1.2.0     # Build with specific version"
    Write-Host "  .\scripts\build-windows.ps1 -SkipBuild         # Skip build step"
    Write-Host ""
    Write-Host "Microsoft Store Configuration (optional):"
    Write-Host "  `$env:WINDOWS_STORE_PUBLISHER = 'CN=YourPublisherName'"
    Write-Host "  `$env:WINDOWS_STORE_IDENTITY_NAME = 'YourCompany.KleverDesktop'"
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
Write-Host "🔍 Checking Microsoft Store configuration..." -ForegroundColor Cyan
Write-Host ""

if ($env:WINDOWS_STORE_PUBLISHER) {
    Write-Host "✅ Publisher configured: $($env:WINDOWS_STORE_PUBLISHER)" -ForegroundColor Green
} else {
    Write-Host "⚠️  WINDOWS_STORE_PUBLISHER not set - using default from package.json" -ForegroundColor Yellow
    Write-Host "   To configure:" -ForegroundColor Gray
    Write-Host "   `$env:WINDOWS_STORE_PUBLISHER = 'CN=YourPublisherName'" -ForegroundColor Gray
}

if ($env:WINDOWS_STORE_IDENTITY_NAME) {
    Write-Host "✅ Identity Name configured: $($env:WINDOWS_STORE_IDENTITY_NAME)" -ForegroundColor Green
} else {
    Write-Host "⚠️  WINDOWS_STORE_IDENTITY_NAME not set - using default from package.json" -ForegroundColor Yellow
    Write-Host "   To configure:" -ForegroundColor Gray
    Write-Host "   `$env:WINDOWS_STORE_IDENTITY_NAME = 'YourCompany.KleverDesktop'" -ForegroundColor Gray
}

Write-Host ""
Write-Host "ℹ️  Note: MSIX packages are signed by Microsoft during Store certification" -ForegroundColor Cyan
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
Write-Host "   - Target: Microsoft Store (MSIX)" -ForegroundColor White
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

Write-Host "   🪟 Creating Windows MSIX package for Microsoft Store..." -ForegroundColor Gray

try {
    # Build for Windows (MSIX for Microsoft Store)
    yarn run electron-builder --win appx `
        --config.appId="$BUNDLE_ID" `
        --config.productName="$APP_NAME" `
        --config.directories.output="$BUILD_DIR"

    Write-Host "✅ MSIX package created" -ForegroundColor Green
} catch {
    Write-Host "❌ Packaging failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# --- Verify the build ---
Write-Host "🔍 [Step 6/6] Verifying build..." -ForegroundColor Green
Write-Host ""

# Find MSIX package
$MSIX_PACKAGE = Get-ChildItem -Path $BUILD_DIR -Filter "*.appx" -ErrorAction SilentlyContinue | Select-Object -First 1

if ($MSIX_PACKAGE) {
    $msixSize = [math]::Round(($MSIX_PACKAGE.Length / 1MB), 2)
    Write-Host "✅ MSIX package found: $($MSIX_PACKAGE.Name) ($msixSize MB)" -ForegroundColor Green
} else {
    Write-Host "⚠️  MSIX package not found at expected location" -ForegroundColor Yellow
    Write-Host "   Looking for .appx files in $BUILD_DIR..." -ForegroundColor Gray
    Get-ChildItem -Path $BUILD_DIR -Filter "*.appx" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "   Found: $($_.FullName)" -ForegroundColor Gray
    }
    Write-Host "   Looking for .msix files in $BUILD_DIR..." -ForegroundColor Gray
    Get-ChildItem -Path $BUILD_DIR -Filter "*.msix" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
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
if ($MSIX_PACKAGE) {
    Write-Host "   ✅ MSIX Package: $($MSIX_PACKAGE.Name) ($msixSize MB)" -ForegroundColor Green
    Write-Host "      Path: $($MSIX_PACKAGE.FullName)" -ForegroundColor Gray
} else {
    Write-Host "   ❌ MSIX Package: Not found" -ForegroundColor Red
}
Write-Host ""
Write-Host "🚀 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Test the MSIX package locally:" -ForegroundColor White
Write-Host "      - Double-click the .appx file to install" -ForegroundColor Gray
Write-Host "      - Or use: Add-AppxPackage -Path `"path\to\package.appx`"" -ForegroundColor Gray
Write-Host "   2. Upload to Microsoft Partner Center:" -ForegroundColor White
Write-Host "      - Go to https://partner.microsoft.com/dashboard" -ForegroundColor Gray
Write-Host "      - Navigate to your app submission" -ForegroundColor Gray
Write-Host "      - Upload the .appx file in the Packages section" -ForegroundColor Gray
Write-Host "   3. Submit for certification and publish" -ForegroundColor White
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Cyan
Write-Host "   - Electron Builder MSIX: https://www.electron.build/configuration/appx" -ForegroundColor Gray
Write-Host "   - Microsoft Partner Center: https://partner.microsoft.com/dashboard" -ForegroundColor Gray
Write-Host "   - Microsoft Store Policies: https://docs.microsoft.com/en-us/windows/uwp/publish/store-policies" -ForegroundColor Gray
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
