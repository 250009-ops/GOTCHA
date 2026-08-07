# Start Gotcha dev stack (API + desktop learner web)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "Starting Gotcha API on :3000 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root'; npm run dev:api"

Start-Sleep -Seconds 3

Write-Host "Starting Gotcha Learner Web on :5175 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root'; npm run dev:web-learner"

Write-Host ""
Write-Host "Open http://localhost:5175/login" -ForegroundColor Green
Write-Host "Demo: learner@gotcha.app / Learner2026! (or any credentials if DEV_AUTH_ANY_CREDENTIAL=true)"
