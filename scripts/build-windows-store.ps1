# ============================================================================
# Windows Store MSI Build Script
# Klever Desktop - Kotlin Compose Desktop App
# ============================================================================

param(
    [string]$Version = "",
    [switch]$SkipBuild = $false,
    [switch]$Verbose = $false,
    [switch]$UploadToGCP = $false,
    [switch]$UploadToStore = $false,
    [switch]$AutoCommit = $false,
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
    Write-Host "  -UploadToStore        Upload MSI to Microsoft Store via Submission API"
    Write-Host "  -AutoCommit           Automatically commit submission to Microsoft Store (requires -UploadToStore)"
    Write-Host "  -Help                 Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\scripts\build-windows-store.ps1                           # Build MSI with auto-detected version"
    Write-Host "  .\scripts\build-windows-store.ps1 -Version 1.2.0            # Build MSI with specific version"
    Write-Host "  .\scripts\build-windows-store.ps1 -UploadToGCP              # Build and upload to GCP"
    Write-Host "  .\scripts\build-windows-store.ps1 -UploadToStore            # Build, upload to GCP, and submit to Store"
    Write-Host "  .\scripts\build-windows-store.ps1 -UploadToStore -AutoCommit # Build, upload, submit, and auto-commit"
    Write-Host "  .\scripts\build-windows-store.ps1 -SkipBuild                # Only process configuration"
    Write-Host ""
    Write-Host "Environment Setup:"
    Write-Host "  1. Copy .env.example to .env"
    Write-Host "  2. Edit .env with your configuration (required variables):"
    Write-Host "     # GCP Upload (required for Store submission)"
    Write-Host "     GCP_PROJECT_ID=your-project-id"
    Write-Host "     GCP_BUCKET_NAME=your-bucket-name"
    Write-Host "     GCP_SERVICE_ACCOUNT_KEY=./gcp-service-account.json"
    Write-Host ""
    Write-Host "     # Microsoft Store Submission API"
    Write-Host "     MS_STORE_APPLICATION_ID=XP8BRB9SPKFRSW  # Product/Store ID"
    Write-Host "     MS_STORE_PACKAGE_ID=77005012           # Package ID to update"
    Write-Host "     MS_STORE_TENANT_ID=your-tenant-id"
    Write-Host "     MS_STORE_CLIENT_ID=your-client-id"
    Write-Host "     MS_STORE_CLIENT_SECRET=your-client-secret"
    Write-Host ""
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
$totalSteps = if ($UploadToStore) { 7 } elseif ($UploadToGCP) { 5 } else { 4 }
Write-Host ""
Write-Host "🔧 [1/$totalSteps] Loading environment configuration..."

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
                
                # Test environment variables based on what we're doing
                Write-Host "   🔍 Testing environment variables..."
                if ($UploadToStore) {
                    $envTestResult = Test-DotEnvVariables -StoreSubmission
                    if (-not $envTestResult) {
                        Write-Host "⚠️  Store Submission environment variables are missing." -ForegroundColor Yellow
                        Write-Host "💡 Run 'Test-DotEnvVariables -StoreSubmission' to check required variables" -ForegroundColor Cyan
                        Write-Host "💡 Required: MS_STORE_TENANT_ID, MS_STORE_CLIENT_ID, MS_STORE_CLIENT_SECRET, MS_STORE_APPLICATION_ID" -ForegroundColor Cyan
                    } else {
                        Write-Host "✅ All required Store Submission environment variables are configured" -ForegroundColor Green
                    }
                } else {
                    $envTestResult = Test-DotEnvVariables -MSIUpload
                    if (-not $envTestResult) {
                        Write-Host "⚠️  Some environment variables are missing. Build may fail." -ForegroundColor Yellow
                        Write-Host "💡 Run 'Test-DotEnvVariables -MSIUpload' to check required variables" -ForegroundColor Cyan
                    } else {
                        Write-Host "✅ All required environment variables are configured" -ForegroundColor Green
                    }
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
Write-Host "📋 [2/$totalSteps] Setting up version information..."

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
Write-Host "📊 [3/$totalSteps] Preparing for production build..."

Write-Host "   ✅ Production build preparation completed"

# ============================================================================
# Step 4: Build MSI
# ============================================================================
Write-Host ""
Write-Host "🔨 [4/$totalSteps] Building MSI package..."

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

# Store the MSI path for later use
$builtMsiPath = $null
if (-not $SkipBuild) {
    $msiDir = Join-Path $rootDir "app\build\compose\binaries\main\msi"
    $msiFiles = Get-ChildItem -Path $msiDir -Filter "KleverDesktop-*.msi" -ErrorAction SilentlyContinue
    if ($msiFiles) {
        $builtMsiPath = ($msiFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
    }
}

# ============================================================================
# Cleanup: Build completed
# ============================================================================
Write-Host ""
Write-Host "🧹 Build cleanup completed..."

# ============================================================================
# Optional: Upload to GCP (and optionally submit to Store)
# ============================================================================
if (($UploadToGCP -or $UploadToStore) -and -not $SkipBuild) {
    Write-Host ""
    $gcpStep = if ($UploadToStore) { 5 } else { 5 }
    Write-Host "🚀 [$gcpStep/$totalSteps] Uploading MSI to Google Cloud Platform$(if ($UploadToStore) {' and submitting to Store'})..."

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
                    
                    # Build arguments for upload script
                    $uploadArgs = @(
                        "-MsiPath", $latestMsi.FullName,
                        "-Version", $Version
                    )
                    
                    # Add Store submission flags if requested
                    if ($UploadToStore) {
                        $uploadArgs += "-SubmitToStore"
                        if ($AutoCommit -or ($env:MS_STORE_AUTO_COMMIT -eq "true")) {
                            $uploadArgs += "-AutoCommit"
                        }
                    }
                    
                    & $uploadScript @uploadArgs

                    if ($LASTEXITCODE -eq 0) {
                        Write-Host "✅ Upload completed successfully!" -ForegroundColor Green
                        if ($UploadToStore) {
                            Write-Host "✅ Store submission completed!" -ForegroundColor Green
                        }
                    } else {
                        Write-Host "❌ Upload/submission failed" -ForegroundColor Red
                    }
                } else {
                    Write-Host "❌ Upload script not found: $uploadScript" -ForegroundColor Red
                }
            } else {
                Write-Host "❌ No MSI file found to upload" -ForegroundColor Red
            }
        } catch {
            Write-Host "❌ Upload failed: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
} elseif (($UploadToGCP -or $UploadToStore) -and $SkipBuild) {
    Write-Host ""
    Write-Host "⚠️  Cannot upload when build is skipped" -ForegroundColor Yellow
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
Write-Host "🏪 Store Submission: $(if ($UploadToStore) { '✅ Requested' } else { '⚠️  Skipped' })"
if ($UploadToStore) {
    Write-Host "   Auto Commit: $(if ($AutoCommit -or ($env:MS_STORE_AUTO_COMMIT -eq 'true')) { '✅ Enabled' } else { '⚠️  Disabled' })"
}

if (-not $SkipBuild) {
    Write-Host "✅ MSI package ready for Windows Store submission"
} else {
    Write-Host "⏭️  Build skipped - configuration processing only"
}

Write-Host ""
if ($UploadToStore) {
    if ($AutoCommit -or ($env:MS_STORE_AUTO_COMMIT -eq "true")) {
        Write-Host "💡 Next steps for Windows Store:"
        Write-Host "   1. Package has been committed to Microsoft Store"
        Write-Host "   2. Check Partner Center for package validation status"
        Write-Host "   3. Monitor package updates in Partner Center"
        Write-Host "   4. Package ID $($env:MS_STORE_PACKAGE_ID) has been updated with version $Version"
    } else {
        Write-Host "💡 Next steps for Windows Store:"
        Write-Host "   1. Package has been updated but not committed"
        Write-Host "   2. Review changes in Partner Center"
        Write-Host "   3. Commit manually or rerun with -AutoCommit flag"
        Write-Host "   4. Package ID: $($env:MS_STORE_PACKAGE_ID)"
    }
} elseif ($UploadToGCP) {
    Write-Host "💡 Next steps for Windows Store:"
    Write-Host "   1. Test the MSI package locally"
    Write-Host "   2. MSI uploaded to GCP - use URL in Partner Center"
    Write-Host "   3. Or automate: .\scripts\build-windows-store.ps1 -UploadToStore"
    Write-Host "   4. Complete Microsoft Store certification process"
} else {
    Write-Host "💡 Next steps for Windows Store:"
    Write-Host "   1. Test the MSI package locally"
    Write-Host "   2. Upload & submit: .\scripts\build-windows-store.ps1 -UploadToStore"
    Write-Host "   3. Or just upload: .\scripts\build-windows-store.ps1 -UploadToGCP"
    Write-Host ""
    Write-Host "🔧 Environment troubleshooting:"
    Write-Host "   - Check .env file: .\scripts\Load-DotEnv.ps1; Show-DotEnv"
    Write-Host "   - Test GCP vars: Test-DotEnvVariables -MSIUpload"
    Write-Host "   - Get help: .\scripts\build-windows-store.ps1 -Help"
}
Write-Host "═══════════════════════════════════════════════════════════════"