@echo off
setlocal
echo ◈ [SINTENEL SETUP] Preparing Wizard...
powershell -ExecutionPolicy Bypass -Command "& { .\sintenel.ps1 setup }"
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Setup Failed. Ensure Node.js is installed.
    pause
    exit /b %ERRORLEVEL%
)
echo.
echo ✅ API Key Configured! You can now run launch-sintenel.bat
pause
