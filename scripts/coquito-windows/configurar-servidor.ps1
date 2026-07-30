# ---------------------------------------------------------------------------
#  Configura el SERVIDOR easy pos (Auto Piezas Coquito) - version OFFLINE.
#
#  La ejecuta automaticamente el instalador todo-en-uno del programa de PC
#  (ya elevado como administrador y con -ExecutionPolicy Bypass), y tambien
#  se puede volver a correr a mano:
#    powershell -ExecutionPolicy Bypass -File C:\easypos-servidor\configurar-servidor.ps1
#
#  A diferencia de instalar.ps1 (la version "online"), NO descarga nada:
#  PostgreSQL, Node portable y todas las dependencias vienen en el paquete.
#  Lecciones de campo que este script ya contempla:
#    - PCs con un PostgreSQL VIEJO de otro programa (p. ej. 9.6): no se toca;
#      el PostgreSQL 16 propio se instala al lado, en el puerto libre (5433).
#    - Descargas que fallan (winget/EDB 403): no hay descargas.
#    - Sesiones remotas que se cortan: no hay preguntas en el camino feliz;
#      todo queda logueado en C:\easypos-servidor\instalacion.log.
#  Es re-ejecutable sin romper nada.
# ---------------------------------------------------------------------------
$ErrorActionPreference = "Stop"
$ORIGEN = $PSScriptRoot
$DEST = "C:\easypos-servidor"
$PG_PASS = "Coquito.2026.local"   # clave del rol easypos y del postgres NUESTRO
$PG_MIN = 12                       # version minima de PostgreSQL que sirve
$PUERTO = 3010

New-Item -ItemType Directory -Force -Path $DEST | Out-Null
try { Start-Transcript -Path "$DEST\instalacion.log" -Append | Out-Null } catch {}

function Titulo($t) { Write-Host "`n==> $t" -ForegroundColor Yellow }
$fallo = $false

try {
  # --- 1/5 Copiar los archivos del servidor -------------------------------
  Titulo "1/5  Archivos del servidor -> $DEST"
  if ($ORIGEN.TrimEnd('\') -ne $DEST.TrimEnd('\')) {
    # El instalador de PostgreSQL (300+ MB) se queda en el paquete: no hace
    # falta en el disco una vez instalado. .env.local no se pisa si ya existe
    # (conserva el puerto elegido en una instalacion anterior).
    $xf = @("postgresql-*.exe")
    if (Test-Path "$DEST\.env.local") { $xf += ".env.local" }
    robocopy $ORIGEN $DEST /E /NFL /NDL /NJH /NJS /XF @xf | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "fallo la copia de archivos (robocopy $LASTEXITCODE)" }
  }
  if (-not (Test-Path "$DEST\node_modules\next")) { throw "el paquete esta incompleto (falta node_modules)" }
  if (-not (Test-Path "$DEST\runtime\node.exe"))  { throw "el paquete esta incompleto (falta runtime\node.exe)" }
  Write-Host "    OK."

  # --- 2/5 PostgreSQL ------------------------------------------------------
  Titulo "2/5  PostgreSQL"
  function PgInstalados {
    Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue |
      ForEach-Object {
        $verDir = $_.Directory.Parent.Name
        $major = 0
        if ($verDir -match '^(\d+)') { $major = [int]$Matches[1] }
        [pscustomobject]@{ Psql = $_.FullName; Raiz = $_.Directory.Parent.FullName; Major = $major; Ver = $verDir }
      } | Sort-Object Major -Descending
  }

  $todos = @(PgInstalados)
  $viejos = @($todos | Where-Object { $_.Major -lt $PG_MIN })
  if ($viejos.Count -gt 0) {
    Write-Host "    OJO: esta PC ya tiene PostgreSQL $($viejos[0].Ver) (de otro programa). No se toca." -ForegroundColor Cyan
  }

  $pg = $todos | Where-Object { $_.Major -ge $PG_MIN } | Select-Object -First 1
  if (-not $pg) {
    $pgExe = $null
    foreach ($d in @($ORIGEN, $DEST)) {
      $e = Get-ChildItem "$d\postgresql-*-windows-x64.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($e) { $pgExe = $e.FullName; break }
    }
    if (-not $pgExe) { throw "no se encontro el instalador de PostgreSQL dentro del paquete" }

    $ocupado = Test-NetConnection -ComputerName localhost -Port 5432 -InformationLevel Quiet -WarningAction SilentlyContinue
    $portNuevo = if ($ocupado) { 5433 } else { 5432 }
    Write-Host "    Instalando PostgreSQL 16 desde el paquete (puerto $portNuevo, sin internet)..."
    Write-Host "    Esto tarda unos minutos; no cierres esta ventana."
    $p = Start-Process -FilePath $pgExe -Wait -PassThru -ArgumentList `
      "--mode","unattended","--unattendedmodeui","none", `
      "--superaccount","postgres","--superpassword",$PG_PASS, `
      "--serverport","$portNuevo"
    if ($p.ExitCode -ne 0) { throw "el instalador de PostgreSQL devolvio el codigo $($p.ExitCode)" }
    $pg = @(PgInstalados) | Where-Object { $_.Major -ge $PG_MIN } | Select-Object -First 1
    if (-not $pg) { throw "PostgreSQL 16 no aparece instalado despues de correr su instalador" }
  }

  # Puerto REAL de esa instalacion (leido de su postgresql.conf).
  $PG_PORT = 5432
  $conf = Join-Path $pg.Raiz "data\postgresql.conf"
  if (Test-Path $conf) {
    $linea = Select-String -Path $conf -Pattern '^\s*port\s*=\s*(\d+)' | Select-Object -First 1
    if ($linea) { $PG_PORT = [int]$linea.Matches[0].Groups[1].Value }
  }
  $PSQL = $pg.Psql
  Write-Host "    Usando PostgreSQL $($pg.Ver) en puerto $PG_PORT"

  # Helper: corre psql descartando su salida y sus errores ESPERABLES (objeto
  # que ya existe, servicio que recien arranca). Ojo: PowerShell 5 convierte el
  # stderr redirigido de un programa nativo en error FATAL si
  # ErrorActionPreference es Stop; por eso aca se baja a Continue un momento.
  function PsqlCallado {
    param([string[]]$Argumentos)
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & $PSQL @Argumentos 2>$null | Out-Null
    $code = $LASTEXITCODE
    $ErrorActionPreference = $prev
    return $code
  }

  # Esperar a que el servicio acepte conexiones (recien instalado tarda).
  $env:PGPASSWORD = $PG_PASS
  $conecta = $false
  foreach ($i in 1..30) {
    if ((PsqlCallado @("-U","postgres","-h","localhost","-p","$PG_PORT","-c","SELECT 1;")) -eq 0) { $conecta = $true; break }
    Start-Sleep -Seconds 3
  }
  if (-not $conecta) {
    # PostgreSQL moderno pre-existente con otra clave de postgres: unico caso
    # en que hay que preguntar. (Con el PG16 del paquete la clave es la nuestra.)
    Write-Host "    No se pudo entrar con la clave estandar." -ForegroundColor Cyan
    $otra = Read-Host "    Clave del usuario 'postgres' del PostgreSQL $($pg.Ver)"
    $env:PGPASSWORD = $otra
    if ((PsqlCallado @("-U","postgres","-h","localhost","-p","$PG_PORT","-c","SELECT 1;")) -ne 0) {
      throw "no se pudo entrar a PostgreSQL (puerto $PG_PORT): clave de 'postgres' incorrecta"
    }
  }

  # --- 3/5 Base de datos ----------------------------------------------------
  Titulo "3/5  Base de datos bo_epos_coquito"
  # Rol easypos: crear solo si falta (sin error si ya estaba) y SIEMPRE
  # asegurar login + la clave esperada, aunque quede de un intento anterior.
  PsqlCallado @("-U","postgres","-h","localhost","-p","$PG_PORT","-c","CREATE ROLE easypos;") | Out-Null
  & $PSQL -U postgres -h localhost -p $PG_PORT -v ON_ERROR_STOP=1 -c "ALTER ROLE easypos WITH LOGIN PASSWORD '$PG_PASS';"
  if ($LASTEXITCODE -ne 0) { throw "no se pudo configurar el rol easypos" }

  # Base: crear solo si no existe (CREATE DATABASE no admite IF NOT EXISTS).
  $hayBase = & $PSQL -U postgres -h localhost -p $PG_PORT -tAc "SELECT 1 FROM pg_database WHERE datname = 'bo_epos_coquito';"
  if ("$hayBase".Trim() -ne "1") {
    & $PSQL -U postgres -h localhost -p $PG_PORT -v ON_ERROR_STOP=1 -c "CREATE DATABASE bo_epos_coquito OWNER easypos;"
    if ($LASTEXITCODE -ne 0) { throw "no se pudo crear la base bo_epos_coquito" }
  } else {
    Write-Host "    La base ya existia (de un intento anterior): se reutiliza."
    PsqlCallado @("-U","postgres","-h","localhost","-p","$PG_PORT","-c","ALTER DATABASE bo_epos_coquito OWNER TO easypos;") | Out-Null
  }

  & $PSQL -U postgres -h localhost -p $PG_PORT -d bo_epos_coquito -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
  if ($LASTEXITCODE -ne 0) { throw "no se pudo preparar la base (extension pgcrypto)" }

  $env:PGPASSWORD = $PG_PASS
  & $PSQL -U easypos -h localhost -p $PG_PORT -d bo_epos_coquito -v ON_ERROR_STOP=1 -f "$DEST\db\schema.sql"
  if ($LASTEXITCODE -ne 0) { throw "fallo aplicando db\schema.sql" }
  & $PSQL -U easypos -h localhost -p $PG_PORT -d bo_epos_coquito -v ON_ERROR_STOP=1 -f "$DEST\semilla.sql"
  if ($LASTEXITCODE -ne 0) { throw "fallo aplicando semilla.sql" }
  $env:PGPASSWORD = $null

  # .env.local tiene que apuntar al puerto que quedo elegido.
  $envFile = "$DEST\.env.local"
  (Get-Content $envFile) -replace 'localhost:\d+/bo_epos_coquito', "localhost:$PG_PORT/bo_epos_coquito" |
    Set-Content $envFile
  Write-Host "    Base lista (esquema + usuario administrador, puerto $PG_PORT)."

  # --- 4/5 Firewall ---------------------------------------------------------
  Titulo "4/5  Firewall (puerto $PUERTO para los celulares)"
  if (-not (Get-NetFirewallRule -DisplayName "easy pos servidor" -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName "easy pos servidor" -Direction Inbound -Protocol TCP `
      -LocalPort $PUERTO -Action Allow -Profile Any | Out-Null
    Write-Host "    Regla creada."
  } else {
    Write-Host "    La regla ya existia."
  }

  # --- 5/5 Arranque automatico y prueba ------------------------------------
  Titulo "5/5  Arranque automatico y prueba"
  $accion = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$DEST\iniciar-servidor.bat`"" -WorkingDirectory $DEST
  $disparo = New-ScheduledTaskTrigger -AtStartup
  $conf2 = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
  Stop-ScheduledTask -TaskName "easypos-servidor" -ErrorAction SilentlyContinue
  Register-ScheduledTask -TaskName "easypos-servidor" -Action $accion -Trigger $disparo -Settings $conf2 `
    -User "SYSTEM" -RunLevel Highest -Force | Out-Null
  Start-Sleep -Seconds 2
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
  if (-not $listo) { throw "el servidor no respondio en http://localhost:$PUERTO (ver $DEST\servidor.log)" }

  # Acceso directo en el escritorio (de todos los usuarios) para exportar /
  # respaldar la base cuando el cliente quiera. Si falla, no frena nada.
  try {
    $lnk = Join-Path ([Environment]::GetFolderPath('CommonDesktopDirectory')) "Exportar datos easy pos.lnk"
    $ws = New-Object -ComObject WScript.Shell
    $s = $ws.CreateShortcut($lnk)
    $s.TargetPath = "$DEST\Exportar datos easy pos.bat"
    $s.WorkingDirectory = $DEST
    $s.Description = "Exporta la base de easy pos: respaldo completo + CSV para Excel"
    $s.Save()
    Write-Host "    Acceso directo 'Exportar datos easy pos' creado en el escritorio."
  } catch {}

  # --- Resumen final --------------------------------------------------------
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
} catch {
  $fallo = $true
  Write-Host ""
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Detalle completo en $DEST\instalacion.log" -ForegroundColor Red
  Write-Host "Se puede volver a correr con:" -ForegroundColor Red
  Write-Host "  powershell -ExecutionPolicy Bypass -File $DEST\configurar-servidor.ps1" -ForegroundColor Red
}

try { Stop-Transcript | Out-Null } catch {}
if ($fallo) { exit 1 } else { exit 0 }
