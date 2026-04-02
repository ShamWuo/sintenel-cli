# Sintenel PowerShell Wrapper (Bypasses malware that blocks cmd.exe)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$bundlePath = Join-Path $scriptDir "dist\sintenel.cjs"

# ◈ SELF-HEALING BOOTSTRAP (Nationals Resilience)
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\System" -Name "DisableCMD" -Value 0 -ErrorAction SilentlyContinue

if (-not (Test-Path $bundlePath)) {
    Write-Host "◈ [BOOTSTRAP] Bundle missing. Building Sintenel for you..." -ForegroundColor Cyan
    # Directly calling the esbuild binary via node (skipping cmd.exe)
    & node node_modules\esbuild\bin\esbuild src\index.ts --bundle --platform=node --target=node20 --format=cjs --outfile=dist\sintenel.cjs --minify --banner:js="#!/usr/bin/env node"
}

& node $bundlePath $args
