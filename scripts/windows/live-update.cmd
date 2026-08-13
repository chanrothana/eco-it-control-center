@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "ROOT=%%~fI"

cd /d "%ROOT%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\windows\bootstrap-live-update.ps1" %*

endlocal
