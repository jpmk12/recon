# Recon launcher for Windows
# Ensures the app has been built, then starts the production server.

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

function Write-Err($msg) { Write-Host $msg -ForegroundColor Red }
function Write-Ok($msg)  { Write-Host $msg -ForegroundColor Green }

if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
    Write-Err "Node.js is not installed. Run install.bat first."
    Read-Host "Press Enter to close"
    exit 1
}

if (-not (Test-Path ".next")) {
    Write-Host "First run detected. Building the app (one-time, ~30s)..." -ForegroundColor Cyan
    & npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Build failed. Check the output above."
        Read-Host "Press Enter to close"
        exit 1
    }
}

$port = if ($env:PORT) { $env:PORT } else { "3000" }
$url  = "http://localhost:$port"

Write-Ok "Starting recon at $url"
Write-Host "Leave this window open. Close it (or press Ctrl+C) to stop the server."

# Open browser shortly after the server has had time to start.
Start-Job -ScriptBlock {
    param($u)
    Start-Sleep -Seconds 2
    Start-Process $u
} -ArgumentList $url | Out-Null

$env:PORT = $port
& npm run start
exit $LASTEXITCODE
