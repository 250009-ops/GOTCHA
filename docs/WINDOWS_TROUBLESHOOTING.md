# Windows troubleshooting (Gotcha dev environment)

This guide covers common Windows issues when setting up Gotcha: WSL/Docker blocked, PostgreSQL without Docker, and related errors.

## WSL install — use the correct commands

**Do not** type arrows or plus signs as part of the command. These are wrong:

```text
wsl --install -> reboot    ❌
wsl --install + reboot     ❌
```

**Correct flow:**

1. Open **Command Prompt** or **PowerShell as Administrator**.
2. Run **only**:

   ```powershell
   wsl --install
   ```

3. When the command finishes, **close the terminal and reboot Windows yourself** (Start → PowerShell → `shutdown /r /t 0`, or Start → Restart). There is no `-> reboot` flag on `wsl`.

4. After reboot, open a normal terminal and verify:

   ```powershell
   wsl --status
   ```

### `wsl` is not recognized in PowerShell

Usually means WSL is not installed yet, or the shell was opened before installation finished.

- Run `wsl --install` from an **elevated** CMD or PowerShell (Run as administrator).
- If CMD works but PowerShell does not, restart PowerShell or sign out and back in after install.
- On older Windows builds, enable the feature manually (see below) instead of relying on `wsl --install`.

### HTTP 403 Forbidden on `wsl --install`

Often caused by corporate policy, VPN/proxy, or missing Windows optional features.

Try in order:

1. **Run as Administrator** (required for feature install).
2. **Disable VPN / corporate proxy** temporarily, or try from a network that allows Microsoft CDN downloads.
3. **Enable features manually** with DISM (Admin CMD or PowerShell):

   ```powershell
   dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
   dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
   ```

4. **Reboot**, then run `wsl --install` again (or install a Linux distro from the Microsoft Store).

5. Ensure **virtualization** is enabled in BIOS/UEFI if Docker/WSL2 still fails after reboot.

## Docker Desktop without working WSL

Docker Desktop on Windows typically needs WSL2. If WSL cannot be installed (403, policy, etc.), use **local PostgreSQL** instead of Docker for the database (Redis/MinIO remain optional for full stack).

## Local PostgreSQL (no Docker / no WSL)

Gotcha’s Docker Compose maps Postgres to host port **5433** to avoid clashing with a **Windows PostgreSQL service on 5432**. If you already run PostgreSQL 17 (or similar) locally, use that.

### Automated setup

From the repo root in PowerShell:

```powershell
cd "C:\projects\GOTCHA_android app"
.\scripts\setup-local-postgres.ps1
```

When prompted, enter the **`postgres` superuser password** you chose during PostgreSQL installation.

Non-interactive (password on command line — avoid on shared screens):

```powershell
.\scripts\setup-local-postgres.ps1 -PostgresPassword "YOUR_POSTGRES_PASSWORD"
```

The script will:

- Detect PostgreSQL listening on port **5432** (or nearby ports)
- Create database **`gotcha`**, user **`gotcha`**, password **`gotcha_dev`**
- Set `.env` `DATABASE_URL` to `localhost:5432` (not 5433)
- Run `prisma migrate deploy` and seed
- Set `DEV_AUTH_ANY_CREDENTIAL=false`

Then start the API:

```powershell
npm run dev:api:stable
npm run dev:web-learner
```

### Manual checks

Find `psql` (example for PostgreSQL 17):

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost -p 5432 -c "SELECT version();"
```

Check something is listening on 5432:

```powershell
netstat -ano | findstr ":5432"
Get-Service *postgres*
```

### Learner app without any database

If neither Docker nor local Postgres is available, set in `.env`:

```env
DEV_AUTH_ANY_CREDENTIAL=true
```

The learner web app can use in-memory dev auth (no real DB). This is **not** suitable for API features that need PostgreSQL.

## PostgreSQL vs Docker port summary

| Setup | Typical `DATABASE_URL` host port |
|--------|----------------------------------|
| Docker (`docker compose`) | **5433** |
| Local Windows PostgreSQL | **5432** |

## Still stuck?

- [PostgreSQL Windows downloads](https://www.postgresql.org/download/windows/)
- [Microsoft WSL install docs](https://learn.microsoft.com/en-us/windows/wsl/install)
- Project [README](../README.md) and [ARCHITECTURE.md](ARCHITECTURE.md)
