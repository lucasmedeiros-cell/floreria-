#!/usr/bin/env bash
# ============================================================
#  Reconstruye la base LOCAL como `easypos` y borra `floreria`.
#  Necesita el superusuario de Postgres, así que se corre con sudo:
#
#    sudo -u postgres bash db/local-easypos.sh
#
#  Deja easypos con dueño petrobox, aplica esquema + seed y elimina floreria.
#  Antes de correrlo ya se hizo un dump en backups/ (ver README).
# ============================================================
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "→ Rol y base easypos"
psql -v ON_ERROR_STOP=1 -f "${DIR}/bootstrap.sql"

echo "→ Esquema + seed (como petrobox, para que las tablas queden con ese dueño)"
{ echo "SET ROLE petrobox;"; cat "${DIR}/schema.sql"; } \
  | psql -v ON_ERROR_STOP=1 -d easypos
{ echo "SET ROLE petrobox;"; cat "${DIR}/seed.sql"; } \
  | psql -v ON_ERROR_STOP=1 -d easypos

echo "→ Borrando floreria (ya respaldada en backups/)"
psql -v ON_ERROR_STOP=1 -d postgres -c "DROP DATABASE IF EXISTS floreria;"

echo "✓ Local reconstruida: base easypos lista, floreria eliminada."
