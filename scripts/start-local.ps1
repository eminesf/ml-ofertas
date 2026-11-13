# Sobe o ambiente local no login do Windows, na ordem certa: Docker -> Postgres -> pm2.
# Executado pela tarefa agendada ml-ofertas-pm2-resurrect. Pode rodar mais de uma vez.
# Log: %USERPROFILE%\.pm2\start-local.log

$root = Split-Path $PSScriptRoot -Parent
$compose = Join-Path $root 'docker-compose.yml'
$pm2 = 'C:\nvm4w\nodejs\pm2.cmd'
$log = Join-Path $env:USERPROFILE '.pm2\start-local.log'

function Write-Log($message) {
  Add-Content -Path $log -Encoding utf8 -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $message"
}

function Wait-Until($seconds, [scriptblock]$check) {
  $deadline = (Get-Date).AddSeconds($seconds)
  do {
    & $check *> $null
    if ($LASTEXITCODE -eq 0) { return $true }
    Start-Sleep -Seconds 5
  } while ((Get-Date) -lt $deadline)
  return $false
}

Write-Log 'Inicio'

if (-not (Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue)) {
  Write-Log 'Abrindo Docker Desktop'
  Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
}

if (-not (Wait-Until 600 { docker info })) {
  Write-Log 'ERRO: Docker nao ficou pronto em 10 min'
  exit 1
}

docker compose -f $compose up -d *> $null

if (-not (Wait-Until 120 { docker exec ml-ofertas-postgres pg_isready -U mlofertas })) {
  Write-Log 'ERRO: Postgres nao ficou pronto em 2 min'
  exit 1
}

& $pm2 resurrect *> $null
Write-Log "pm2 resurrect exit $LASTEXITCODE"
exit $LASTEXITCODE
