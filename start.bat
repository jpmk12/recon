@echo off
REM Recon - launcher for Windows
REM Builds on first run, then starts the production server and opens the browser.
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\start.ps1" %*
exit /b %ERRORLEVEL%
