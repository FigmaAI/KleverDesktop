#!/usr/bin/env pwsh

# =================================================================
# Klever Desktop - Icon Generation Script (Windows)
# Generates .ico file from PNG for Windows builds
# =================================================================

$ErrorActionPreference = "Stop"

Write-Host "🎨 Generating Windows icon files..." -ForegroundColor Cyan

# --- Configuration ---
$SourceIcon = "build/icon.png"
$OutputIcon = "build/icon.ico"

# --- Validation ---
if (-not (Test-Path $SourceIcon)) {
    Write-Host "❌ Error: Source icon not found at $SourceIcon" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Found source icon: $SourceIcon" -ForegroundColor Green

# --- Check if ImageMagick is available ---
$magickAvailable = $false
try {
    $null = magick --version 2>$null
    $magickAvailable = $true
    Write-Host "✅ ImageMagick detected" -ForegroundColor Green
} catch {
    Write-Host "⚠️  ImageMagick not found - will try .NET method" -ForegroundColor Yellow
}

# --- Method 1: Using ImageMagick (Recommended) ---
if ($magickAvailable) {
    Write-Host ""
    Write-Host "📦 Generating .ico file with ImageMagick..." -ForegroundColor Cyan

    try {
        # Generate .ico with multiple sizes (16, 32, 48, 64, 128, 256)
        magick convert $SourceIcon `
            -define icon:auto-resize=256,128,64,48,32,16 `
            $OutputIcon

        if (Test-Path $OutputIcon) {
            $size = (Get-Item $OutputIcon).Length / 1KB
            Write-Host "✅ icon.ico created successfully ($([math]::Round($size, 2)) KB)" -ForegroundColor Green
            Write-Host ""
            Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
            Write-Host "🎉 Icon generation completed!" -ForegroundColor Green
            Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
            Write-Host "📁 Output: build/icon.ico" -ForegroundColor White
            Write-Host "📊 Size: $([math]::Round($size, 2)) KB" -ForegroundColor White
            Write-Host ""
            Write-Host "✅ You can now build for Windows" -ForegroundColor Green
            Write-Host "   The icon.ico file is ready for use" -ForegroundColor White
            Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
            exit 0
        }
    } catch {
        Write-Host "❌ ImageMagick conversion failed: $_" -ForegroundColor Red
        Write-Host "   Falling back to .NET method..." -ForegroundColor Yellow
    }
}

# --- Method 2: Using .NET System.Drawing ---
Write-Host ""
Write-Host "📦 Generating .ico file with .NET System.Drawing..." -ForegroundColor Cyan

try {
    Add-Type -AssemblyName System.Drawing

    # Load source image
    $sourceImage = [System.Drawing.Image]::FromFile((Resolve-Path $SourceIcon).Path)

    # Create icon sizes (256, 128, 64, 48, 32, 16)
    $sizes = @(256, 128, 64, 48, 32, 16)
    $bitmaps = @()

    Write-Host "🔧 Creating icon sizes..." -ForegroundColor Cyan
    foreach ($size in $sizes) {
        Write-Host "   - ${size}x${size}px" -ForegroundColor Gray
        $bitmap = New-Object System.Drawing.Bitmap($size, $size)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.DrawImage($sourceImage, 0, 0, $size, $size)
        $graphics.Dispose()
        $bitmaps += $bitmap
    }

    # Save as .ico
    Write-Host "💾 Saving icon.ico..." -ForegroundColor Cyan
    $iconPath = (Resolve-Path "build").Path + "\icon.ico"
    $fileStream = [System.IO.File]::Create($iconPath)

    # Write ICO header
    $bw = New-Object System.IO.BinaryWriter($fileStream)
    $bw.Write([UInt16]0)  # Reserved
    $bw.Write([UInt16]1)  # Type (1 = ICO)
    $bw.Write([UInt16]$bitmaps.Count)  # Number of images

    # Calculate offset for first image data
    $offset = 6 + (16 * $bitmaps.Count)

    # Write image directory entries
    $imageData = @()
    foreach ($bitmap in $bitmaps) {
        $ms = New-Object System.IO.MemoryStream
        $bitmap.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $imageBytes = $ms.ToArray()
        $ms.Dispose()

        $width = if ($bitmap.Width -eq 256) { 0 } else { $bitmap.Width }
        $height = if ($bitmap.Height -eq 256) { 0 } else { $bitmap.Height }

        $bw.Write([byte]$width)         # Width (0 = 256)
        $bw.Write([byte]$height)        # Height (0 = 256)
        $bw.Write([byte]0)              # Color palette
        $bw.Write([byte]0)              # Reserved
        $bw.Write([UInt16]1)            # Color planes
        $bw.Write([UInt16]32)           # Bits per pixel
        $bw.Write([UInt32]$imageBytes.Length)  # Size
        $bw.Write([UInt32]$offset)      # Offset

        $imageData += $imageBytes
        $offset += $imageBytes.Length
    }

    # Write image data
    foreach ($data in $imageData) {
        $bw.Write($data)
    }

    $bw.Close()
    $fileStream.Close()

    # Cleanup
    foreach ($bitmap in $bitmaps) {
        $bitmap.Dispose()
    }
    $sourceImage.Dispose()

    if (Test-Path $OutputIcon) {
        $size = (Get-Item $OutputIcon).Length / 1KB
        Write-Host ""
        Write-Host "✅ icon.ico created successfully ($([math]::Round($size, 2)) KB)" -ForegroundColor Green
        Write-Host ""
        Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
        Write-Host "🎉 Icon generation completed!" -ForegroundColor Green
        Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
        Write-Host "📁 Output: build/icon.ico" -ForegroundColor White
        Write-Host "📊 Size: $([math]::Round($size, 2)) KB" -ForegroundColor White
        Write-Host "📦 Contains sizes: 256, 128, 64, 48, 32, 16 px" -ForegroundColor White
        Write-Host ""
        Write-Host "✅ You can now build for Windows" -ForegroundColor Green
        Write-Host "   The icon.ico file is ready for use" -ForegroundColor White
        Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Error: Failed to create icon.ico" -ForegroundColor Red
        exit 1
    }

} catch {
    Write-Host ""
    Write-Host "❌ Error: .NET icon generation failed" -ForegroundColor Red
    Write-Host "   $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "═══════════════════════════════════════════" -ForegroundColor Yellow
    Write-Host "ℹ️  Alternative Solutions:" -ForegroundColor Yellow
    Write-Host "═══════════════════════════════════════════" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Install ImageMagick:" -ForegroundColor White
    Write-Host "   winget install ImageMagick.ImageMagick" -ForegroundColor Gray
    Write-Host "   Then re-run this script" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Use online converter:" -ForegroundColor White
    Write-Host "   https://cloudconvert.com/png-to-ico" -ForegroundColor Cyan
    Write-Host "   Upload build/icon.png and download icon.ico" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. Use npm package:" -ForegroundColor White
    Write-Host "   npm install -g png2icons" -ForegroundColor Gray
    Write-Host "   png2icons build/icon.png build/" -ForegroundColor Gray
    Write-Host ""
    Write-Host "4. Electron Forge can auto-generate .ico from .png" -ForegroundColor White
    Write-Host "   (Optional - not always required)" -ForegroundColor Gray
    Write-Host ""
    exit 1
}
