#Requires -Version 5.1
<#
.SYNOPSIS
  Configure Gotcha to use local Windows PostgreSQL (no Docker/WSL).
#>
param(
  [int]$Port = 0,
  [string]$PostgresUser = "postgres",
  [string]$PostgresPassword = "",
  [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$DbName = "gotcha"
$AppUser = "gotcha"
$AppPassword = "gotcha_dev"

function Write-Step([string]$Message) {
  Write-Host $Message -ForegroundColor Cyan
}

function Find-PsqlPath {
  $cmd = Get-Command psql -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $pgRoot = Join-Path ${env:ProgramFiles} "PostgreSQL"
  if (Test-Path $pgRoot) {
    $found = Get-ChildItem -Path $pgRoot -Recurse -Filter psql.exe -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -notmatch 'pgAdmin' } |
      Sort-Object FullName -Descending |
      Select-Object -First 1
    if ($found) { return $found.FullName }
  }
  return $null
}

function Get-PostgresListeningPort {
  param([int]$PreferredPort = 5432)

  $lines = netstat -ano | Select-String "LISTENING"
  foreach ($port in @($PreferredPort, 5433)) {
    if ($lines -match ":$port\s") { return $port }
  }
  return $PreferredPort
}

function Invoke-Psql {
  param(
    [string]$Psql,
    [string]$User,
    [string]$Password,
    [int]$DbPort,
    [string]$Database = "postgres",
    [string]$Sql
  )

  $env:PGPASSWORD = $Password
  try {
    & $Psql -U $User -h localhost -p $DbPort -d $Database -v ON_ERROR_STOP=1 -c $Sql 2>&1 | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -ne 0) {
      throw "psql failed (exit $LASTEXITCODE)"
    }
  } finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  }
}

function Invoke-PsqlScalar {
  param(
    [string]$Psql,
    [string]$User,
    [string]$Password,
    [int]$DbPort,
    [string]$Sql
  )

  $env:PGPASSWORD = $Password
  try {
    $result = & $Psql -U $User -h localhost -p $DbPort -d postgres -tAc $Sql 2>&1
    if ($LASTEXITCODE -ne 0) {
      throw ($result | Out-String)
    }
    return ($result | Out-String).Trim()
  } finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  }
}

function Test-AppDbConnection {
  param([string]$Psql, [int]$DbPort)

  $env:PGPASSWORD = $AppPassword
  try {
    & $Psql -U $AppUser -h localhost -p $DbPort -d $DbName -w -c "SELECT 1" 2>$null | Out-Null
    return ($LASTEXITCODE -eq 0)
  } finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  }
}

function Set-EnvDatabaseUrl {
  param([int]$DbPort)

  $url = "postgresql://${AppUser}:${AppPassword}@localhost:${DbPort}/${DbName}?schema=public"
  $envPath = Join-Path $Root ".env"
  if (-not (Test-Path $envPath)) {
    Copy-Item (Join-Path $Root ".env.example") $envPath
    Write-Host "Created .env from .env.example"
  }

  $content = Get-Content $envPath -Raw
  if ($content -match '(?m)^DATABASE_URL=.*$') {
    $content = $content -replace '(?m)^DATABASE_URL=.*$', "DATABASE_URL=$url"
  } else {
    $content = "DATABASE_URL=$url`r`n" + $content
  }
  Set-Content -Path $envPath -Value ($content.TrimEnd() + "`r`n") -NoNewline
  $env:DATABASE_URL = $url
  Write-Host "Updated DATABASE_URL -> localhost:$DbPort/$DbName" -ForegroundColor Green
}

function Set-DevAuthReal {
  $envPath = Join-Path $Root ".env"
  $content = Get-Content $envPath -Raw
  if ($content -match 'DEV_AUTH_ANY_CREDENTIAL=true') {
    $content = $content -replace 'DEV_AUTH_ANY_CREDENTIAL=true', 'DEV_AUTH_ANY_CREDENTIAL=false'
    Set-Content -Path $envPath -Value ($content.TrimEnd() + "`r`n") -NoNewline
    Write-Host "Set DEV_AUTH_ANY_CREDENTIAL=false" -ForegroundColor Green
  }
}

function Import-RootEnv {
  Get-Content (Join-Path $Root ".env") -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
      Set-Item -Path "env:$($matches[1].Trim())" -Value $matches[2].Trim()
    }
  }
}

Write-Step "Gotcha local PostgreSQL setup (no Docker)"

$service = Get-Service -Name "*postgres*" -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Running' } | Select-Object -First 1
if ($service) {
  Write-Host "PostgreSQL service: $($service.DisplayName) ($($service.Status))"
} else {
  Write-Host "No running PostgreSQL Windows service detected." -ForegroundColor Yellow
}

if ($Port -le 0) {
  $Port = Get-PostgresListeningPort -PreferredPort 5432
}
Write-Host "Using PostgreSQL port: $Port"

$psql = Find-PsqlPath
if (-not $psql) {
  Write-Host "psql.exe not found. Install PostgreSQL 17+ for Windows." -ForegroundColor Red
  exit 1
}
Write-Host "psql: $psql"

Set-Location $Root

if (-not (Test-AppDbConnection -Psql $psql -DbPort $Port)) {
  if (-not $PostgresPassword) {
    Write-Host ""
    Write-Host "Enter the PostgreSQL superuser password for '$PostgresUser' (set at install time)." -ForegroundColor Yellow
    $secure = Read-Host "Password" -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
      $PostgresPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto($ptr)
    } finally {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) | Out-Null
    }
  }

  Write-Step "Creating role and database (if missing)..."

  $setupSql = @"
DO `$`$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$AppUser') THEN
    CREATE ROLE $AppUser WITH LOGIN PASSWORD '$AppPassword';
  ELSE
    ALTER ROLE $AppUser WITH LOGIN PASSWORD '$AppPassword';
  END IF;
END
`$`$;
"@

  try {
    Invoke-Psql -Psql $psql -User $PostgresUser -Password $PostgresPassword -DbPort $Port -Sql $setupSql
  } catch {
    Write-Host "Could not connect as superuser '$PostgresUser'. Check password and port $Port." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
  }

  $dbExists = Invoke-PsqlScalar -Psql $psql -User $PostgresUser -Password $PostgresPassword -DbPort $Port -Sql "SELECT 1 FROM pg_database WHERE datname='$DbName'"

  if ($dbExists -ne '1') {
    Invoke-Psql -Psql $psql -User $PostgresUser -Password $PostgresPassword -DbPort $Port -Sql "CREATE DATABASE $DbName OWNER $AppUser"
  } else {
    Invoke-Psql -Psql $psql -User $PostgresUser -Password $PostgresPassword -DbPort $Port -Sql "ALTER DATABASE $DbName OWNER TO $AppUser"
  }

  Invoke-Psql -Psql $psql -User $PostgresUser -Password $PostgresPassword -DbPort $Port -Database $DbName -Sql `
    "GRANT ALL ON SCHEMA public TO $AppUser; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $AppUser;"

  if (-not (Test-AppDbConnection -Psql $psql -DbPort $Port)) {
    Write-Host "Setup ran but app user still cannot connect." -ForegroundColor Red
    exit 1
  }
  Write-Host "Database ready: $DbName / $AppUser" -ForegroundColor Green
} else {
  Write-Host "Database '$DbName' and user '$AppUser' already work on port $Port." -ForegroundColor Green
}

Set-EnvDatabaseUrl -DbPort $Port

Write-Step "npm install and Prisma..."
npm install
Import-RootEnv
npm run db:generate

Set-Location (Join-Path $Root "services\api")
try {
  npx prisma migrate deploy
  if (-not $SkipSeed) {
    npm run db:seed
  }
} catch {
  Set-Location $Root
  Write-Host "Migrate/seed failed: $_" -ForegroundColor Red
  exit 1
}

Set-Location $Root
Set-DevAuthReal

Write-Host ""
Write-Host "Local PostgreSQL setup complete!" -ForegroundColor Green
Write-Host "  npm run dev:api:stable   -> API http://localhost:3000"
Write-Host "  npm run dev:web-learner  -> Learner http://localhost:5175"
Write-Host ""
Write-Host "Demo login: learner@gotcha.app / Learner2026!"
