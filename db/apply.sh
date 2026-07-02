#!/usr/bin/env bash
# ============================================================
#  Aplica esquema + seed a una base de datos existente.
#  Variables (con valores por defecto para desarrollo local):
#    PGHOST=localhost PGPORT=5432 PGUSER=petrobox PGPASSWORD=petrobox PGDATABASE=floreria
#
#  Ejemplos:
#    # Local
#    ./db/apply.sh
#    # bilbo (producción)
#    PGHOST=bilbo PGPORT=2002 ./db/apply.sh
# ============================================================
set -euo pipefail

export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-petrobox}"
export PGPASSWORD="${PGPASSWORD:-petrobox}"
export PGDATABASE="${PGDATABASE:-floreria}"
export PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-8}"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "→ Aplicando esquema a ${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}"
psql -v ON_ERROR_STOP=1 -f "${DIR}/schema.sql"
echo "→ Cargando datos iniciales (seed)"
psql -v ON_ERROR_STOP=1 -f "${DIR}/seed.sql"
echo "✓ Listo."
