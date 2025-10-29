# ============================================================================
# Windows Store MSI Build Script
# Klever Desktop - Kotlin Compose Desktop App
# ============================================================================

param(
    [string]$Version = "",
    [switch]$SkipBuild = $false,
    [switch]$Verbose = $false,
    [switch]$UploadToGCP = $false
)

$ErrorActionPreference = "Stop"

Write-Host "============================================"
Write-Host "🏪 Windows Store MSI Build - Klever Desktop"
Write-Host "============================================"

# ============================================================================
# Step 1: Load environment variables from .env file
# ============================================================================
Write-Host ""
Write-Host "🔧 [1/4] Loading environment configuration..."

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir

# Load .env file using our utility script
$loadEnvScript = Join-Path $scriptDir "Load-DotEnv.ps1"
if (Test-Path $loadEnvScript) {
    & $loadEnvScript
    Write-Host "✅ Environment variables loaded from .env file"
} else {
    Write-Host "⚠️  Load-DotEnv.ps1 not found, using system environment only"
}

# ============================================================================
# Step 2: Determine version
# ============================================================================
Write-Host ""
Write-Host "📋 [2/4] Setting up version information..."

if ([string]::IsNullOrEmpty($Version)) {
    # Get version from build.gradle.kts using our utility script
    $getVersionScript = Join-Path $scriptDir "Get-AppVersion.ps1"
    if (Test-Path $getVersionScript) {
        $Version = & $getVersionScript
        Write-Host "✅ Version detected from build.gradle.kts: $Version"
    } else {
        Write-Host "❌ Error: Get-AppVersion.ps1 not found and no version specified"
        exit 1
    }
} else {
    Write-Host "✅ Version specified as parameter: $Version"
}

# ============================================================================
# Step 3: Process configuration files for production (if needed)
# ============================================================================
Write-Host ""
Write-Host "📊 [3/4] Processing configuration files for production..."

# Configuration file paths - adjust based on Klever Desktop structure
$analyticsPropsPath = Join-Path $rootDir "app\src\main\resources\analytics.properties"
$analyticsBackupPath = Join-Path $rootDir "app\src\main\resources\analytics.properties.backup"

# Check configuration status
$googleAnalyticsConfigured = (-not [string]::IsNullOrEmpty($env:GOOGLE_ANALYTICS_ID)) -and (-not [string]::IsNullOrEmpty($env:GOOGLE_ANALYTICS_API_SECRET))

Write-Host "   Configuration Status:"
Write-Host "   - Google Analytics: $(if ($googleAnalyticsConfigured) { '✅ Configured' } else { '⚠️  Not configured' })"

# Process Google Analytics configuration
if ($googleAnalyticsConfigured -and (Test-Path $analyticsPropsPath)) {
    Write-Host "🔄 Processing Google Analytics configuration..."
    Copy-Item -Path $analyticsPropsPath -Destination $analyticsBackupPath -Force

    $content = Get-Content -Path $analyticsPropsPath -Raw
    $content = $content -replace '\{\{GOOGLE_ANALYTICS_ID\}\}', $env:GOOGLE_ANALYTICS_ID
    $content = $content -replace '\{\{GOOGLE_ANALYTICS_API_SECRET\}\}', $env:GOOGLE_ANALYTICS_API_SECRET
    Set-Content -Path $analyticsPropsPath -Value $content -Encoding UTF8

    Write-Host "   ✅ Google Analytics configuration processed"
} else {
    Write-Host "   ⚠️  Skipping Google Analytics configuration (not configured or file not found)"
}

# ============================================================================
# Step 4: Build MSI
# ============================================================================
Write-Host ""
Write-Host "🔨 [4/4] Building MSI package..."

if (-not $SkipBuild) {
    Write-Host "🚀 Starting MSI build process..."

    # Set build environment
    $env:BUILD_FOR_WINDOWS_STORE = "true"

    # Change to project root directory
    Push-Location $rootDir

    try {
        # Build MSI using Gradle
        $gradleArgs = @(
            ":app:packageMsi"
            "-Dorg.gradle.parallel=true"
            "-Dkotlin.daemon.jvmargs=-Xmx2g"
        )

        if ($Verbose) {
            $gradleArgs += "--info"
        }

        Write-Host "   Executing: .\gradlew.bat $($gradleArgs -join ' ')"
        & .\gradlew.bat $gradleArgs

        if ($LASTEXITCODE -ne 0) {
            throw "Gradle build failed with exit code: $LASTEXITCODE"
        }

        Write-Host "✅ MSI build completed successfully"

        # Find the generated MSI file
        $msiDir = Join-Path $rootDir "app\build\compose\binaries\main\msi"
        $msiFiles = Get-ChildItem -Path $msiDir -Filter "KleverDesktop-*.msi" -ErrorAction SilentlyContinue

        if ($msiFiles) {
            $latestMsi = $msiFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1
            $msiSize = [math]::Round(($latestMsi.Length / 1MB), 2)
            Write-Host "📦 MSI file created: $($latestMsi.Name) ($msiSize MB)"
            Write-Host "   Location: $($latestMsi.FullName)"
        } else {
            Write-Host "⚠️  Warning: MSI file not found in expected location: $msiDir"
        }

    } catch {
        Write-Host "❌ Build failed: $($_.Exception.Message)"
        throw
    } finally {
        Pop-Location
    }
} else {
    Write-Host "⏭️  Skipping build (SkipBuild flag specified)"
}

# ============================================================================
# Cleanup: Restore configuration templates
# ============================================================================
Write-Host ""
Write-Host "🧹 Restoring configuration templates..."

# Restore Google Analytics template
if (Test-Path $analyticsBackupPath) {
    Move-Item -Path $analyticsBackupPath -Destination $analyticsPropsPath -Force
    Write-Host "   ✅ Google Analytics template restored"
}

# ============================================================================
# Optional: Upload to GCP for Microsoft Store submission
# ============================================================================
if ($UploadToGCP -and -not $SkipBuild) {
    Write-Host ""
    Write-Host "🚀 [5/5] Uploading MSI to Google Cloud Platform..."

    # Check GCP environment variables
    $gcpVars = @{
        "GCP_PROJECT_ID" = $env:GCP_PROJECT_ID
        "GCP_BUCKET_NAME" = $env:GCP_BUCKET_NAME
        "GCP_SERVICE_ACCOUNT_KEY" = $env:GCP_SERVICE_ACCOUNT_KEY
    }

    $gcpConfigured = $true
    foreach ($varName in $gcpVars.Keys) {
        if ([string]::IsNullOrEmpty($gcpVars[$varName])) {
            Write-Host "❌ $varName is not set" -ForegroundColor Red
            $gcpConfigured = $false
        } else {
            Write-Host "   ✅ $varName configured" -ForegroundColor Green
        }
    }

    if (-not $gcpConfigured) {
        Write-Host ""
        Write-Host "❌ GCP environment variables not configured!" -ForegroundColor Red
        Write-Host "💡 Add these to your .env file:" -ForegroundColor Yellow
        Write-Host "   GCP_PROJECT_ID=your-project-id" -ForegroundColor Cyan
        Write-Host "   GCP_BUCKET_NAME=your-bucket-name" -ForegroundColor Cyan
        Write-Host "   GCP_SERVICE_ACCOUNT_KEY=./gcp-service-account.json" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "⏭️  Skipping GCP upload due to missing configuration"
    } else {
        try {
            # Find the latest MSI file
            $msiDir = Join-Path $rootDir "app\build\compose\binaries\main\msi"
            $latestMsi = Get-ChildItem -Path $msiDir -Filter "KleverDesktop-*.msi" -ErrorAction Stop |
                         Sort-Object LastWriteTime -Descending |
                         Select-Object -First 1

            if ($latestMsi) {
                Write-Host "📦 Found MSI: $($latestMsi.Name)"

                # Call the upload script with the found MSI
                $uploadScript = Join-Path $scriptDir "upload-msi-to-gcp.ps1"
                if (Test-Path $uploadScript) {
                    Write-Host "   🔗 Calling upload script..."
                    & $uploadScript -MsiPath $latestMsi.FullName -Version $Version

                    if ($LASTEXITCODE -eq 0) {
                        Write-Host "✅ GCP upload completed successfully!" -ForegroundColor Green
                    } else {
                        Write-Host "❌ GCP upload failed" -ForegroundColor Red
                    }
                } else {
                    Write-Host "❌ Upload script not found: $uploadScript" -ForegroundColor Red
                }
            } else {
                Write-Host "❌ No MSI file found to upload" -ForegroundColor Red
            }
        } catch {
            Write-Host "❌ GCP upload failed: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
} elseif ($UploadToGCP -and $SkipBuild) {
    Write-Host ""
    Write-Host "⚠️  Cannot upload to GCP when build is skipped" -ForegroundColor Yellow
}

# ============================================================================
# Summary
# ============================================================================
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════"
Write-Host "🎯 BUILD SUMMARY - Klever Desktop"
Write-Host "═══════════════════════════════════════════════════════════════"
Write-Host "📱 App Version: $Version"
Write-Host "🏪 Target: Windows Store (MSI)"
Write-Host "📊 Google Analytics: $(if ($googleAnalyticsConfigured) { '✅ Configured' } else { '⚠️  Not configured' })"
Write-Host "☁️  GCP Upload: $(if ($UploadToGCP) { '✅ Requested' } else { '⚠️  Skipped' })"

if (-not $SkipBuild) {
    Write-Host "✅ MSI package ready for Windows Store submission"
} else {
    Write-Host "⏭️  Build skipped - configuration processing only"
}

Write-Host ""
if ($UploadToGCP) {
    Write-Host "💡 Next steps for Windows Store:"
    Write-Host "   1. Test the MSI package locally"
    Write-Host "   2. Use the generated GCP URL for Microsoft Partner Center submission"
    Write-Host "   3. Complete Microsoft Store certification process"
} else {
    Write-Host "💡 Next steps for Windows Store:"
    Write-Host "   1. Test the MSI package locally"
    Write-Host "   2. Upload MSI to GCP: .\scripts\build-windows-store.ps1 -UploadToGCP"
    Write-Host "   3. Submit to Microsoft Partner Center"
    Write-Host "   4. Complete Microsoft Store certification process"
}
Write-Host "═══════════════════════════════════════════════════════════════"