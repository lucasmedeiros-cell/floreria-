#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Empaqueta el SERVIDOR easy pos de "Auto Piezas Coquito" para instalarlo en
# una PC con Windows (la del cliente). Genera un ZIP con:
#
#   · el build de produccion de Next (carpeta .next, ya compilada aca)
#   · package.json / package-lock.json / next.config.mjs / public/
#   · db/schema.sql + semilla.sql (crean la base con el admin inicial)
#   · instalar.ps1 / iniciar-servidor.bat / LEEME.txt (scripts de Windows)
#   · .env.local con un AUTH_SECRET nuevo
#
# NO incluye node_modules: en la PC del cliente `instalar.ps1` corre
# `npm ci --omit=dev` (necesita internet solo esa vez).
#
# Uso:  bash scripts/empaquetar-servidor-coquito.sh
# Sale: dist-coquito/easypos-servidor-coquito-<fecha>.zip
# ---------------------------------------------------------------------------
set -e
cd "$(dirname "$0")/.."

BUILD_DIR=.next-coquito-pack       # aparte, para no tocar el server que corre
STAGE=dist-coquito/easypos-servidor

echo "==> 1/4  Compilando build de produccion ($BUILD_DIR)..."
NEXT_DIST=$BUILD_DIR npx next build

echo "==> 2/4  Armando carpeta del paquete..."
rm -rf dist-coquito
mkdir -p "$STAGE/db" "$STAGE/public"

# El build viaja con su nombre por defecto (.next): en la PC del cliente no
# hace falta configurar NEXT_DIST.
cp -r "$BUILD_DIR" "$STAGE/.next"
rm -rf "$STAGE/.next/cache"        # cache de compilacion: no hace falta para `next start`

cp package.json package-lock.json next.config.mjs "$STAGE/"
cp db/schema.sql "$STAGE/db/"

# public/ sin las fotos subidas durante pruebas (nombres con timestamp).
rsync -a --exclude 'images/17*' --exclude 'images/bc-*' public/ "$STAGE/public/"

cp scripts/coquito-windows/instalar.ps1 \
   scripts/coquito-windows/iniciar-servidor.bat \
   scripts/coquito-windows/semilla.sql \
   scripts/coquito-windows/LEEME.txt \
   scripts/coquito-windows/exportar-base.ps1 \
   "scripts/coquito-windows/Exportar datos easy pos.bat" \
   "$STAGE/"

echo "==> 3/4  Escribiendo .env.local (AUTH_SECRET nuevo)..."
cat > "$STAGE/.env.local" <<EOF
# Servidor easy pos para "Auto Piezas Coquito" - base LOCAL, un solo negocio.
# Lo usa el programa de PC (localhost) y los celulares (http://<ip-pc>:3010).
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

echo "==> 4/4  Comprimiendo..."
ZIP="easypos-servidor-coquito-$(date +%Y%m%d).zip"
if command -v zip >/dev/null 2>&1; then
  (cd dist-coquito && zip -rq "$ZIP" easypos-servidor)
else
  (cd dist-coquito && python3 -m zipfile -c "$ZIP" easypos-servidor)
fi

echo
echo "===================================================================="
echo " LISTO:  dist-coquito/$ZIP"
du -sh "dist-coquito/$ZIP" | sed 's/^/   /'
echo " Copiarlo a la PC del cliente (USB o Drive), descomprimir en"
echo " C:\\easypos-servidor y correr instalar.ps1 como administrador."
echo " Detalle completo: docs/INSTALAR-servidor-coquito-windows.md"
echo "===================================================================="
