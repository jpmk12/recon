# Recon installer for Windows
# Installs Node.js LTS + Nmap (via winget), then runs npm install and builds the app.

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

function Write-Step($msg) {
    Write-Host ""
    Write-Host "==> $msg" -ForegroundColor Cyan
}

function Write-Ok($msg) { Write-Host "    $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "    $msg" -ForegroundColor Red }

function Test-Command($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

# Refresh PATH in the current session so newly-installed tools become visible
# without requiring a new shell.
function Update-SessionPath {
    $machine = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $user    = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machine;$user"
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
    Write-Err "npm install failed. If this is a native-build error from better-sqlite3, install the C++ Build Tools:"
    Write-Err "  winget install --id Microsoft.VisualStudio.2022.BuildTools --override `"--passive --add Microsoft.VisualStudio.Workload.VCTools`""
    exit 1
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
