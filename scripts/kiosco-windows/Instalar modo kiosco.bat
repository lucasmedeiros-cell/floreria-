@echo off
rem ---------------------------------------------------------------
rem Modo kiosco de easy pos: la PC arranca directo en el CRM, a
rem pantalla completa y sin barras del navegador.
rem
rem Hace doble clic en este archivo, en la PC del mostrador, con el
rem usuario de Windows que va a atender. NO necesita administrador.
rem
rem Lo unico que hace es llamar a configurar-kiosco.ps1 (al lado).
rem ---------------------------------------------------------------
cd /d "%~dp0"
echo.
echo   Configurando el modo kiosco de easy pos...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0configurar-kiosco.ps1"
echo.
pause
