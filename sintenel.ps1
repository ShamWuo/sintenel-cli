# Sintenel Master Bootstrap (Resilient Entry Point)
# Usage: powershell -ExecutionPolicy Bypass -File .\sintenel.ps1

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$bundlePath = Join-Path $scriptDir "dist\sintenel.cjs"

# 1. 🛡️ GLOBAL SAFETY WRAPPER 
try {
    # 2. 🛡️ REGISTRY REPAIR (Disabled CMD Fix)
    # Re-enable CMD so orchestrators can spawn sub-processes properly
    Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\System" -Name "DisableCMD" -Value 0 -ErrorAction SilentlyContinue 
} catch {
    # Fallback to reg.exe if Management module is broken
    & reg.exe add "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v "DisableCMD" /t REG_DWORD /d 0 /f 2>$null
}

# 3. 🛡️ NODE.JS DISCOVERY
$nodePath = "node"
try {
    if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
        Write-Host "◈ [BOOTSTRAP] 'node' not in PATH. Searching common locations..." -ForegroundColor Cyan
        $searchPaths = @(
            "$env:ProgramFiles\nodejs\node.exe",
            "$env:ProgramFiles(x86)\nodejs\node.exe",
            "C:\Program Files\nodejs\node.exe",
            "$env:SystemDrive\node\node.exe"
        )
        foreach ($path in $searchPaths) {
            if (Test-Path $path) {
                $nodePath = "`"$path`""
                break
            }
        }
    }
} catch {
    # If Get-Command fails due to module issues, assume 'node' is in PATH or it'll fail at launch
}

# 4. 🛡️ AUTO-BUILD BUNDLE
if (-not (Test-Path $bundlePath)) {
    Write-Host "◈ [BOOTSTRAP] Bundle missing. Building Sintenel..." -ForegroundColor Cyan
    try {
        & $nodePath "$scriptDir\scripts\bundle.js"
    } catch {
        Write-Host "❌ [BOOTSTRAP] Failed to build bundle. Check Node.js installation." -ForegroundColor Red
        exit 1
    }
}

# 5. 🚀 LAUNCH
try {
    & $nodePath $bundlePath $args
} catch {
    Write-Host "❌ [BOOTSTRAP] Critical Failure: Failed to launch Sintenel via $nodePath" -ForegroundColor Red
    exit 1
}
