# PowerShell dotenv functions
# Usage: . .\scripts\Load-DotEnv.ps1; Load-DotEnv

function Load-DotEnv {
    param(
        [string]$Path = ".env"
    )

    if (-not (Test-Path $Path)) {
        Write-Warning "dotenv file not found: $Path"
        Write-Host "Create .env file with the following command:" -ForegroundColor Yellow
        Write-Host "  Copy-Item .env.example .env" -ForegroundColor Cyan
        Write-Host "  Then edit .env file to set your actual values." -ForegroundColor Cyan
        return $false
    }

    Write-Host "Loading environment variables from: $Path" -ForegroundColor Green

    $envVars = @{}
    $lineNumber = 0

    Get-Content $Path | ForEach-Object {
        $lineNumber++
        $line = $_.Trim()

        # Skip empty lines or comments (starting with #)
        if ($line -eq "" -or $line.StartsWith("#")) {
            return
        }

        # Parse KEY=VALUE format
        if ($line -match "^([^=]+)=(.*)$") {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()

            # Remove quotes if present
            if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
                ($value.StartsWith("'") -and $value.EndsWith("'"))) {
                $value = $value.Substring(1, $value.Length - 2)
            }

            # Set environment variable
            Set-Item -Path "env:$key" -Value $value
            $envVars[$key] = $value

            Write-Host "  ✓ $key = $value" -ForegroundColor Cyan
        } else {
            Write-Warning "Invalid line format at line $lineNumber`: $line"
        }
    }

    Write-Host "Loaded $($envVars.Count) environment variables" -ForegroundColor Green
    return $true
}

function Show-DotEnv {
    param(
        [string]$Path = ".env"
    )

    if (-not (Test-Path $Path)) {
        Write-Warning "dotenv file not found: $Path"
        return
    }

    Write-Host "Current .env file contents:" -ForegroundColor Yellow
    Write-Host "=========================" -ForegroundColor Yellow

    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if ($line -eq "" -or $line.StartsWith("#")) {
            Write-Host $line -ForegroundColor Gray
        } elseif ($line -match "^([^=]+)=(.*)$") {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            Write-Host "$key=" -NoNewline -ForegroundColor Green
            Write-Host $value -ForegroundColor White
        } else {
            Write-Host $line -ForegroundColor Red
        }
    }
}

function Test-DotEnvVariables {
    param(
        [switch]$Development,
        [switch]$MSIUpload
    )

    $developmentVars = @("GRADLE_OPTS")
    $msiUploadVars = @("GCP_PROJECT_ID", "GCP_BUCKET_NAME", "GCP_SERVICE_ACCOUNT_KEY")
    $buildVars = @("JAVA_HOME")

    Write-Host "Testing environment variables..." -ForegroundColor Yellow

    $allPresent = $true

    # Test build variables (always required)
    Write-Host "  Build variables:" -ForegroundColor Cyan
    foreach ($var in $buildVars) {
        $value = [Environment]::GetEnvironmentVariable($var)
        if ($value) {
            Write-Host "    ✓ $var = $value" -ForegroundColor Green
        } else {
            Write-Host "    ✗ $var is not set" -ForegroundColor Red
            if ($var -eq "JAVA_HOME") {
                Write-Host "      JDK 21 installation required: https://docs.aws.amazon.com/corretto/latest/corretto-21-ug/downloads-list.html" -ForegroundColor Gray
            }
            $allPresent = $false
        }
    }

    # Test development environment variables
    if ($Development -or (-not $MSIUpload)) {
        Write-Host "  Development variables:" -ForegroundColor Cyan
        foreach ($var in $developmentVars) {
            $value = [Environment]::GetEnvironmentVariable($var)
            if ($value) {
                Write-Host "    ✓ $var = $value" -ForegroundColor Green
            } else {
                Write-Host "    ⚠ $var is not set" -ForegroundColor Yellow
            }
        }
    }

    # Test MSI upload variables
    if ($MSIUpload -or (-not $Development)) {
        Write-Host "  MSI upload variables:" -ForegroundColor Cyan
        foreach ($var in $msiUploadVars) {
            $value = [Environment]::GetEnvironmentVariable($var)
            if ($value) {
                Write-Host "    ✓ $var = $value" -ForegroundColor Green
            } else {
                Write-Host "    ✗ $var is not set" -ForegroundColor Red
                $allPresent = $false
            }
        }
    }

    # Optional variables
    $optionalVars = @("GOOGLE_ANALYTICS_ID", "GOOGLE_ANALYTICS_API_SECRET", "DEBUG_MODE")
    $optionalSet = @()
    foreach ($var in $optionalVars) {
        $value = [Environment]::GetEnvironmentVariable($var)
        if ($value) {
            $optionalSet += "$var = $value"
        }
    }

    if ($optionalSet.Count -gt 0) {
        Write-Host "  Optional variables:" -ForegroundColor Cyan
        foreach ($setting in $optionalSet) {
            Write-Host "    ✓ $setting" -ForegroundColor Green
        }
    }

    if (-not $allPresent) {
        Write-Host "Some required build variables are missing. Please check your .env file." -ForegroundColor Red
        return $false
    }

    if ($MSIUpload) {
        $msiVarsPresent = $true
        foreach ($var in $msiUploadVars) {
            $value = [Environment]::GetEnvironmentVariable($var)
            if (-not $value) {
                $msiVarsPresent = $false
                break
            }
        }
        if ($msiVarsPresent) {
            Write-Host "All required MSI upload variables are set!" -ForegroundColor Green
            return $true
        } else {
            Write-Host "Some MSI upload variables are missing." -ForegroundColor Yellow
            return $false
        }
    } elseif ($Development) {
        Write-Host "Development environment checked!" -ForegroundColor Green
        return $true
    } else {
        Write-Host "Build environment checked!" -ForegroundColor Green
        return $true
    }
}

# Usage examples output
Write-Host ""
Write-Host "PowerShell dotenv functions loaded!" -ForegroundColor Green
Write-Host ""
Write-Host "Usage:" -ForegroundColor Yellow
Write-Host "  Load-DotEnv                      # Load environment variables from .env file" -ForegroundColor Cyan
Write-Host "  Show-DotEnv                      # Show .env file contents" -ForegroundColor Cyan
Write-Host "  Test-DotEnvVariables -Development # Check development environment variables" -ForegroundColor Cyan
Write-Host "  Test-DotEnvVariables -MSIUpload   # Check MSI upload environment variables" -ForegroundColor Cyan
Write-Host ""
Write-Host "Quick Start:" -ForegroundColor Yellow
Write-Host "  1. Copy-Item .env.example .env" -ForegroundColor White
Write-Host "  2. # Edit .env file to set your actual values" -ForegroundColor White
Write-Host "  3. Load-DotEnv" -ForegroundColor White
Write-Host "  4. Test-DotEnvVariables -Development # Check development environment" -ForegroundColor White
Write-Host "  5. ./gradlew build                   # Test build" -ForegroundColor White
Write-Host "  6. Test-DotEnvVariables -MSIUpload   # Check MSI upload environment" -ForegroundColor White
Write-Host "  7. .\scripts\upload-msi-to-gcp.ps1  # Upload MSI" -ForegroundColor White