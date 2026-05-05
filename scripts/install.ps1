# Sintenel-CLI One-Line Installer
# Usage: irm https://... | iex

$destDir = "$HOME\.sintenel"
if (-not (Test-Path $destDir)) { 
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null 
}

$exeUrl = "https://github.com/ShamWuo/sintenel-cli/releases/latest/download/sintenel.exe"
$exePath = Join-Path $destDir "Sintenel.exe"

Write-Host "[SINTENEL] Downloading standalone binary..." -ForegroundColor Cyan
try {
    # Force TLS 1.2 for GitHub compatibility
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    
    $params = @{
        Uri = $exeUrl
        OutFile = $exePath
        ErrorAction = "Stop"
        UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    # UseBasicParsing is essential if Internet Explorer engine is disabled by GPO
    Invoke-WebRequest @params -UseBasicParsing
    
    Write-Host "Download complete: $exePath" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] Failed to download binary." -ForegroundColor Red
    Write-Host "Possible causes:" -ForegroundColor Yellow
    Write-Host "1. School WiFi is blocking .exe downloads or GitHub Releases." -ForegroundColor Yellow
    Write-Host "2. The repository or release does not exist yet (check: $exeUrl)" -ForegroundColor Yellow
    Write-Host "3. VM Network is in NAT mode and causing SSL handshake issues." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Error Details: $($_.Exception.Message)" -ForegroundColor Gray
    return
}

# Add to User PATH if not already there
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$destDir*") {
    Write-Host "Adding $destDir to User PATH..." -ForegroundColor Cyan
    $newPath = "$userPath;$destDir"
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    $env:Path += ";$destDir"
}

Write-Host ""
Write-Host "Sintenel is now installed!" -ForegroundColor Green
Write-Host "You may need to restart your terminal." -ForegroundColor Yellow
Write-Host "Try running: Sintenel" -ForegroundColor Cyan
