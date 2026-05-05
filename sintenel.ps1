# Sintenel Master Bootstrap (Resilient Entry Point)
# Usage: powershell -ExecutionPolicy Bypass -File .\sintenel.ps1

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$bundlePath = Join-Path $scriptDir "dist\sintenel.cjs"

# 1. Master Registry Repair (Defensive)
Write-Host "[INFO] Checking system policies..." -ForegroundColor Cyan
try {
    & reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v "DisableCMD" /t REG_DWORD /d 0 /f | Out-Null
    & reg add "HKCU\Software\Policies\Microsoft\Windows\System" /v DisableCMD /t REG_DWORD /d 0 /f | Out-Null
} catch {
    Write-Host "[WARN] Registry access restricted. Proceeding anyway..." -ForegroundColor Red
}

# 2. Node.js Discovery (Robust Extraction)
Write-Host "[INFO] Finding Node.js runtime..." -ForegroundColor Cyan
$nodePath = "node"
$possiblePaths = @(
    "$env:ProgramFiles\nodejs\node.exe",
    "$env:ProgramFiles(x86)\nodejs\node.exe",
    "C:\Program Files\nodejs\node.exe",
    "C:\Program Files (x86)\nodejs\node.exe"
)

foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $nodePath = $path
        break
    }
}

if (-not (Test-Path $bundlePath)) {
    Write-Host "[STATUS] Bundle missing. Building Sintenel..." -ForegroundColor Cyan
    & $nodePath "$scriptDir\scripts\bundle.js"
}

# 4. API KEY CHECK (Auto-Setup)
Write-Host "[INFO] Checking API Configuration..." -ForegroundColor Cyan
if (Test-Path $bundlePath) {
    if (-not (Test-Path (Join-Path $scriptDir ".env.local"))) {
        $keyVal = [System.Environment]::GetEnvironmentVariable("GOOGLE_GENERATIVE_AI_API_KEY")
        if (-not $keyVal) {
            Write-Host "[WARN] GOOGLE_GENERATIVE_AI_API_KEY NOT FOUND" -ForegroundColor Yellow
            Write-Host "[STATUS] Starting setup wizard..." -ForegroundColor Cyan
            & $nodePath $bundlePath setup
        }
    }
}

# 5. LAUNCH
try {
    & $nodePath $bundlePath $args
} catch {
    Write-Host "[FAIL] Critical Failure: Failed to launch Sintenel" -ForegroundColor Red
    exit 1
}
