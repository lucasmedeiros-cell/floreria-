@echo off
rem Exporta/respalda la base de datos de easy pos.
rem Doble clic y listo: deja los archivos en Documentos\easypos-exportaciones.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0exportar-base.ps1"
echo.
pause
