# ============================================================================
# Windows Store MSI Build Script
# Klever Desktop - Kotlin Compose Desktop App
# ============================================================================

param(
    [string]$Version = "",
    [switch]$SkipBuild = $false,
    [switch]$Verbose = $false,
    [switch]$UploadToGCP = $false,
    [switch]$Help = $false
)

$ErrorActionPreference = "Stop"

# Show help if requested
if ($Help) {
    Write-Host "============================================"
    Write-Host "🏪 Windows Store MSI Build - Klever Desktop"
    Write-Host "============================================"
    Write-Host ""
    Write-Host "Usage: .\scripts\build-windows-store.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Version <version>     Specify version (auto-detected if not provided)"
    Write-Host "  -SkipBuild            Skip MSI build, only process configuration"
    Write-Host "  -Verbose              Enable verbose Gradle output"
    Write-Host "  -UploadToGCP          Upload MSI to Google Cloud Platform after build"
    Write-Host "  -Help                 Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\scripts\build-windows-store.ps1                    # Build MSI with auto-detected version"
    Write-Host "  .\scripts\build-windows-store.ps1 -Version 1.2.0     # Build MSI with specific version"
    Write-Host "  .\scripts\build-windows-store.ps1 -UploadToGCP       # Build and upload to GCP"
    Write-Host "  .\scripts\build-windows-store.ps1 -SkipBuild         # Only process configuration"
    Write-Host ""
    Write-Host "Environment Setup:"
    Write-Host "  1. Copy .env.example to .env"
    Write-Host "  2. Edit .env with your configuration"
    Write-Host "  3. Run: .\scripts\Load-DotEnv.ps1"
    Write-Host "  4. Test: Test-DotEnvVariables -MSIUpload"
    Write-Host ""
    exit 0
}

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
$envFilePath = Join-Path $rootDir ".env"

if (Test-Path $loadEnvScript) {
    try {
        # Load the dotenv functions
        . $loadEnvScript
        
        # Load environment variables from root .env file
        if (Test-Path $envFilePath) {
            Write-Host "   📁 Found .env file at: $envFilePath"
            $loadResult = Load-DotEnv -Path $envFilePath
            if ($loadResult) {
                Write-Host "✅ Environment variables loaded from .env file"
                
                # Test environment variables for MSI build
                Write-Host "   🔍 Testing environment variables..."
                $envTestResult = Test-DotEnvVariables -MSIUpload
                if (-not $envTestResult) {
                    Write-Host "⚠️  Some environment variables are missing. Build may fail." -ForegroundColor Yellow
                    Write-Host "💡 Run 'Test-DotEnvVariables -MSIUpload' to check required variables" -ForegroundColor Cyan
                } else {
                    Write-Host "✅ All required environment variables are configured" -ForegroundColor Green
                }
            } else {
                Write-Host "❌ Failed to load environment variables from .env file" -ForegroundColor Red
            }
        } else {
            Write-Host "⚠️  .env file not found at: $envFilePath" -ForegroundColor Yellow
            Write-Host "💡 Create .env file in project root with required variables" -ForegroundColor Cyan
        }
    } catch {
        Write-Host "❌ Error loading environment variables: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "⚠️  Continuing with system environment only" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  Load-DotEnv.ps1 not found, using system environment only" -ForegroundColor Yellow
    Write-Host "💡 Create .env file with required variables for better configuration management" -ForegroundColor Cyan
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
# Step 3: Prepare for production build
# ============================================================================
Write-Host ""
Write-Host "📊 [3/4] Preparing for production build..."

Write-Host "   ✅ Production build preparation completed"

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
# Cleanup: Build completed
# ============================================================================
Write-Host ""
Write-Host "🧹 Build cleanup completed..."

# ============================================================================
# Optional: Upload to GCP for Microsoft Store submission
# ============================================================================
if ($UploadToGCP -and -not $SkipBuild) {
    Write-Host ""
    Write-Host "🚀 [5/5] Uploading MSI to Google Cloud Platform..."

    # Use the enhanced environment variable testing
    . $loadEnvScript
    if (Test-Path $envFilePath) {
        Load-DotEnv -Path $envFilePath
    }
    $gcpConfigured = Test-DotEnvVariables -MSIUpload

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
    Write-Host ""
    Write-Host "🔧 Environment troubleshooting:"
    Write-Host "   - Check .env file: .\scripts\Load-DotEnv.ps1; Show-DotEnv"
    Write-Host "   - Test variables: Test-DotEnvVariables -MSIUpload"
    Write-Host "   - Get help: .\scripts\build-windows-store.ps1 -Help"
}
Write-Host "═══════════════════════════════════════════════════════════════"