# ---------------------------------------------------------------------------
#  MODO KIOSCO de easy pos para Windows.
#
#  Deja la PC dedicada al CRM: al prender Windows se abre el navegador a
#  pantalla completa con el CRM del negocio y sin barra de direcciones, pestañas
#  ni menús. Sirve para el equipo del mostrador, que no tiene que hacer otra
#  cosa que vender.
#
#  Se ejecuta UNA vez, en una PowerShell del USUARIO que va a atender (NO hace
#  falta administrador):
#    powershell -ExecutionPolicy Bypass -File .\configurar-kiosco.ps1
#
#  Con otro negocio o para probar, se le pasa la URL:
#    .\configurar-kiosco.ps1 -Url "https://easypos.easypaybo.com/n/otro/admin"
#
#  Para desarmarlo:
#    .\configurar-kiosco.ps1 -Quitar
#
#  Qué hace:
#    1. Busca Edge o Chrome (los dos sirven; Edge viene con Windows).
#    2. Crea "Iniciar kiosco easy pos.cmd" con las banderas del kiosco.
#    3. Pone un acceso directo en la carpeta de Inicio del usuario, para que
#       arranque solo al iniciar sesión.
#    4. Usa un PERFIL PROPIO del navegador (carpeta aparte): así la sesión del
#       CRM queda abierta entre reinicios y no se mezcla con la navegación
#       personal de nadie.
# ---------------------------------------------------------------------------
param(
  # CRM del negocio. Este es el de Auto Piezas Coquito en el servidor de easy pos.
  [string]$Url = "https://easypos.easypaybo.com/n/auto_piezas_coquito/admin",
  # Carpeta donde se deja el lanzador y el perfil del navegador.
  [string]$Carpeta = "$env:LOCALAPPDATA\easypos-kiosco",
  # Navegador a usar: auto (el que haya), edge o chrome.
  [ValidateSet("auto", "edge", "chrome")][string]$Navegador = "auto",
  # Impresión sin diálogo: el ticket sale directo a la impresora por defecto.
  [switch]$SinDialogoDeImpresion,
  # Desarma el kiosco (borra lanzador y arranque automático).
  [switch]$Quitar
)

$ErrorActionPreference = "Stop"
function Titulo($t) { Write-Host "`n==> $t" -ForegroundColor Yellow }
function Ok($t)     { Write-Host "    $t" -ForegroundColor Green }
function Aviso($t)  { Write-Host "    $t" -ForegroundColor DarkYellow }

$NOMBRE   = "Iniciar kiosco easy pos"
$LANZADOR = Join-Path $Carpeta "$NOMBRE.cmd"
$INICIO   = [Environment]::GetFolderPath("Startup")
$ACCESO   = Join-Path $INICIO "$NOMBRE.lnk"

# --- Quitar ----------------------------------------------------------------
if ($Quitar) {
  Titulo "Quitando el modo kiosco"
  if (Test-Path $ACCESO)   { Remove-Item $ACCESO -Force;   Ok "arranque automatico quitado" }
  if (Test-Path $LANZADOR) { Remove-Item $LANZADOR -Force; Ok "lanzador borrado" }
  Aviso "El perfil del navegador queda en $Carpeta (borralo a mano si no lo vas a usar mas)."
  Write-Host "`nLISTO: la PC vuelve a arrancar normal.`n" -ForegroundColor Green
  exit 0
}

# --- 1. Navegador ----------------------------------------------------------
Titulo "Buscando el navegador"
$rutasEdge = @(
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)
$rutasChrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$candidatas = switch ($Navegador) {
  "edge"   { $rutasEdge }
  "chrome" { $rutasChrome }
  default  { $rutasEdge + $rutasChrome }   # Edge primero: viene con Windows
}
$exe = $candidatas | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $exe) {
  Write-Host "ERROR: no encontre Edge ni Chrome instalados." -ForegroundColor Red
  Write-Host "       Instala uno de los dos y volve a correr este script." -ForegroundColor Red
  exit 1
}
$esEdge = $exe -like "*msedge.exe"
Ok ("usando " + $(if ($esEdge) { "Microsoft Edge" } else { "Google Chrome" }) + ": $exe")

# --- 2. Lanzador -----------------------------------------------------------
Titulo "Creando el lanzador"
New-Item -ItemType Directory -Force -Path $Carpeta | Out-Null
$perfil = Join-Path $Carpeta "perfil"

# Banderas comunes a Edge y Chrome:
#   --kiosk                      pantalla completa, sin barras ni pestañas
#   --user-data-dir              perfil propio: la sesion del CRM sobrevive al reinicio
#   --no-first-run / --no-default-browser-check  nada de asistentes en el arranque
#   --noerrdialogs               sin cuadros de error que tapen la pantalla
#   --disable-session-crashed-bubble / --hide-crash-restore-bubble
#                                si se corta la luz, al volver NO pregunta
#                                "restaurar paginas": entra derecho al CRM
#   --disable-pinch              que un roce en la pantalla tactil no cambie el zoom
#   --disable-features=TranslateUI  sin la barra de "traducir esta pagina"
$flags = @(
  "--kiosk"
  "--user-data-dir=`"$perfil`""
  "--no-first-run"
  "--no-default-browser-check"
  "--noerrdialogs"
  "--disable-session-crashed-bubble"
  "--hide-crash-restore-bubble"
  "--disable-pinch"
  "--disable-features=TranslateUI"
)
# Edge sin esto abre el kiosco en modo "navegación pública" (se reinicia solo
# cada tanto y borra la sesión): queremos la pantalla completa a secas.
if ($esEdge) { $flags += "--edge-kiosk-type=fullscreen" }
# El CRM imprime tickets: con esto el comprobante sale directo a la impresora
# por defecto, sin el cuadro de "Imprimir" que en un mostrador no atiende nadie.
if ($SinDialogoDeImpresion) { $flags += "--kiosk-printing" }

@"
@echo off
rem ---------------------------------------------------------------
rem Modo kiosco de easy pos. Lo crea configurar-kiosco.ps1.
rem CRM: $Url
rem Salir del kiosco: Alt+F4 (o Ctrl+Alt+Supr -> Administrador de tareas).
rem ---------------------------------------------------------------
start "" "$exe" $($flags -join ' ') "$Url"
"@ | Set-Content -Path $LANZADOR -Encoding ASCII
Ok "lanzador: $LANZADOR"

# --- 3. Arranque automatico -------------------------------------------------
Titulo "Dejandolo en el arranque de Windows"
$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut($ACCESO)
$lnk.TargetPath       = $LANZADOR
$lnk.WorkingDirectory = $Carpeta
$lnk.WindowStyle      = 7          # minimizado: la consola del .cmd no se ve
$lnk.Description      = "Abre el CRM de easy pos en pantalla completa"
$lnk.Save()
Ok "arranque: $ACCESO"

# --- 4. Listo ---------------------------------------------------------------
Write-Host "`nLISTO" -ForegroundColor Green
Write-Host "  CRM        : $Url"
Write-Host "  Navegador  : $exe"
Write-Host "  Perfil     : $perfil"
Write-Host "  Se abre solo al iniciar sesion en Windows."
Write-Host "  Para probarlo ahora, hace doble clic en:`n    $LANZADOR"
Write-Host "  Para salir del kiosco: Alt+F4."
Write-Host "  Para desarmarlo: .\configurar-kiosco.ps1 -Quitar`n"
Aviso "La primera vez hay que iniciar sesion en el CRM una sola vez; despues queda guardada."
