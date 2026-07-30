@echo off
rem ---------------------------------------------------------------
rem Arranca el servidor easy pos (Auto Piezas Coquito) en esta PC.
rem Lo usa la tarea programada "easypos-servidor" al prender Windows;
rem tambien se puede hacer doble clic para arrancarlo a mano.
rem La salida queda en servidor.log (al lado de este archivo).
rem
rem Node: primero el runtime\node.exe del propio paquete (no depende
rem de que la PC tenga Node instalado); si no esta, el del sistema.
rem ---------------------------------------------------------------
cd /d "%~dp0"

set "NODE_EXE=%~dp0runtime\node.exe"
if not exist "%NODE_EXE%" (
  set "NODE_EXE=node"
  where node >nul 2>nul || set "NODE_EXE=C:\Program Files\nodejs\node.exe"
)

echo [%date% %time%] iniciando servidor easy pos en puerto 3010 >> servidor.log
"%NODE_EXE%" node_modules\next\dist\bin\next start -H 0.0.0.0 -p 3010 >> servidor.log 2>&1
