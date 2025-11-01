# MS Store submission MSI file upload to GCP Cloud Storage + Store Submission API
# Microsoft Store policy: https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/upload-app-packages
# Submission API: https://learn.microsoft.com/en-us/windows/apps/publish/store-submission-api

param(
    [Parameter(Mandatory=$false)]
    [string]$ProjectId = $env:GCP_PROJECT_ID,

    [Parameter(Mandatory=$false)]
    [string]$BucketName = $env:GCP_BUCKET_NAME,

    [Parameter(Mandatory=$false)]
    [string]$ServiceAccountKey = $env:GCP_SERVICE_ACCOUNT_KEY,

    [Parameter(Mandatory=$false)]
    [string]$MsiPath = "app/build/compose/binaries/main/msi/KleverDesktop-*.msi",

    [Parameter(Mandatory=$false)]
    [string]$Version = $null,  # Will be auto-detected from build.gradle.kts
    
    [Parameter(Mandatory=$false)]
    [switch]$SubmitToStore = $false,  # Submit to Microsoft Store after GCP upload
    
    [Parameter(Mandatory=$false)]
    [switch]$AutoCommit = $false  # Auto-commit the submission
)

$ErrorActionPreference = "Stop"

# Track Store submission status
$script:StoreSubmissionSucceeded = $false
$script:StoreSubmissionFailed = $false

Write-Host "=== MSI Upload to GCP Cloud Storage ===" -ForegroundColor Yellow
Write-Host "MS Store Policy Reference: https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/upload-app-packages" -ForegroundColor Yellow
Write-Host ""

# ============================================================================
# Step 1: Load environment variables if not already set
# ============================================================================
if (-not $ProjectId -or -not $BucketName -or -not $ServiceAccountKey) {
    Write-Host "🔧 Loading environment variables from .env file..."

    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $loadEnvScript = Join-Path $scriptDir "Load-DotEnv.ps1"

    if (Test-Path $loadEnvScript) {
        # Dot-source to load functions into current scope
        . $loadEnvScript
        
        # Load .env file from root directory
        $rootDir = Split-Path -Parent $scriptDir
        $envFilePath = Join-Path $rootDir ".env"
        
        if (Test-Path $envFilePath) {
            Load-DotEnv -Path $envFilePath
            Write-Host "✅ Environment variables loaded from .env file" -ForegroundColor Green

            # Re-read environment variables after loading
            if (-not $ProjectId) { $ProjectId = $env:GCP_PROJECT_ID }
            if (-not $BucketName) { $BucketName = $env:GCP_BUCKET_NAME }
            if (-not $ServiceAccountKey) { $ServiceAccountKey = $env:GCP_SERVICE_ACCOUNT_KEY }
        } else {
            Write-Host "⚠️  .env file not found at: $envFilePath" -ForegroundColor Yellow
        }
    } else {
        Write-Host "⚠️  Load-DotEnv.ps1 not found, using system environment only" -ForegroundColor Yellow
    }
}

# Color output function
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

# Get application version from build.gradle.kts
function Get-AppVersion {
    param(
        [string]$BuildFilePath = "app/build.gradle.kts"
    )

    if (-not (Test-Path $BuildFilePath)) {
        Write-Warning "Build file not found: $BuildFilePath"
        return "1.0.0"  # fallback version
    }

    try {
        $content = Get-Content $BuildFilePath -Raw
        if ($content -match 'packageVersion\s*=\s*"([^"]+)"') {
            $detectedVersion = $matches[1]
            # Remove any comments or extra text after the version
            $detectedVersion = $detectedVersion -replace '\s+.*$', ''
            Write-Host "  Auto-detected app version: $detectedVersion" -ForegroundColor Green
            return $detectedVersion
        } else {
            Write-Warning "Could not find packageVersion in $BuildFilePath"
            return "1.0.0"  # fallback version
        }
    } catch {
        Write-Warning "Error reading version from $BuildFilePath`: $($_.Exception.Message)"
        return "1.0.0"  # fallback version
    }
}

Write-ColorOutput Yellow "=== MS Store MSI File Upload to GCP Script - Klever Desktop ==="
Write-ColorOutput Yellow "MS Store Policy Reference: https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/upload-app-packages"
Write-Output ""

# Auto-detect version if not provided
if (-not $Version) {
    $Version = Get-AppVersion
}

# Check required parameters
if (-not $ProjectId) {
    Write-ColorOutput Red "Error: GCP_PROJECT_ID environment variable is not set."
    Write-Output "Usage: "
    Write-Output "  `$env:GCP_PROJECT_ID = 'your-project-id'"
    Write-Output "  `$env:GCP_BUCKET_NAME = 'your-bucket-name'"
    Write-Output "  `$env:GCP_SERVICE_ACCOUNT_KEY = 'path/to/service-account.json' or JSON content"
    exit 1
}

if (-not $BucketName) {
    Write-ColorOutput Red "Error: GCP_BUCKET_NAME environment variable is not set."
    exit 1
}

Write-ColorOutput Green "1. Environment Configuration Check"
Write-Output "  - GCP Project ID: $ProjectId"
Write-Output "  - Bucket Name: $BucketName"
Write-Output "  - MSI Path Pattern: $MsiPath"
Write-Output "  - Target Version: $Version"
Write-Output ""

# Find MSI files
Write-ColorOutput Green "2. MSI File Check"
$MsiFiles = Get-ChildItem -Path $MsiPath -ErrorAction SilentlyContinue

# If no files found with pattern, try alternative search methods
if (-not $MsiFiles) {
    Write-Output "  🔍 Trying alternative search methods..."

    # Try direct directory listing
    $MsiDirectory = "app/build/compose/binaries/main/msi"
    if (Test-Path $MsiDirectory) {
        $MsiFiles = Get-ChildItem -Path "$MsiDirectory/KleverDesktop-*.msi" -ErrorAction SilentlyContinue
    }

    # If still no files, try broader search
    if (-not $MsiFiles) {
        $MsiFiles = Get-ChildItem -Path "KleverDesktop-*.msi" -Recurse -ErrorAction SilentlyContinue
    }
}

if (-not $MsiFiles) {
    Write-ColorOutput Red "Error: No MSI file found: $MsiPath"
    Write-Output "Please build first: ./gradlew packageMsi"
    exit 1
}

$MsiFile = $MsiFiles[0]
$MsiFileName = $MsiFile.Name
$MsiFilePath = $MsiFile.FullName
$FileSizeMB = [math]::Round($MsiFile.Length / 1MB, 2)

Write-Output "  - File name: $MsiFileName"
Write-Output "  - Full path: $MsiFilePath"
Write-Output "  - File size: $FileSizeMB MB"
Write-Output ""

# Check gcloud CLI
Write-ColorOutput Green "3. gcloud CLI Check"
try {
    $gcloudVersion = gcloud --version 2>&1
    Write-Output "  - gcloud CLI installed"
} catch {
    Write-ColorOutput Red "Error: gcloud CLI is not installed."
    Write-Output "Installation guide: https://cloud.google.com/sdk/docs/install"
    Write-Output "Windows: "
    Write-Output "  - PowerShell: (New-Object Net.WebClient).DownloadFile('https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe', '$env:Temp\GoogleCloudSDKInstaller.exe'); & $env:Temp\GoogleCloudSDKInstaller.exe"
    exit 1
}

# Service account authentication
Write-ColorOutput Green "4. GCP Authentication"
if ($ServiceAccountKey) {
    if (Test-Path $ServiceAccountKey) {
        # File path case
        Write-Output "  - Authenticating with service account key file: $ServiceAccountKey"
        gcloud auth activate-service-account --key-file="$ServiceAccountKey"
    } else {
        # JSON content case (for GitHub Actions)
        $KeyFile = "$env:TEMP\gcp-service-account.json"
        $ServiceAccountKey | Out-File -FilePath $KeyFile -Encoding UTF8
        Write-Output "  - Authenticating with service account JSON"
        gcloud auth activate-service-account --key-file="$KeyFile"
        Remove-Item $KeyFile -Force
    }
} else {
    Write-Output "  - Using existing gcloud authentication"
}

# Set project
Write-Output "  - Setting project: $ProjectId"
gcloud config set project $ProjectId

# Check current authentication status
Write-Output "  - Checking authentication status"
$authCheck = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput Red "Error: GCP authentication failed."
    Write-Output $authCheck
    exit 1
}
Write-ColorOutput Green "  ✓ Authentication successful: $authCheck"
Write-Output ""

# Check bucket existence and create if needed
Write-ColorOutput Green "5. Cloud Storage Bucket Setup"
$bucketExists = gsutil ls -b gs://$BucketName 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Output "  - Bucket does not exist. Creating new bucket..."
    gsutil mb -p $ProjectId gs://$BucketName
    if ($LASTEXITCODE -ne 0) {
        Write-ColorOutput Red "Error: Failed to create bucket."
        exit 1
    }
    Write-ColorOutput Green "  ✓ Bucket created: gs://$BucketName"
} else {
    Write-ColorOutput Green "  ✓ Bucket confirmed: gs://$BucketName"
}

# Set bucket to public (MS Store policy requirement)
Write-Output "  - Setting bucket public access (MS Store requirement)"
gsutil iam ch allUsers:objectViewer gs://$BucketName
if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput Red "Error: Failed to set bucket public access."
    exit 1
}
Write-ColorOutput Green "  ✓ Public access configured"
Write-Output ""

# Upload MSI file
Write-ColorOutput Green "6. MSI File Upload"

# Extract project name from build.gradle.kts packageName
$ProjectName = "KleverDesktop"  # Default fallback
$BuildGradlePath = "app/build.gradle.kts"

if (Test-Path $BuildGradlePath) {
    $buildContent = Get-Content $BuildGradlePath -Raw
    if ($buildContent -match 'packageName = "([^"]+)"') {
        $ProjectName = $matches[1]
        Write-Output "  - Project name from build.gradle.kts: $ProjectName"
    } else {
        Write-Output "  - Using default project name: $ProjectName"
    }
} else {
    Write-Output "  - Using default project name: $ProjectName"
}

$TargetPath = "$ProjectName/$Version/$MsiFileName"
$GcsUri = "gs://$BucketName/$TargetPath"

Write-Output "  - Starting upload..."
Write-Output "    Source: $MsiFilePath"
Write-Output "    Target: $GcsUri"

# Execute upload (set Content-Type to application/octet-stream)
gsutil -h "Content-Type:application/octet-stream" cp "$MsiFilePath" "$GcsUri"
if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput Red "Error: File upload failed."
    exit 1
}

# Note: File public access is handled by bucket-level IAM policy
# No need for individual file ACL in uniform bucket-level access

Write-ColorOutput Green "  ✓ Upload completed"
Write-Output ""

# Generate and verify final URL
Write-ColorOutput Green "7. Download URL Generation and Verification"
$PublicUrl = "https://storage.googleapis.com/$BucketName/$TargetPath"

Write-Output "  - Generated HTTPS URL: $PublicUrl"

# Test URL accessibility
Write-Output "  - Testing URL accessibility..."
try {
    $response = Invoke-WebRequest -Uri $PublicUrl -Method Head -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-ColorOutput Green "  ✓ URL access successful (HTTP $($response.StatusCode))"
        Write-Output "    Content-Length: $($response.Headers['Content-Length'])"
        Write-Output "    Content-Type: $($response.Headers['Content-Type'])"
    } else {
        Write-ColorOutput Yellow "  ⚠ Unexpected response code: $($response.StatusCode)"
    }
} catch {
    Write-ColorOutput Red "  ✗ URL access failed: $($_.Exception.Message)"
    Write-Output "    It may take a few minutes for the URL to become publicly accessible."
}
Write-Output ""

# Result summary
Write-ColorOutput Green "=== Upload Complete - Klever Desktop ==="
Write-Output "MSI File: $MsiFileName ($FileSizeMB MB)"
Write-Output "GCS Path: $GcsUri"
Write-ColorOutput Yellow "MS Store Submission HTTPS URL:"
Write-ColorOutput Cyan "$PublicUrl"
Write-Output ""
Write-Output "Use the above URL for Microsoft Store submission."
Write-Output "Reference: https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/upload-app-packages"
Write-Output ""

# GitHub Actions environment variable output
if ($env:GITHUB_ACTIONS -eq "true") {
    Write-Output "::set-output name=msi-url::$PublicUrl"
    Write-Output "::set-output name=msi-filename::$MsiFileName"
    Write-Output "::set-output name=gcs-uri::$GcsUri"
    Write-Output "::set-output name=app-version::$Version"
}

# ============================================================================
# Optional: Submit to Microsoft Store
# ============================================================================
if ($SubmitToStore) {
    Write-Output ""
    Write-ColorOutput Green "8. Microsoft Store Submission"
    
    # Check required environment variables
    $storeAppId = $env:MS_STORE_APPLICATION_ID
    $storePackageId = $env:MS_STORE_PACKAGE_ID
    $storeTenantId = $env:MS_STORE_TENANT_ID
    $storeClientId = $env:MS_STORE_CLIENT_ID
    $storeClientSecret = $env:MS_STORE_CLIENT_SECRET
    
    if (-not $storeAppId -or -not $storePackageId -or -not $storeTenantId -or -not $storeClientId -or -not $storeClientSecret) {
        Write-ColorOutput Red "Error: Missing Microsoft Store environment variables"
        Write-Output "Required variables:"
        Write-Output "  - MS_STORE_APPLICATION_ID (Product ID, e.g., XP8BRB9SPKFRSW)"
        Write-Output "  - MS_STORE_PACKAGE_ID (Package ID, e.g., 77005012)"
        Write-Output "  - MS_STORE_TENANT_ID"
        Write-Output "  - MS_STORE_CLIENT_ID"
        Write-Output "  - MS_STORE_CLIENT_SECRET"
        Write-Output ""
        Write-ColorOutput Yellow "⏭️  Skipping Store submission"
    } else {
        try {
            # Step 1: Get Access Token
            Write-Output "  - Obtaining Microsoft Store access token..."
            $tokenUrl = "https://login.microsoftonline.com/$storeTenantId/oauth2/v2.0/token"
            $tokenBody = @{
                grant_type    = "client_credentials"
                client_id     = $storeClientId
                client_secret = $storeClientSecret
                scope         = "https://api.store.microsoft.com/.default"
            }
            
            $tokenResponse = Invoke-RestMethod -Uri $tokenUrl -Method Post -Body $tokenBody -ContentType "application/x-www-form-urlencoded"
            $accessToken = $tokenResponse.access_token
            Write-ColorOutput Green "  ✓ Access token obtained"
            
            # Step 2: Update Package with GCP URL
            Write-Output "  - Updating package $storePackageId with MSI URL..."
            $updatePackageUrl = "https://api.store.microsoft.com/submission/v1/product/$storeAppId/packages/$storePackageId"
            $packageHeaders = @{
                "Authorization" = "Bearer $accessToken"
                "Content-Type"  = "application/json"
            }
            
            $packageBody = @{
                packageUrl = $PublicUrl
                version = $Version
                architecture = "X86"
            } | ConvertTo-Json
            
            $updateResponse = Invoke-RestMethod -Uri $updatePackageUrl -Method Put -Headers $packageHeaders -Body $packageBody
            Write-ColorOutput Green "  ✓ Package updated successfully"
            
            # Step 3: Commit Package (if AutoCommit is enabled)
            if ($AutoCommit) {
                Write-Output "  - Committing package changes..."
                $commitUrl = "https://api.store.microsoft.com/submission/v1/product/$storeAppId/packages/commit"
                $commitBody = @{
                    packages = @(
                        @{
                            packageId = $storePackageId
                            packageUrl = $PublicUrl
                        }
                    )
                } | ConvertTo-Json -Depth 3
                
                $commitResponse = Invoke-RestMethod -Uri $commitUrl -Method Put -Headers $packageHeaders -Body $commitBody
                Write-ColorOutput Green "  ✓ Package committed successfully"
                Write-Output ""
                Write-ColorOutput Green "✅ Microsoft Store submission completed!"
                Write-Output "   - Product ID: $storeAppId"
                Write-Output "   - Package ID: $storePackageId"
                Write-Output "   - Version: $Version"
                Write-Output "   - Status: Committed"
            } else {
                Write-ColorOutput Yellow "  ⚠️  Package updated but not committed"
                Write-Output "   - To commit, run with -AutoCommit flag"
                Write-Output "   - Or commit manually in Partner Center"
            }
            
            # Mark Store submission as succeeded
            $script:StoreSubmissionSucceeded = $true
            
        } catch {
            Write-ColorOutput Red "Error: Microsoft Store submission failed"
            Write-Output "  $($_.Exception.Message)"
            if ($_.ErrorDetails) {
                Write-Output "  Details: $($_.ErrorDetails.Message)"
            }
            Write-ColorOutput Yellow "⏭️  Continuing without Store submission"
            # Set exit code to indicate Store submission failure (but GCP upload succeeded)
            # Use exit code 2 to distinguish from complete failure (exit code 1)
            $script:StoreSubmissionFailed = $true
        }
    }
}

Write-Output ""
Write-ColorOutput Green "Script execution completed!"

# Output Store submission status for parent script to detect
if ($SubmitToStore) {
    if ($script:StoreSubmissionSucceeded) {
        Write-Output "STORE_SUBMISSION_STATUS=SUCCESS"
    } elseif ($script:StoreSubmissionFailed) {
        Write-Output "STORE_SUBMISSION_STATUS=FAILED"
    }
}