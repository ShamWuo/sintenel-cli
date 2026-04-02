@echo off
pushd "%~dp0"
node dist\sintenel.cjs %*
popd
