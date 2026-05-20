@echo off
REM Recon - one-click installer for Windows
REM Double-click this file, or run from a terminal.
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\install.ps1" %*
set "EXITCODE=%ERRORLEVEL%"
echo.
if "%EXITCODE%"=="0" (
  echo Install complete. Double-click start.bat to launch recon.
) else (
  echo Install failed with exit code %EXITCODE%.
)
pause
exit /b %EXITCODE%
