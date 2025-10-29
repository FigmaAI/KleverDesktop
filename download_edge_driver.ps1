# Edge Driver Download Script
# This script downloads the EdgeDriver matching your Edge browser version

Write-Host "=== Edge Driver Download Tool ===" -ForegroundColor Cyan
Write-Host ""

# Detect Edge version
try {
    $edgeVersion = (Get-ItemProperty 'HKCU:\Software\Microsoft\Edge\BLBeacon' -Name version).version
    Write-Host "Detected Edge version: $edgeVersion" -ForegroundColor Green
} catch {
    Write-Host "Could not detect Edge version from registry." -ForegroundColor Yellow
    $edgeVersion = Read-Host "Please enter your Edge version (e.g., 141.0.3537.99)"
}

# Extract major version
$majorVersion = $edgeVersion.Split('.')[0]
Write-Host "Major version: $majorVersion" -ForegroundColor Green

# Set download URL (Microsoft changed domain from azureedge.net to microsoft.com)
$downloadUrl = "https://msedgedriver.microsoft.com/${edgeVersion}/edgedriver_win64.zip"
Write-Host "Download URL: $downloadUrl" -ForegroundColor Cyan

# Create cache directory
$cacheDir = "$env:USERPROFILE\.kleverdesktop\webdriver\edgedriver"
if (-not (Test-Path $cacheDir)) {
    New-Item -ItemType Directory -Path $cacheDir -Force | Out-Null
    Write-Host "Created cache directory: $cacheDir" -ForegroundColor Green
}

# Download driver
$zipPath = "$cacheDir\edgedriver.zip"
Write-Host ""
Write-Host "Downloading Edge Driver..." -ForegroundColor Cyan

try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -ErrorAction Stop
    Write-Host "Download completed!" -ForegroundColor Green
    
    # Extract zip
    Write-Host "Extracting..." -ForegroundColor Cyan
    Expand-Archive -Path $zipPath -DestinationPath $cacheDir -Force
    
    # Clean up zip
    Remove-Item $zipPath
    
    # Make executable
    $driverPath = "$cacheDir\msedgedriver.exe"
    if (Test-Path $driverPath) {
        Write-Host ""
        Write-Host "SUCCESS!" -ForegroundColor Green
        Write-Host "Edge Driver installed at: $driverPath" -ForegroundColor Green
        Write-Host ""
        Write-Host "You can now test Edge browser in KleverDesktop." -ForegroundColor Cyan
    } else {
        Write-Host "WARNING: msedgedriver.exe not found after extraction." -ForegroundColor Yellow
    }
    
} catch {
    Write-Host ""
    Write-Host "ERROR: Could not download Edge Driver automatically." -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "MANUAL DOWNLOAD INSTRUCTIONS:" -ForegroundColor Yellow
    Write-Host "1. Open: https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/" -ForegroundColor White
    Write-Host "2. Download Edge Driver version $edgeVersion (or closest match)" -ForegroundColor White
    Write-Host "3. Extract msedgedriver.exe" -ForegroundColor White
    Write-Host "4. Place it in: $cacheDir" -ForegroundColor White
    Write-Host ""
    
    # Open browser for manual download
    $openBrowser = Read-Host "Open download page in browser? (Y/N)"
    if ($openBrowser -eq "Y" -or $openBrowser -eq "y") {
        Start-Process "https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/"
    }
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

