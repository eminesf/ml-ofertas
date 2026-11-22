# Sobe e mantém o ambiente local: Docker -> Postgres -> pm2 (backend + site).
# Executado pela tarefa agendada ml-ofertas-pm2-resurrect no login E a cada
# 10 min. Se a API (3001) e o site (3002) já respondem, sai na hora sem fazer
# nada — então é seguro rodar quantas vezes quiser. Assim, se a execução do
# login falhar (como em 11/11/2026, depois de um reinício do Windows Update)
# ou o pm2 morrer, tudo volta sozinho em até 10 min.
# Log: %USERPROFILE%\.pm2\start-local.log

$ErrorActionPreference = 'Continue'
$root = Split-Path $PSScriptRoot -Parent
$compose = Join-Path $root 'docker-compose.yml'
$ecosystem = Join-Path $root 'ecosystem.config.js'
$pm2 = 'C:\nvm4w\nodejs\pm2.cmd'
$log = Join-Path $env:USERPROFILE '.pm2\start-local.log'

function Write-Log($message) {
  try { Add-Content -Path $log -Encoding utf8 -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $message" } catch {}
}

function Test-Url($url) {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
    return $r.StatusCode -eq 200
  } catch { return $false }
}

function Test-Tudo {
  (Test-Url 'http://127.0.0.1:3001/api/offers?limit=1') -and (Test-Url 'http://127.0.0.1:3002/')
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

# Túnel Cloudflare (compartilhado com o bot-leilao): expõe a API em
# api-ofertas.emiliano.dev.br para o site da Vercel. Sobe se não estiver rodando;
# mais de um conector no mesmo túnel é permitido, então não atrapalha o do leilão.
$cloudflared = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
if ((Test-Path $cloudflared) -and -not (Get-Process -Name 'cloudflared' -ErrorAction SilentlyContinue)) {
  Write-Log 'Iniciando cloudflared (tunnel bot-leilao)'
  $cfLog = Join-Path $env:USERPROFILE '.cloudflared\cloudflared-run.log'
  Start-Process -FilePath $cloudflared -ArgumentList "--logfile `"$cfLog`" tunnel run 34b43edf-91fc-4f12-a193-42734c8b3b44" -WindowStyle Hidden
}

# Caminho rápido: tudo no ar, nada a fazer (sem log, pra não encher o arquivo).
if (Test-Tudo) { exit 0 }

try {
  Write-Log 'Inicio (API ou site fora do ar)'

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

  # resurrect traz o que estava salvo; o start pelo ecosystem garante os dois
  # apps mesmo se o dump estiver vazio/velho (não reinicia o que já roda).
  & $pm2 resurrect *> $null
  Write-Log "pm2 resurrect exit $LASTEXITCODE"
  Push-Location $root
  & $pm2 start $ecosystem *> $null
  Write-Log "pm2 start ecosystem exit $LASTEXITCODE"
  Pop-Location

  $ok = $false
  for ($i = 0; $i -lt 12 -and -not $ok; $i++) {
    Start-Sleep -Seconds 5
    $ok = Test-Tudo
  }
  if ($ok) { Write-Log 'OK: API e site respondendo'; exit 0 }
  Write-Log 'ERRO: pm2 subiu mas API/site nao responderam em 60s (ver pm2 logs)'
  exit 1
} catch {
  Write-Log "ERRO inesperado: $($_.Exception.Message)"
  exit 1
}
