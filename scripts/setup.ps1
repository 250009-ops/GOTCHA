param(
  [switch]$SkipDocker,
  [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$DockerExe = "${env:ProgramFiles}\Docker\Docker\resources\bin\docker.exe"
$DockerDesktop = "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe"

Write-Host "Gotcha setup" -ForegroundColor Cyan
Set-Location $Root

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example"
}

function Import-RootEnv {
  Get-Content (Join-Path $Root ".env") -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
      Set-Item -Path "env:$($matches[1].Trim())" -Value $matches[2].Trim()
    }
  }
}

if (-not $SkipDocker) {
  $wslStatus = wsl --status 2>&1 | Out-String
  if ($wslStatus -match 'not installed') {
    Write-Host "WSL is not installed. Docker Desktop needs WSL2: run 'wsl --install' as Administrator, reboot, then re-run setup.ps1" -ForegroundColor Yellow
  }

  if (Test-Path $DockerExe) {
    $daemonUp = $false
    & $DockerExe info 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $daemonUp = $true }

    if (-not $daemonUp -and (Test-Path $DockerDesktop)) {
      Write-Host "Starting Docker Desktop (first launch may take 2-3 minutes)..." -ForegroundColor Yellow
      Start-Process $DockerDesktop
      for ($i = 0; $i -lt 72; $i++) {
        Start-Sleep -Seconds 5
        & $DockerExe info 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { $daemonUp = $true; break }
      }
    }

    if ($daemonUp) {
      & $DockerExe compose -f infra/docker-compose.yml up -d
      Write-Host "Waiting for Postgres on localhost:5433..."
      Start-Sleep -Seconds 10
    } else {
      Write-Host "Docker installed but daemon not ready (often WSL/reboot). Open Docker Desktop manually, then re-run setup.ps1" -ForegroundColor Yellow
    }
  } elseif (Get-Command docker -ErrorAction SilentlyContinue) {
    docker compose -f infra/docker-compose.yml up -d
    Start-Sleep -Seconds 8
  } else {
    Write-Host "Docker not found. Install Docker Desktop or use DEV_AUTH_ANY_CREDENTIAL=true without DB." -ForegroundColor Yellow
  }
}

npm install
Import-RootEnv
npm run db:generate

Set-Location services/api
try {
  npx prisma migrate deploy
  if (-not $SkipSeed) {
    npm run db:seed
  }
  Set-Location $Root
  if ($env:DATABASE_URL -match ':5433/') {
    $envContent = Get-Content (Join-Path $Root ".env") -Raw
    if ($envContent -match 'DEV_AUTH_ANY_CREDENTIAL=true') {
      ($envContent -replace 'DEV_AUTH_ANY_CREDENTIAL=true', 'DEV_AUTH_ANY_CREDENTIAL=false') | Set-Content (Join-Path $Root ".env") -NoNewline
      Write-Host "Set DEV_AUTH_ANY_CREDENTIAL=false (database seeded on port 5433)." -ForegroundColor Green
    }
  }
} catch {
  Set-Location $Root
  Write-Host "Database migrate/seed failed: $_" -ForegroundColor Yellow
  Write-Host "Dev mode: keep DEV_AUTH_ANY_CREDENTIAL=true in .env to use the app without PostgreSQL." -ForegroundColor Yellow
}

Set-Location $Root
Write-Host ""
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host "  npm run dev:api:stable   -> API http://localhost:3000"
Write-Host "  npm run dev:web-learner  -> Learner http://localhost:5175"
Write-Host "  npm run dev:admin        -> Admin http://localhost:5173"
Write-Host "  npm run dev:web          -> Marketing http://localhost:5174"
Write-Host "  npm run dev:worker       -> URL import worker (optional; needs Redis)"
Write-Host "  cd apps/mobile; flutter run"
