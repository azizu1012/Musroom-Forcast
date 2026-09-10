# Isolated PowerShell Launcher
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$env:PATH = "$ScriptDir\.runtime\nodejs;$env:PATH"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Weather App - Isolated Local Environment (PowerShell)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Node version: $(node -v)" -ForegroundColor Green

if (-not (Test-Path "$ScriptDir\node_modules")) {
    Write-Host "[INFO] Installing dependencies..." -ForegroundColor Yellow
    npm install
}

if (-not (Test-Path "$ScriptDir\data")) {
    New-Item -ItemType Directory -Path "$ScriptDir\data" | Out-Null
}

Write-Host "[INFO] Starting application..." -ForegroundColor Green
npm run dev
