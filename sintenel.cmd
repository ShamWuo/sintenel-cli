@echo off
setlocal
pushd "%~dp0"

if not exist "dist\sintenel.cjs" (
    echo [ERROR] Sintenel bundle NOT FOUND at dist\sintenel.cjs
    echo Please run "npm run bundle" to generate the standalone executable.
    popd
    exit /b 1
)

node dist\sintenel.cjs %*

popd
endlocal
