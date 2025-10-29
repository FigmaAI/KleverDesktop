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
            $version = $matches[1]
            # Remove any comments or extra text after the version
            $version = $version -replace '\s+.*$', ''
            Write-Host "Detected app version: $version" -ForegroundColor Green
            return $version
        } else {
            Write-Warning "Could not find packageVersion in $BuildFilePath"
            return "1.0.0"  # fallback version
        }
    } catch {
        Write-Warning "Error reading version from $BuildFilePath`: $($_.Exception.Message)"
        return "1.0.0"  # fallback version
    }
}