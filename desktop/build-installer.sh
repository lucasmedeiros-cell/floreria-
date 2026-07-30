#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Genera el INSTALADOR de Windows (Auto Piezas Coquito) desde Linux.
#
# electron-builder necesita Wine para incrustar el ícono/metadatos en el .exe
# y armar el instalador NSIS. Este script instala Wine si falta (pide tu
# contraseña una sola vez) y luego construye el instalador.
#
# Uso:   bash desktop/build-installer.sh
#        (o desde la terminal de Claude Code:  ! bash desktop/build-installer.sh)
# ---------------------------------------------------------------------------
set -e
cd "$(dirname "$0")"

echo "==> 1/3  Verificando Wine…"
if ! command -v wine >/dev/null 2>&1; then
  echo "    Wine no está. Instalando (se te pedirá la contraseña de sudo)…"
  sudo dpkg --add-architecture i386
  sudo apt-get update
  sudo apt-get install -y wine
else
  echo "    Wine ya presente: $(wine --version 2>/dev/null || echo '?')"
fi

echo "==> 2/3  Dependencias del programa…"
[ -d node_modules ] || npm install

echo "==> 3/3  Construyendo el instalador NSIS…"
export CSC_IDENTITY_AUTO_DISCOVERY=false   # sin firma de código (no hace falta)
npm run dist

echo
echo "===================================================================="
echo " LISTO. Instalador en:"
ls -1 dist/*.exe 2>/dev/null | sed 's/^/   /' || echo "   (no se encontró el .exe — revisá el log de arriba)"
echo "===================================================================="
