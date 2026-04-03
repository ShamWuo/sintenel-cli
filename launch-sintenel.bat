@echo off
REM Sintenel-CLI One-Click Launcher (Bypasses CMD blocks and Execution Policy)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0sintenel.ps1" %*
pause
