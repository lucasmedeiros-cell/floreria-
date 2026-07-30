#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Genera el INSTALADOR TODO-EN-UNO de "Auto Piezas Coquito" para Windows:
# un solo .exe que instala el programa de PC Y deja el servidor easy pos
# funcionando (PostgreSQL + base + Node portable + arranque automatico),
# SIN descargar nada en la PC del cliente.
#
# Requisitos en esta maquina (una vez):
#   desktop/servidor-bin/postgresql-16.*-windows-x64.exe   (instalador EDB)
#   desktop/servidor-bin/node-win-x64.zip                  (Node portable win)
#   desktop/servidor-nm-win/node_modules                   (deps de produccion
#       para Windows:  cd desktop/servidor-nm-win && cp ../../package*.json .
#       && npm ci --omit=dev --os=win32 --cpu=x64 --ignore-scripts)
#   Wine (para electron-builder; desktop/build-installer.sh lo instala)
#
# Uso:  bash scripts/empaquetar-instalador-todo-en-uno.sh
# Sale: desktop/dist/AutoPiezasCoquito-Setup-<version>.exe
# ---------------------------------------------------------------------------
set -e
cd "$(dirname "$0")/.."

BUILD_DIR=.next-coquito-pack
PAY=desktop/servidor-payload
BIN=desktop/servidor-bin
NM=desktop/servidor-nm-win/node_modules

PGEXE=$(ls "$BIN"/postgresql-*-windows-x64.exe 2>/dev/null | head -1 || true)
[ -n "$PGEXE" ] || { echo "ERROR: falta $BIN/postgresql-*-windows-x64.exe"; exit 1; }
[ -f "$BIN/node-win-x64.zip" ] || { echo "ERROR: falta $BIN/node-win-x64.zip"; exit 1; }
[ -d "$NM/next" ] || { echo "ERROR: faltan las dependencias Windows en $NM (ver cabecera)"; exit 1; }

echo "==> 1/3  Build de produccion del servidor..."
if [ ! -d "$BUILD_DIR" ]; then
  NEXT_DIST=$BUILD_DIR npx next build
else
  echo "    Reutilizando $BUILD_DIR (borralo para forzar rebuild)."
fi

echo "==> 2/3  Armando el paquete del servidor ($PAY)..."
rm -rf "$PAY"
mkdir -p "$PAY/db" "$PAY/runtime"

cp -r "$BUILD_DIR" "$PAY/.next"
rm -rf "$PAY/.next/cache"
cp package.json package-lock.json next.config.mjs "$PAY/"
cp db/schema.sql "$PAY/db/"
rsync -a --exclude 'images/17*' --exclude 'images/bc-*' public/ "$PAY/public/"
cp -r "$NM" "$PAY/node_modules"

# Node portable: solo hace falta node.exe (el servidor no usa npm).
TMPN=$(mktemp -d)
python3 -m zipfile -e "$BIN/node-win-x64.zip" "$TMPN"
find "$TMPN" -name node.exe -exec cp {} "$PAY/runtime/node.exe" \;
rm -rf "$TMPN"
[ -f "$PAY/runtime/node.exe" ] || { echo "ERROR: no se pudo extraer node.exe"; exit 1; }

cp "$PGEXE" "$PAY/"
cp scripts/coquito-windows/configurar-servidor.ps1 \
   scripts/coquito-windows/iniciar-servidor.bat \
   scripts/coquito-windows/semilla.sql \
   scripts/coquito-windows/exportar-base.ps1 \
   "scripts/coquito-windows/Exportar datos easy pos.bat" \
   "$PAY/"

cat > "$PAY/LEEME.txt" <<'EOF'
SERVIDOR EASY POS - AUTO PIEZAS COQUITO (paquete todo-en-uno)
=============================================================
Esta carpeta la instala automaticamente el instalador del programa
(AutoPiezasCoquito-Setup-*.exe): no hay que hacer nada a mano.

La copia de trabajo queda en C:\easypos-servidor. Ahi estan:
  - instalacion.log   que hizo la instalacion, paso a paso
  - servidor.log      la salida del servidor en funcionamiento
  - configurar-servidor.ps1   para re-ejecutar la configuracion:
      powershell -ExecutionPolicy Bypass -File C:\easypos-servidor\configurar-servidor.ps1

Acceso:  admin@coquito.local  /  Coquito-Wd3sV5A3
El servidor arranca solo al prender la PC (tarea "easypos-servidor").
Los celulares se conectan por la WiFi del local; la app lo encuentra sola.

EXPORTAR / RESPALDAR LOS DATOS
------------------------------
Doble clic en el acceso directo "Exportar datos easy pos" del escritorio
(o en C:\easypos-servidor\Exportar datos easy pos.bat). Deja en
Documentos\easypos-exportaciones una carpeta con fecha que contiene:
  - respaldo-completo.backup  para restaurar el sistema tal cual
  - respaldo-completo.sql     para llevar a cualquier PostgreSQL
  - productos/ventas/gastos/cortes/clientes/usuarios en .csv (Excel)
Conviene hacerlo seguido y guardar la carpeta en un pendrive.
EOF

cat > "$PAY/.env.local" <<EOF
# Servidor easy pos para "Auto Piezas Coquito" - base LOCAL, un solo negocio.
# Lo usa el programa de PC (localhost) y los celulares (http://<ip-pc>:3010).
# El puerto de la base lo ajusta configurar-servidor.ps1 segun la PC.
DATABASE_URL=postgresql://easypos:Coquito.2026.local@localhost:5432/bo_epos_coquito
AUTH_SECRET=$(openssl rand -hex 32)
TICKETS_API=https://tickets.petroboxinc.com/api
TICKETS_API_KEY=pbx_SYUxXsGVkUf2vRZB5Wiql_21utqx1cXTg7TKdLa1upE
TICKETS_PROJECT="Auto Piezas Coquito"

# QR de pago (petroconosur = RAICES27), igual que el server de referencia.
BAAS_USER='PETROBX_USER'
BAAS_PASS='21B70FA8-20A7-49E6-B2B8-3C31E57F4AAC'
QR_BUSINESS_CODE='0189'
QR_IDNODE='RAICES27'
EOF

du -sh "$PAY" | sed 's/^/    payload: /'

echo "==> 3/3  Construyendo el instalador (electron-builder + Wine)..."
cd desktop
[ -d node_modules ] || npm install
export CSC_IDENTITY_AUTO_DISCOVERY=false
npm run dist

echo
echo "===================================================================="
echo " LISTO. Instalador todo-en-uno:"
ls -1 dist/AutoPiezasCoquito-Setup-*.exe 2>/dev/null | sed 's/^/   /'
du -sh dist/AutoPiezasCoquito-Setup-*.exe 2>/dev/null | sed 's/^/   /'
echo " Un solo .exe: programa de PC + servidor completo, sin internet."
echo "===================================================================="
