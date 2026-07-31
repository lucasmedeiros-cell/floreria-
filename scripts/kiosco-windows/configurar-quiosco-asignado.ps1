# ---------------------------------------------------------------------------
#  QUIOSCO DE WINDOWS (Acceso asignado) con el CRM de easy pos.
#
#  Esto es el quiosco "de verdad": la cuenta que se elija arranca dentro del
#  navegador y NO tiene escritorio ni Explorador; no se sale con Alt+F4.
#
#  Por qué hace falta este script:
#  El asistente de Windows (Configuración → Cuentas → Configurar un quiosco)
#  solo acepta aplicaciones de la Tienda. Si en él se pega una URL o la ruta de
#  un programa, al iniciar sesión sale la pantalla azul
#      "No pudimos iniciar la aplicación … 0x80070002"
#  que es "no encuentro esa aplicación". Para abrir Edge CON la URL como
#  argumento hay que escribir la configuración a mano (esquema v5 del Acceso
#  asignado, Windows 11 22H2 o superior), que es justo lo que hace este script.
#
#  Uso, en PowerShell COMO ADMINISTRADOR:
#    powershell -ExecutionPolicy Bypass -File .\configurar-quiosco-asignado.ps1
#
#  Otro negocio / servidor local:
#    .\configurar-quiosco-asignado.ps1 -Url "http://localhost:3010/admin"
#
#  Quitar el quiosco:
#    .\configurar-quiosco-asignado.ps1 -Quitar
#
#  ANTES de correrlo tiene que existir la cuenta local que va a atender (sin
#  contraseña o con una; la creás vos, este script no toca contraseñas):
#    Configuración → Cuentas → Otros usuarios → Agregar otro usuario
#    → "No tengo los datos de inicio de sesión de esta persona"
#    → "Agregar un usuario sin cuenta Microsoft"   → nombre: kiosco
# ---------------------------------------------------------------------------
param(
  [string]$Url = "https://easypos.easypaybo.com/n/auto_piezas_coquito/admin",
  # Cuenta local de Windows que queda dedicada al quiosco.
  [string]$Cuenta = "kiosco",
  [switch]$Quitar
)

$ErrorActionPreference = "Stop"
function Titulo($t) { Write-Host "`n==> $t" -ForegroundColor Yellow }
function Ok($t)     { Write-Host "    $t" -ForegroundColor Green }
function Error2($t) { Write-Host "ERROR: $t" -ForegroundColor Red }

$NS = "root\cimv2\mdm\dmmap"
$CL = "MDM_AssignedAccess"

# --- 0. Requisitos ----------------------------------------------------------
$esAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
  ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $esAdmin) { Error2 "hay que ejecutarlo como ADMINISTRADOR."; exit 1 }

# --- Quitar -----------------------------------------------------------------
if ($Quitar) {
  Titulo "Quitando el quiosco (Acceso asignado)"
  $obj = Get-CimInstance -Namespace $NS -ClassName $CL
  $obj.Configuration = $null
  Set-CimInstance -CimInstance $obj
  Ok "quitado: la cuenta '$Cuenta' vuelve a iniciar sesión normal"
  Write-Host ""
  exit 0
}

# --- 1. La cuenta tiene que existir ------------------------------------------
Titulo "Comprobando la cuenta '$Cuenta'"
if (-not (Get-LocalUser -Name $Cuenta -ErrorAction SilentlyContinue)) {
  Error2 "no existe la cuenta local '$Cuenta'."
  Write-Host "       Creala primero (Configuración → Cuentas → Otros usuarios →" -ForegroundColor Red
  Write-Host "       Agregar otro usuario → sin cuenta Microsoft) y volvé a correr esto." -ForegroundColor Red
  Write-Host "       Si preferís por consola:  net user $Cuenta /add" -ForegroundColor DarkYellow
  exit 1
}
Ok "existe"

# --- 2. Edge -----------------------------------------------------------------
Titulo "Buscando Microsoft Edge"
$edge = @(
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { Error2 "no encontré msedge.exe (instalá Microsoft Edge)."; exit 1 }
Ok $edge

# --- 3. Configuración del Acceso asignado ------------------------------------
# `KioskModeApp` con ClassicAppPath/ClassicAppArguments es del esquema v5: es lo
# que permite pasarle la URL a Edge. En Windows 10 (o 11 anterior a 22H2) esto
# NO existe y hay que usar el asistente con Edge como aplicación de quiosco.
Titulo "Escribiendo la configuración del quiosco"
$perfilId = "{" + [guid]::NewGuid().ToString() + "}"
$argumentos = "--kiosk $Url --edge-kiosk-type=fullscreen --no-first-run --no-default-browser-check --noerrdialogs --disable-session-crashed-bubble --hide-crash-restore-bubble --disable-pinch"

$xml = @"
<?xml version="1.0" encoding="utf-8" ?>
<AssignedAccessConfiguration
    xmlns="http://schemas.microsoft.com/AssignedAccess/2017/config"
    xmlns:rs5="http://schemas.microsoft.com/AssignedAccess/201810/config"
    xmlns:v5="http://schemas.microsoft.com/AssignedAccess/2022/config">
  <Profiles>
    <Profile Id="$perfilId">
      <KioskModeApp v5:ClassicAppPath="$edge" v5:ClassicAppArguments="$argumentos" />
    </Profile>
  </Profiles>
  <Configs>
    <Config>
      <Account>$env:COMPUTERNAME\$Cuenta</Account>
      <DefaultProfile Id="$perfilId"/>
    </Config>
  </Configs>
</AssignedAccessConfiguration>
"@

try {
  $obj = Get-CimInstance -Namespace $NS -ClassName $CL
  $obj.Configuration = [System.Net.WebUtility]::HtmlEncode($xml)
  Set-CimInstance -CimInstance $obj
} catch {
  Error2 "Windows rechazó la configuración: $($_.Exception.Message)"
  Write-Host "       Suele ser una versión de Windows anterior a 11 22H2 (no admite" -ForegroundColor DarkYellow
  Write-Host "       aplicaciones de escritorio en el quiosco). En ese caso usá" -ForegroundColor DarkYellow
  Write-Host "       configurar-kiosco.ps1, que funciona en cualquier edición." -ForegroundColor DarkYellow
  exit 1
}

Write-Host "`nLISTO" -ForegroundColor Green
Write-Host "  Cuenta de quiosco : $env:COMPUTERNAME\$Cuenta"
Write-Host "  CRM               : $Url"
Write-Host "  Cerrá sesión e iniciá con '$Cuenta': arranca dentro del CRM, sin escritorio."
Write-Host "  Para administrar la PC, entrá con tu cuenta de siempre."
Write-Host "  Para quitarlo: .\configurar-quiosco-asignado.ps1 -Quitar`n"
