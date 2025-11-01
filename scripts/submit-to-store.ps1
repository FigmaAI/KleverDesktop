# ============================================================================
# Microsoft Store Submission API Functions
# Klever Desktop - Kotlin Compose Desktop App
# ============================================================================
# This module provides functions to interact with Microsoft Store Submission API
# Reference: https://learn.microsoft.com/en-us/windows/apps/publish/store-submission-api

$ErrorActionPreference = "Stop"

# Microsoft Store API endpoints
$MS_STORE_AUTH_URL = "https://login.microsoftonline.com/{0}/oauth2/v2.0/token"
$MS_STORE_API_BASE = "https://manage.devcenter.microsoft.com/v1.0/my/applications"

# ============================================================================
# Get Microsoft Access Token
# ============================================================================
function Get-MSAccessToken {
    param(
        [Parameter(Mandatory=$true)]
        [string]$TenantId,
        
        [Parameter(Mandatory=$true)]
        [string]$ClientId,
        
        [Parameter(Mandatory=$true)]
        [string]$ClientSecret
    )

    Write-Host "🔐 Obtaining Microsoft Access Token..." -ForegroundColor Cyan

    $tokenUrl = $MS_STORE_AUTH_URL -f $TenantId
    
    $body = @{
        client_id     = $ClientId
        client_secret = $ClientSecret
        scope         = "https://manage.devcenter.microsoft.com/.default"
        grant_type    = "client_credentials"
    }

    try {
        $response = Invoke-RestMethod -Uri $tokenUrl -Method Post -Body $body -ContentType "application/x-www-form-urlencoded"
        
        if ($response.access_token) {
            Write-Host "✅ Access token obtained successfully" -ForegroundColor Green
            return $response.access_token
        } else {
            throw "Access token not found in response"
        }
    } catch {
        Write-Host "❌ Failed to obtain access token: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails) {
            Write-Host "   Error details: $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
        throw
    }
}

# ============================================================================
# Get Store Submission (create new or get existing)
# ============================================================================
function Get-StoreSubmission {
    param(
        [Parameter(Mandatory=$true)]
        [string]$AccessToken,
        
        [Parameter(Mandatory=$true)]
        [string]$ApplicationId
    )

    Write-Host "📋 Getting Store Submission..." -ForegroundColor Cyan

    $headers = @{
        "Authorization" = "Bearer $AccessToken"
        "Content-Type"  = "application/json"
    }

    $submissionsUrl = "$MS_STORE_API_BASE/$ApplicationId/submissions"

    try {
        # Try to get existing pending submission first
        $existingSubmissions = Invoke-RestMethod -Uri $submissionsUrl -Method Get -Headers $headers
        
        if ($existingSubmissions.value -and $existingSubmissions.value.Count -gt 0) {
            # Find the most recent pending submission
            $pendingSubmission = $existingSubmissions.value | Where-Object { 
                $_.status -eq "PendingCommit" -or $_.status -eq "PendingUpload" 
            } | Sort-Object -Property lastModifiedDate -Descending | Select-Object -First 1
            
            if ($pendingSubmission) {
                Write-Host "✅ Found existing pending submission (ID: $($pendingSubmission.id))" -ForegroundColor Green
                return $pendingSubmission
            }
        }

        # Create new submission
        Write-Host "   Creating new submission..." -ForegroundColor Yellow
        $newSubmissionBody = @{
            applicationCategory = "Desktop"
        } | ConvertTo-Json

        $newSubmission = Invoke-RestMethod -Uri $submissionsUrl -Method Post -Headers $headers -Body $newSubmissionBody
        
        if ($newSubmission.id) {
            Write-Host "✅ New submission created (ID: $($newSubmission.id))" -ForegroundColor Green
            return $newSubmission
        } else {
            throw "Submission ID not found in response"
        }
    } catch {
        Write-Host "❌ Failed to get/create submission: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails) {
            Write-Host "   Error details: $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
        throw
    }
}

# ============================================================================
# Get SAS URI for package upload
# ============================================================================
function Get-PackageUploadUrl {
    param(
        [Parameter(Mandatory=$true)]
        [string]$AccessToken,
        
        [Parameter(Mandatory=$true)]
        [string]$ApplicationId,
        
        [Parameter(Mandatory=$true)]
        [string]$SubmissionId
    )

    Write-Host "📦 Getting package upload URL..." -ForegroundColor Cyan

    $headers = @{
        "Authorization" = "Bearer $AccessToken"
        "Content-Type"  = "application/json"
    }

    $packagesUrl = "$MS_STORE_API_BASE/$ApplicationId/submissions/$SubmissionId/packages"

    try {
        $response = Invoke-RestMethod -Uri $packagesUrl -Method Get -Headers $headers
        
        if ($response.value -and $response.value.Count -gt 0) {
            # Return the first package upload URL
            $uploadUrl = $response.value[0].fileUploadUrl
            if ($uploadUrl) {
                Write-Host "✅ Package upload URL obtained" -ForegroundColor Green
                return $uploadUrl
            }
        }
        
        throw "No package upload URL found in response"
    } catch {
        Write-Host "❌ Failed to get package upload URL: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails) {
            Write-Host "   Error details: $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
        throw
    }
}

# ============================================================================
# Upload MSI to Azure Blob Storage using SAS URI
# ============================================================================
function Upload-MSIToAzureBlob {
    param(
        [Parameter(Mandatory=$true)]
        [string]$MsiPath,
        
        [Parameter(Mandatory=$true)]
        [string]$SasUri
    )

    Write-Host "📤 Uploading MSI to Azure Blob Storage..." -ForegroundColor Cyan

    if (-not (Test-Path $MsiPath)) {
        throw "MSI file not found: $MsiPath"
    }

    try {
        $fileContent = [System.IO.File]::ReadAllBytes($MsiPath)
        $fileSizeMB = [math]::Round(($fileContent.Length / 1MB), 2)
        
        Write-Host "   File: $(Split-Path -Leaf $MsiPath)" -ForegroundColor Yellow
        Write-Host "   Size: $fileSizeMB MB" -ForegroundColor Yellow
        
        # Upload using PUT method with SAS URI
        $headers = @{
            "x-ms-blob-type" = "BlockBlob"
            "Content-Type"   = "application/octet-stream"
        }
        
        $response = Invoke-WebRequest -Uri $SasUri -Method Put -Body $fileContent -Headers $headers -UseBasicParsing
        
        if ($response.StatusCode -eq 201 -or $response.StatusCode -eq 200) {
            Write-Host "✅ MSI uploaded successfully" -ForegroundColor Green
            return $true
        } else {
            throw "Upload failed with status code: $($response.StatusCode)"
        }
    } catch {
        Write-Host "❌ Failed to upload MSI: $($_.Exception.Message)" -ForegroundColor Red
        throw
    }
}

# ============================================================================
# Update Store Submission with package URL
# ============================================================================
function Update-StoreSubmission {
    param(
        [Parameter(Mandatory=$true)]
        [string]$AccessToken,
        
        [Parameter(Mandatory=$true)]
        [string]$ApplicationId,
        
        [Parameter(Mandatory=$true)]
        [string]$SubmissionId,
        
        [Parameter(Mandatory=$true)]
        [string]$PackageUrl
    )

    Write-Host "📝 Updating Store Submission..." -ForegroundColor Cyan

    $headers = @{
        "Authorization" = "Bearer $AccessToken"
        "Content-Type"  = "application/json"
    }

    $submissionUrl = "$MS_STORE_API_BASE/$ApplicationId/submissions/$SubmissionId"

    try {
        # First get current submission to preserve existing data
        $currentSubmission = Invoke-RestMethod -Uri $submissionUrl -Method Get -Headers $headers
        
        # Update package URL
        $currentSubmission.applicationPackages[0].fileName = Split-Path -Leaf $PackageUrl
        $currentSubmission.applicationPackages[0].fileStatus = "PendingUpload"
        
        # Update submission
        $updateBody = $currentSubmission | ConvertTo-Json -Depth 10
        
        $updatedSubmission = Invoke-RestMethod -Uri $submissionUrl -Method Put -Headers $headers -Body $updateBody
        
        Write-Host "✅ Submission updated successfully" -ForegroundColor Green
        return $updatedSubmission
    } catch {
        Write-Host "❌ Failed to update submission: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails) {
            Write-Host "   Error details: $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
        throw
    }
}

# ============================================================================
# Commit Store Submission
# ============================================================================
function Commit-StoreSubmission {
    param(
        [Parameter(Mandatory=$true)]
        [string]$AccessToken,
        
        [Parameter(Mandatory=$true)]
        [string]$ApplicationId,
        
        [Parameter(Mandatory=$true)]
        [string]$SubmissionId
    )

    Write-Host "🚀 Committing Store Submission..." -ForegroundColor Cyan

    $headers = @{
        "Authorization" = "Bearer $AccessToken"
        "Content-Type"  = "application/json"
    }

    $commitUrl = "$MS_STORE_API_BASE/$ApplicationId/submissions/$SubmissionId/commit"

    try {
        $response = Invoke-RestMethod -Uri $commitUrl -Method Post -Headers $headers
        
        Write-Host "✅ Submission committed successfully" -ForegroundColor Green
        Write-Host "   Submission will now be processed by Microsoft" -ForegroundColor Yellow
        return $response
    } catch {
        Write-Host "❌ Failed to commit submission: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails) {
            Write-Host "   Error details: $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
        throw
    }
}

# ============================================================================
# Complete Store Submission Workflow
# ============================================================================
function Submit-ToStore {
    param(
        [Parameter(Mandatory=$true)]
        [string]$MsiPath,
        
        [Parameter(Mandatory=$false)]
        [switch]$AutoCommit = $false
    )

    Write-Host "═══════════════════════════════════════════════════════════════"
    Write-Host "🏪 Microsoft Store Submission - Klever Desktop"
    Write-Host "═══════════════════════════════════════════════════════════════"
    Write-Host ""

    # Get environment variables
    $tenantId = $env:MS_STORE_TENANT_ID
    $clientId = $env:MS_STORE_CLIENT_ID
    $clientSecret = $env:MS_STORE_CLIENT_SECRET
    $applicationId = $env:MS_STORE_APPLICATION_ID
    $autoCommitFlag = if ($env:MS_STORE_AUTO_COMMIT -eq "true") { $true } else { $AutoCommit }

    # Validate required variables
    if (-not $tenantId -or -not $clientId -or -not $clientSecret -or -not $applicationId) {
        Write-Host "❌ Missing required environment variables!" -ForegroundColor Red
        Write-Host "Required: MS_STORE_TENANT_ID, MS_STORE_CLIENT_ID, MS_STORE_CLIENT_SECRET, MS_STORE_APPLICATION_ID" -ForegroundColor Yellow
        exit 1
    }

    try {
        # Step 1: Get access token
        $accessToken = Get-MSAccessToken -TenantId $tenantId -ClientId $clientId -ClientSecret $clientSecret

        # Step 2: Get or create submission
        $submission = Get-StoreSubmission -AccessToken $accessToken -ApplicationId $applicationId
        $submissionId = $submission.id

        # Step 3: Get package upload URL
        $uploadUrl = Get-PackageUploadUrl -AccessToken $accessToken -ApplicationId $applicationId -SubmissionId $submissionId

        # Step 4: Upload MSI
        Upload-MSIToAzureBlob -MsiPath $MsiPath -SasUri $uploadUrl

        # Step 5: Update submission (optional - may not be needed if upload URL includes all info)
        # Note: The API might handle this automatically when package is uploaded
        # Update-StoreSubmission -AccessToken $accessToken -ApplicationId $applicationId -SubmissionId $submissionId -PackageUrl $MsiPath

        # Step 6: Commit submission (if requested)
        if ($autoCommitFlag) {
            Commit-StoreSubmission -AccessToken $accessToken -ApplicationId $applicationId -SubmissionId $submissionId
            Write-Host ""
            Write-Host "✅ Submission completed and committed!" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "✅ Submission uploaded but not committed" -ForegroundColor Yellow
            Write-Host "💡 Review in Partner Center and commit manually if needed" -ForegroundColor Cyan
        }

        Write-Host ""
        Write-Host "═══════════════════════════════════════════════════════════════"
        Write-Host "📋 Submission Details:"
        Write-Host "   Application ID: $applicationId"
        Write-Host "   Submission ID: $submissionId"
        Write-Host "   Status: $($submission.status)"
        Write-Host "═══════════════════════════════════════════════════════════════"

    } catch {
        Write-Host ""
        Write-Host "❌ Store Submission failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

# Export functions
Export-ModuleMember -Function Get-MSAccessToken, Get-StoreSubmission, Get-PackageUploadUrl, Upload-MSIToAzureBlob, Update-StoreSubmission, Commit-StoreSubmission, Submit-ToStore
