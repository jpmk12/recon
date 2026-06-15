# Recon installer for Windows
# Installs Node.js LTS + Nmap (via winget), then runs npm install and builds the app.
# Falls back to installing Python + Visual Studio Build Tools if a native build is needed.

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

function Write-Step($msg) {
    Write-Host ""
    Write-Host "==> $msg" -ForegroundColor Cyan
}

function Write-Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "    $msg" -ForegroundColor Red }

function Test-Command($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Update-SessionPath {
    $machine = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $user    = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machine;$user"
}

function Install-NativeBuildTools {
    Write-Step "Installing native build prerequisites"
    Write-Warn "better-sqlite3 needs a native build on this Node version."
    Write-Warn "Installing Python 3.12 and Visual Studio C++ Build Tools (~3 GB, several minutes)."

    Write-Ok "Installing Python 3.12..."
    winget install --id Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements --source winget
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne -1978335189) {
        Write-Warn "Python install reported exit $LASTEXITCODE (may already be installed)."
    }

    Write-Ok "Installing Visual Studio 2022 Build Tools with C++ workload (this is the slow one)..."
    winget install --id Microsoft.VisualStudio.2022.BuildTools `
        --accept-package-agreements --accept-source-agreements --source winget `
        --override "--passive --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne -1978335189) {
        Write-Warn "Build Tools install reported exit $LASTEXITCODE."
    }

    Update-SessionPath
}

Write-Step "Checking for winget"
if (-not (Test-Command "winget")) {
    Write-Err "winget is not available on this machine."
    Write-Err "winget ships with Windows 10 1709+ and Windows 11. Install 'App Installer' from the Microsoft Store and re-run."
    exit 1
}
Write-Ok "winget is available."

Write-Step "Checking for Node.js"
$nodeOk = $false
if (Test-Command "node") {
    $nodeVersion = (& node -v) -replace '^v',''
    $major = [int]($nodeVersion -split '\.')[0]
    if ($major -ge 18) {
        Write-Ok "Node $nodeVersion is installed."
        if ($major -ge 23) {
            Write-Warn "Node $major is very recent; some native modules may need to be built from source."
        }
        $nodeOk = $true
    } else {
        Write-Warn "Node $nodeVersion is too old. Need v18 or newer. Upgrading."
    }
}
if (-not $nodeOk) {
    Write-Ok "Installing Node.js LTS via winget..."
    winget install --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements --source winget
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Node.js install failed (exit $LASTEXITCODE)."
        exit 1
    }
    Update-SessionPath
    if (-not (Test-Command "node")) {
        Write-Err "Node was installed but is not on PATH in this session. Close this window and re-run install.bat from a new terminal."
        exit 1
    }
    Write-Ok "Node installed: $(& node -v)"
}

Write-Step "Checking for Nmap"
if (Test-Command "nmap") {
    Write-Ok "Nmap is already installed."
} else {
    Write-Ok "Installing Nmap via winget (bundles Npcap)..."
    Write-Warn "The Nmap installer may pop up an Npcap license window the first time. Click through it."
    winget install --id Insecure.Nmap --accept-package-agreements --accept-source-agreements --source winget
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "winget reported exit $LASTEXITCODE. Nmap may still have installed correctly."
    }
    Update-SessionPath
    if (-not (Test-Command "nmap")) {
        Write-Warn "nmap is not on PATH yet. Default install location is 'C:\Program Files (x86)\Nmap'. You may need to log out and back in, or set nmap_path in the app's Settings page."
    } else {
        Write-Ok "Nmap installed: $((& nmap --version | Select-Object -First 1))"
    }
}

Write-Step "Installing npm dependencies"
& npm install
if ($LASTEXITCODE -ne 0) {
    Write-Warn ""
    Write-Warn "npm install failed."
    Write-Warn "Most common cause on Windows: better-sqlite3 has no prebuilt binary for your Node version, so it falls back to compiling from source, which requires Python 3 and the C++ Build Tools."

    Write-Host ""
    $resp = Read-Host "Install Python 3.12 + Visual Studio Build Tools and retry? (~5-10 min, ~3 GB) [Y/n]"
    if ($resp -eq "" -or $resp -match "^[Yy]") {
        Install-NativeBuildTools
        Write-Step "Retrying npm install"
        & npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Err "npm install still failed after installing build tools. See output above."
            Write-Err "You may need to open a fresh terminal so PATH picks up the new tools, then run 'npm install' manually."
            exit 1
        }
    } else {
        Write-Err "Install aborted. You can re-run install.bat any time."
        exit 1
    }
}
Write-Ok "Dependencies installed."

Write-Step "Building app for production"
& npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Err "next build failed."
    exit 1
}
Write-Ok "Build complete."

Write-Step "Seeding sample data (optional)"
$seedAnswer = Read-Host "Populate the database with sample devices so you can see the UI immediately? [Y/n]"
if ($seedAnswer -eq "" -or $seedAnswer -match "^[Yy]") {
    & npm run seed
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "Sample data loaded."
    } else {
        Write-Warn "Seed step failed; continuing anyway."
    }
} else {
    Write-Ok "Skipped. Trigger a real scan from the UI after launch."
}

Write-Host ""
Write-Host "All set. Double-click start.bat to launch recon." -ForegroundColor Green
exit 0
