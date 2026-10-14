param(
    [switch]$Fresh
)

$rootDir = $PSScriptRoot
Set-Location $rootDir

if ($Fresh) {
    Write-Host "Resetting demo database (-Fresh specified)..." -ForegroundColor Yellow
    $dbPath = Join-Path $rootDir "data\app.db"
    $walPath = Join-Path $rootDir "data\app.db-wal"
    $shmPath = Join-Path $rootDir "data\app.db-shm"
    
    Remove-Item $dbPath -Force -ErrorAction SilentlyContinue
    Remove-Item $walPath -Force -ErrorAction SilentlyContinue
    Remove-Item $shmPath -Force -ErrorAction SilentlyContinue
    Write-Host "Removed existing data/app.db* files." -ForegroundColor Green
}

Write-Host "Starting Backend API in a new window (http://localhost:8000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$rootDir'; python -m uvicorn api.main:app --host 127.0.0.1 --port 8000"

Write-Host "Starting Frontend Dev Server in a new window (http://localhost:5173)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$rootDir'; npm run dev"

Write-Host "Demo launcher initiated. Backend and Frontend running in separate windows." -ForegroundColor Green
