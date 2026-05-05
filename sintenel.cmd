@echo off
setlocal
pushd "%~dp0"

if not exist "dist\sintenel.cjs" (
    echo [SYSTEM] Sintenel bundle not found. Building...
    call npm run bundle
)

node dist\sintenel.cjs %*

popd
endlocal
