param(
    [switch]$NoSim,
    [switch]$AutoRestart,
    [switch]$Fresh
)

$rootDir = $PSScriptRoot
Set-Location $rootDir

$simEnabled = if ($NoSim) { "0" } else { "1" }
$simAutoRestart = if ($AutoRestart) { "1" } else { "0" }

Write-Host "Demo Launch Configuration:" -ForegroundColor Cyan
Write-Host "  - Telemetry Simulator: $(if ($NoSim) { 'Disabled (-NoSim)' } else { 'Enabled (SIM_ENABLED=1)' })"
Write-Host "  - Auto-Restart:        $(if ($AutoRestart) { 'Enabled (SIM_AUTORESTART=1)' } else { 'Disabled' })"
Write-Host "  - Fresh Database:      $(if ($Fresh) { 'Enabled (-Fresh)' } else { 'Disabled' })"

if ($Fresh) {
    Write-Host "Resetting demo database (-Fresh specified)..." -ForegroundColor Yellow
    $dbPattern = Join-Path $rootDir "data\app.db*"
    Remove-Item $dbPattern -Force -ErrorAction SilentlyContinue
    $backendDbPattern = Join-Path $rootDir "backend\data\app.db*"
    Remove-Item $backendDbPattern -Force -ErrorAction SilentlyContinue
    Write-Host "Removed existing data/app.db* files." -ForegroundColor Green
}

$backendCmd = "`$env:SIM_ENABLED='$simEnabled'; `$env:SIM_AUTORESTART='$simAutoRestart'; Set-Location '$rootDir'; python -m uvicorn api.main:app --host 127.0.0.1 --port 8000"
Write-Host "Starting Backend API in a new window (http://localhost:8000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd

Write-Host "Starting Frontend Dev Server in a new window (http://localhost:5173)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$rootDir'; npm run dev"

Write-Host "Demo launcher initiated. Backend and Frontend running in separate windows." -ForegroundColor Green
