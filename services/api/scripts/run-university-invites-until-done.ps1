# Keeps resuming university invitation sends until every student is delivered.
$ErrorActionPreference = 'Stop'
$ApiRoot = Split-Path $PSScriptRoot -Parent
$RepoRoot = Split-Path (Split-Path $ApiRoot -Parent) -Parent
Set-Location $ApiRoot

function Get-MissingCount {
  node -e @"
const fs=require('fs');
const csvPath='${RepoRoot}/scripts/student-exams.csv'.replace(/\\\\/g,'/');
const logPath='scripts/.university-invites-sent.log';
const csv=fs.readFileSync(csvPath,'utf8');
const sent=new Set(
  fs.existsSync(logPath)
    ? fs.readFileSync(logPath,'utf8').split(/\r?\n/).map(s=>s.trim()).filter(Boolean)
    : []
);
let total=0, missing=0;
for (const line of csv.split(/\r?\n/)) {
  const id=line.split(',')[0]?.trim();
  if (!/^\d{6}$/.test(id)) continue;
  total++;
  const email=id+'@newuu.uz';
  if (!sent.has(email)) missing++;
}
console.log(JSON.stringify({ total, sent: sent.size, missing }));
"@
}

while ($true) {
  $stats = Get-MissingCount | ConvertFrom-Json
  Write-Host ("[{0}] Sent: {1}/{2}, Missing: {3}" -f (Get-Date -Format 'HH:mm:ss'), $stats.sent, $stats.total, $stats.missing)

  if ($stats.missing -eq 0) {
    Write-Host 'All students have been emailed.'
    break
  }

  node scripts/send-university-invitations.mjs --send --resume
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Send batch exited with code $LASTEXITCODE, retrying in 10s..."
    Start-Sleep -Seconds 10
  } else {
    Start-Sleep -Seconds 2
  }
}
