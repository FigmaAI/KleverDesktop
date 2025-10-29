#!/usr/bin/env pwsh

# =================================================================
# Multi-resolution ICO file creation script
# This script creates a proper Windows ICO file from PNG sources
#
# Usage: ./scripts/create-ico.ps1 [OutputPath]
# Default output: app/src/main/resources/icon.ico
# =================================================================

param(
    [string]$OutputPath = "app/src/main/resources/icon.ico",
    [switch]$Force = $false
)

# Check if running on Windows (required for proper ICO creation)
if (-not $IsWindows -and -not ($PSVersionTable.PSVersion.Major -le 5)) {
    Write-Warning "This script is optimized for Windows. Results may vary on other platforms."
}

# Source PNG file (will be resized to various resolutions from this file)
$sourcePng = "app/src/main/resources/icon.png"

# Target resolutions to generate
$targetSizes = @(16, 32, 64, 128, 256)

Write-Host "🎨 Creating multi-resolution ICO file for Klever Desktop..." -ForegroundColor Green
Write-Host "📁 Output: $OutputPath" -ForegroundColor Cyan

# Check source file exists
if (-not (Test-Path $sourcePng)) {
    Write-Error "❌ Source PNG file not found: $sourcePng"
    exit 1
}

Write-Host "✅ Found source PNG: $sourcePng" -ForegroundColor Green

# Create output directory
$outputDir = Split-Path $OutputPath -Parent
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

# Backup existing file (before overwriting)
if ((Test-Path $OutputPath) -and -not $Force) {
    $backup = "$OutputPath.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item $OutputPath $backup
    Write-Host "📋 Backup created: $backup" -ForegroundColor Yellow
}

try {
    # Method 1: Try ImageMagick (best quality)
    $magickPath = Get-Command "magick" -ErrorAction SilentlyContinue
    if ($magickPath) {
        Write-Host "🔧 Using ImageMagick for ICO creation..." -ForegroundColor Blue

        # Create ICO by resizing to various resolutions
        $resizeArgs = ($targetSizes | ForEach-Object { "`"$sourcePng`" -resize ${_}x${_}" }) -join " "
        $command = "magick $resizeArgs `"$OutputPath`""

        Write-Host "Executing: $command" -ForegroundColor Gray
        Invoke-Expression $command

        if ($LASTEXITCODE -eq 0 -and (Test-Path $OutputPath)) {
            $fileInfo = Get-Item $OutputPath
            Write-Host "✅ ICO file created successfully with ImageMagick!" -ForegroundColor Green
            Write-Host "📊 File size: $($fileInfo.Length) bytes" -ForegroundColor Cyan
            Write-Host "🎯 Resolutions included: $($targetSizes -join 'x', ', ')" -ForegroundColor Cyan
            exit 0
        }
    }

    # Method 2: Use Windows API method (better compatibility)
    Write-Host "🔧 Using Windows API for ICO creation..." -ForegroundColor Blue

    Add-Type -AssemblyName System.Drawing
    Add-Type -AssemblyName System.Windows.Forms

    # Load source image
    $sourceImage = [System.Drawing.Image]::FromFile((Resolve-Path $sourcePng).Path)

    # ICO file header structure
    $iconDir = [byte[]]::new(6)
    $iconDir[0] = 0  # Reserved (must be 0)
    $iconDir[1] = 0
    $iconDir[2] = 1  # Type (1 = Icon)
    $iconDir[3] = 0
    $iconDir[4] = $targetSizes.Count  # Number of images
    $iconDir[5] = 0

    $iconEntries = @()
    $imageData = @()
    $dataOffset = 6 + (16 * $targetSizes.Count)  # Header + entries

    foreach ($size in $targetSizes) {
        Write-Host "🔄 Processing ${size}x${size}..." -ForegroundColor Gray

        # Resize image
        $resizedBitmap = [System.Drawing.Bitmap]::new($size, $size)
        $graphics = [System.Drawing.Graphics]::FromImage($resizedBitmap)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

        $graphics.DrawImage($sourceImage, 0, 0, $size, $size)
        $graphics.Dispose()

        # Convert to PNG bytes
        $memoryStream = [System.IO.MemoryStream]::new()
        $resizedBitmap.Save($memoryStream, [System.Drawing.Imaging.ImageFormat]::Png)
        $pngBytes = $memoryStream.ToArray()
        $memoryStream.Dispose()
        $resizedBitmap.Dispose()

        # Determine image size (256 is displayed as 0 in ICO format)
        $icoSize = if ($size -eq 256) { 0 } else { $size }

        # Create ICO entry (16 bytes)
        $entry = [byte[]]::new(16)
        $entry[0] = $icoSize   # Width
        $entry[1] = $icoSize   # Height
        $entry[2] = 0          # Color count (0 = no palette)
        $entry[3] = 0          # Reserved
        $entry[4] = 1          # Color planes (low byte)
        $entry[5] = 0          # Color planes (high byte)
        $entry[6] = 32         # Bits per pixel (low byte)
        $entry[7] = 0          # Bits per pixel (high byte)

        # Size of image data (little endian)
        $sizeBytes = [System.BitConverter]::GetBytes([uint32]$pngBytes.Length)
        $entry[8] = $sizeBytes[0]
        $entry[9] = $sizeBytes[1]
        $entry[10] = $sizeBytes[2]
        $entry[11] = $sizeBytes[3]

        # Offset to image data (little endian)
        $offsetBytes = [System.BitConverter]::GetBytes([uint32]$dataOffset)
        $entry[12] = $offsetBytes[0]
        $entry[13] = $offsetBytes[1]
        $entry[14] = $offsetBytes[2]
        $entry[15] = $offsetBytes[3]

        $iconEntries += $entry
        $imageData += $pngBytes
        $dataOffset += $pngBytes.Length
    }

    # Clean up source image
    $sourceImage.Dispose()

    # Write ICO file
    $stream = [System.IO.File]::Create($OutputPath)
    try {
        # Write header
        $stream.Write($iconDir, 0, $iconDir.Length)

        # Write entries
        foreach ($entry in $iconEntries) {
            $stream.Write($entry, 0, $entry.Length)
        }

        # Write image data
        foreach ($data in $imageData) {
            $stream.Write($data, 0, $data.Length)
        }
    }
    finally {
        $stream.Close()
    }

    if (Test-Path $OutputPath) {
        $fileInfo = Get-Item $OutputPath
        Write-Host "✅ Multi-resolution ICO file created successfully!" -ForegroundColor Green
        Write-Host "📊 File size: $($fileInfo.Length) bytes" -ForegroundColor Cyan
        Write-Host "🎯 Resolutions included: $(($targetSizes | ForEach-Object { "${_}x${_}" }) -join ', ')" -ForegroundColor Cyan

        # Validation check
        try {
            $testIcon = [System.Drawing.Icon]::new($OutputPath)
            $testIcon.Dispose()
            Write-Host "✅ ICO file validation passed!" -ForegroundColor Green
        }
        catch {
            Write-Warning "⚠️ ICO file created but validation failed: $($_.Exception.Message)"
        }
    }
    else {
        throw "ICO file was not created"
    }
}
catch {
    Write-Error "❌ Failed to create ICO file: $($_.Exception.Message)"

    # Fallback: Create ICO with single image
    Write-Host "🔄 Trying fallback method with source PNG..." -ForegroundColor Yellow

    try {
        if (Test-Path $sourcePng) {
            $img = [System.Drawing.Image]::FromFile((Resolve-Path $sourcePng).Path)
            $img.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Icon)
            $img.Dispose()

            $fileInfo = Get-Item $OutputPath
            Write-Host "✅ Fallback ICO created: $($fileInfo.Length) bytes" -ForegroundColor Green
        }
        else {
            throw "No source PNG found"
        }
    }
    catch {
        Write-Error "❌ Fallback also failed: $($_.Exception.Message)"
        exit 1
    }
}

Write-Host ""
Write-Host "🎉 ICO creation completed for Klever Desktop!" -ForegroundColor Green
Write-Host "📁 Output file: $OutputPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Test the build: ./gradlew clean app:packageMsi" -ForegroundColor Gray
Write-Host "2. If successful, commit the new icon: git add $OutputPath" -ForegroundColor Gray