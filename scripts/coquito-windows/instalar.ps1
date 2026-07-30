# ---------------------------------------------------------------------------
#  Instalador del SERVIDOR easy pos (Auto Piezas Coquito) para Windows.
#
#  Se ejecuta UNA vez en la PC del negocio, desde la carpeta del paquete,
#  en una PowerShell de ADMINISTRADOR:
#    powershell -ExecutionPolicy Bypass -File C:\easypos-servidor\instalar.ps1
#
#  Hace, en orden:
#    1. Verifica/instala Node.js LTS (con winget si existe).
#    2. Verifica/instala PostgreSQL 16. Si la PC ya tiene un PostgreSQL VIEJO
#       de otro programa (p. ej. 9.6), NO lo toca: instala el 16 al lado, en
#       el puerto 5433, y easy pos usa ese.
#    3. Crea el rol easypos y la base bo_epos_coquito, aplica db\schema.sql
#       y semilla.sql (config del negocio + usuario administrador), y deja
#       el puerto correcto escrito en .env.local.
#    4. Instala las dependencias del servidor (npm ci, necesita internet).
#    5. Abre el puerto 3010 en el Firewall de Windows.
#    6. Crea la tarea "easypos-servidor" (arranca solo con Windows), arranca
#       y comprueba http://localhost:3010/api/health.
#  Es re-ejecutable: si algo fallo, se corrige y se vuelve a correr entero.
# ---------------------------------------------------------------------------
$ErrorActionPreference = "Stop"
$DIR = $PSScriptRoot
$PG_PASS_EASYPOS = "Coquito.2026.local"   # clave del rol easypos (la usa .env.local)
$PG_MIN = 12                               # version minima de PostgreSQL que sirve
$PUERTO = 3010

function Titulo($t) { Write-Host "`n==> $t" -ForegroundColor Yellow }

# --- 0. Chequeos previos ---------------------------------------------------
if (-not (Test-Path "$DIR\.next") -or -not (Test-Path "$DIR\package.json")) {
  Write-Host "ERROR: ejecuta este script DESDE la carpeta del paquete easypos-servidor (no se encontro .next / package.json)." -ForegroundColor Red
  exit 1
}
$esAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
  ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $esAdmin) {
  Write-Host "ERROR: hay que ejecutarlo como ADMINISTRADOR (clic derecho -> Ejecutar como administrador)." -ForegroundColor Red
  exit 1
}

function RefrescarPath {
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
              [Environment]::GetEnvironmentVariable("Path", "User")
}

$hayWinget = [bool](Get-Command winget -ErrorAction SilentlyContinue)

# --- 1. Node.js ------------------------------------------------------------
Titulo "1/6  Node.js"
RefrescarPath
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  if ($hayWinget) {
    Write-Host "    Instalando Node.js LTS con winget..."
    winget install --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
    RefrescarPath
  }
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: falta Node.js. Descargalo de https://nodejs.org (version LTS), instalalo y volve a correr este script." -ForegroundColor Red
    exit 1
  }
}
Write-Host "    Node $(node --version)"

# --- 2. PostgreSQL ---------------------------------------------------------
Titulo "2/6  PostgreSQL"

# Lista las instalaciones de C:\Program Files\PostgreSQL, de la mas nueva a
# la mas vieja (comparando el NUMERO de version: 16 > 9.6, aunque "9" > "1"
# como texto).
function PgInstalados {
  Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue |
    ForEach-Object {
      $verDir = $_.Directory.Parent.Name          # "16", "9.6", ...
      $major = 0
      if ($verDir -match '^(\d+)') { $major = [int]$Matches[1] }
      [pscustomobject]@{ Psql = $_.FullName; Raiz = $_.Directory.Parent.FullName; Major = $major; Ver = $verDir }
    } | Sort-Object Major -Descending
}

$todos = @(PgInstalados)
$viejos = @($todos | Where-Object { $_.Major -lt $PG_MIN })
if ($viejos.Count -gt 0) {
  Write-Host "    OJO: esta PC ya tiene PostgreSQL $($viejos[0].Ver) (de otro programa)." -ForegroundColor Cyan
  Write-Host "    No se toca: easy pos usa su propio PostgreSQL, en otro puerto." -ForegroundColor Cyan
}

$pg = $todos | Where-Object { $_.Major -ge $PG_MIN } | Select-Object -First 1
if (-not $pg) {
  # Que puerto usar para el PostgreSQL nuevo: 5432 si esta libre; si esta
  # ocupado (el PostgreSQL viejo casi seguro), 5433.
  $ocupado = Test-NetConnection -ComputerName localhost -Port 5432 -InformationLevel Quiet -WarningAction SilentlyContinue
  $portNuevo = if ($ocupado) { 5433 } else { 5432 }
  if ($hayWinget) {
    Write-Host "    Instalando PostgreSQL 16 en el puerto $portNuevo (clave de 'postgres': $PG_PASS_EASYPOS)..."
    winget install --id PostgreSQL.PostgreSQL.16 --silent --accept-package-agreements --accept-source-agreements --custom "--superpassword $PG_PASS_EASYPOS --serverport $portNuevo"
    RefrescarPath
    $pg = @(PgInstalados) | Where-Object { $_.Major -ge $PG_MIN } | Select-Object -First 1
  }
  if (-not $pg) {
    Write-Host "ERROR: falta PostgreSQL 16. Instalalo desde https://www.postgresql.org/download/windows/" -ForegroundColor Red
    Write-Host "       (siguiente-siguiente; ANOTA la clave del usuario 'postgres'; si pregunta el puerto, usa $portNuevo)" -ForegroundColor Red
    Write-Host "       y volve a correr este script." -ForegroundColor Red
    exit 1
  }
}

# Puerto REAL de esa instalacion: se lee de su postgresql.conf.
$PG_PORT = 5432
$conf = Join-Path $pg.Raiz "data\postgresql.conf"
if (Test-Path $conf) {
  $linea = Select-String -Path $conf -Pattern '^\s*port\s*=\s*(\d+)' | Select-Object -First 1
  if ($linea) { $PG_PORT = [int]$linea.Matches[0].Groups[1].Value }
}
$PSQL = $pg.Psql
Write-Host "    Usando PostgreSQL $($pg.Ver) en puerto $PG_PORT ($PSQL)"

# --- 3. Base de datos ------------------------------------------------------
Titulo "3/6  Base de datos bo_epos_coquito"
$pgSuperPass = Read-Host "    Clave del usuario 'postgres' del PostgreSQL $($pg.Ver) (ENTER si es $PG_PASS_EASYPOS)"
if ([string]::IsNullOrWhiteSpace($pgSuperPass)) { $pgSuperPass = $PG_PASS_EASYPOS }

$env:PGPASSWORD = $pgSuperPass
# Ojo: PowerShell 5 convierte el stderr redirigido de un programa nativo en
# error fatal con ErrorActionPreference=Stop; se baja a Continue para los
# comandos cuyo error es esperable (objeto que ya existe).
function PsqlCallado {
  param([string[]]$Argumentos)
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & $PSQL @Argumentos 2>$null | Out-Null
  $code = $LASTEXITCODE
  $ErrorActionPreference = $prev
  return $code
}
PsqlCallado @("-U","postgres","-h","localhost","-p","$PG_PORT","-c","CREATE ROLE easypos;") | Out-Null
& $PSQL -U postgres -h localhost -p $PG_PORT -v ON_ERROR_STOP=0 -c "ALTER ROLE easypos WITH LOGIN PASSWORD '$PG_PASS_EASYPOS';"
$hayBase = & $PSQL -U postgres -h localhost -p $PG_PORT -tAc "SELECT 1 FROM pg_database WHERE datname = 'bo_epos_coquito';"
if ("$hayBase".Trim() -ne "1") {
  & $PSQL -U postgres -h localhost -p $PG_PORT -v ON_ERROR_STOP=0 -c "CREATE DATABASE bo_epos_coquito OWNER easypos;"
}
& $PSQL -U postgres -h localhost -p $PG_PORT -d bo_epos_coquito -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: no se pudo entrar al PostgreSQL $($pg.Ver) (puerto $PG_PORT) con esa clave de 'postgres'." -ForegroundColor Red
  Write-Host "       Revisa la clave y volve a correr el script." -ForegroundColor Red
  exit 1
}

$env:PGPASSWORD = $PG_PASS_EASYPOS
& $PSQL -U easypos -h localhost -p $PG_PORT -d bo_epos_coquito -v ON_ERROR_STOP=1 -f "$DIR\db\schema.sql"
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR aplicando db\schema.sql" -ForegroundColor Red; exit 1 }
& $PSQL -U easypos -h localhost -p $PG_PORT -d bo_epos_coquito -v ON_ERROR_STOP=1 -f "$DIR\semilla.sql"
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR aplicando semilla.sql" -ForegroundColor Red; exit 1 }
$env:PGPASSWORD = $null

# .env.local tiene que apuntar al puerto que quedo elegido.
$envFile = "$DIR\.env.local"
(Get-Content $envFile) -replace 'localhost:\d+/bo_epos_coquito', "localhost:$PG_PORT/bo_epos_coquito" |
  Set-Content $envFile
Write-Host "    Base lista (esquema + usuario administrador, puerto $PG_PORT)."

# --- 4. Dependencias del servidor -----------------------------------------
Titulo "4/6  Dependencias del servidor (npm ci)"
if (-not (Test-Path "$DIR\node_modules\next")) {
  Push-Location $DIR
  npm ci --omit=dev
  $ok = $LASTEXITCODE
  Pop-Location
  if ($ok -ne 0) {
    Write-Host "ERROR: fallo npm ci (se necesita internet la primera vez). Revisa la conexion y volve a correr." -ForegroundColor Red
    exit 1
  }
} else {
  Write-Host "    node_modules ya presente, no se reinstala."
}

# --- 5. Firewall -----------------------------------------------------------
Titulo "5/6  Firewall (puerto $PUERTO para los celulares)"
if (-not (Get-NetFirewallRule -DisplayName "easy pos servidor" -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName "easy pos servidor" -Direction Inbound -Protocol TCP `
    -LocalPort $PUERTO -Action Allow -Profile Any | Out-Null
  Write-Host "    Regla creada."
} else {
  Write-Host "    La regla ya existia."
}

# --- 6. Tarea programada (arranque automatico) + arranque ------------------
Titulo "6/6  Arranque automatico y prueba"
$accion = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$DIR\iniciar-servidor.bat`"" -WorkingDirectory $DIR
$disparo = New-ScheduledTaskTrigger -AtStartup
$conf2 = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName "easypos-servidor" -Action $accion -Trigger $disparo -Settings $conf2 `
  -User "SYSTEM" -RunLevel Highest -Force | Out-Null
Start-ScheduledTask -TaskName "easypos-servidor"

Write-Host "    Esperando que el servidor responda..." -NoNewline
$listo = $false
foreach ($i in 1..30) {
  Start-Sleep -Seconds 2
  try {
    $r = Invoke-WebRequest "http://localhost:$PUERTO/api/health" -UseBasicParsing -TimeoutSec 3
    if ($r.StatusCode -eq 200) { $listo = $true; break }
  } catch { Write-Host "." -NoNewline }
}
Write-Host ""

if (-not $listo) {
  Write-Host "AVISO: el servidor no respondio todavia. Mira el archivo servidor.log en esta carpeta y volve a correr el script." -ForegroundColor Red
  exit 1
}

# --- Resumen final ---------------------------------------------------------
$ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -match '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)' } |
  Select-Object -ExpandProperty IPAddress -Unique

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Green
Write-Host " LISTO. El servidor easy pos quedo instalado y corriendo." -ForegroundColor Green
Write-Host "   - Programa de PC:  servidor http://localhost:$PUERTO"
Write-Host "   - Celulares (misma WiFi): la app lo encuentra sola, o a mano:"
foreach ($ip in $ips) { Write-Host "       http://${ip}:$PUERTO" }
Write-Host "   - Entrar con:  admin@coquito.local  /  Coquito-Wd3sV5A3"
Write-Host "   - Arranca solo al prender la PC (tarea 'easypos-servidor')."
Write-Host "==================================================================" -ForegroundColor Green
