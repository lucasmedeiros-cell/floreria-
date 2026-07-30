#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Servidor easy pos de "Auto Piezas Coquito".
#
#   · Base de datos LOCAL (PostgreSQL: bo_epos_coquito), modo un solo negocio.
#   · Puerto 3010, escuchando en 0.0.0.0 → el programa de PC entra por
#     http://localhost:3010 y los CELULARES por http://<ip-de-esta-pc>:3010.
#
# Uso:  bash scripts/coquito-server.sh
# ---------------------------------------------------------------------------
set -e
cd "$(dirname "$0")/.."

# Carga DATABASE_URL (→ bo_epos_coquito) y AUTH_SECRET del entorno Coquito.
# Se exportan ANTES de arrancar: Next no pisa una variable ya presente, así que
# esto gana sobre el .env.local de desarrollo.
set -a
. ./.env.coquito.local
set +a

export NEXT_DIST=.next-coquito
echo "easy pos · Auto Piezas Coquito → http://0.0.0.0:3010  (base: bo_epos_coquito)"
exec npx next start -H 0.0.0.0 -p 3010
