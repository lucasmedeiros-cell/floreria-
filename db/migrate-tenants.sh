#!/usr/bin/env bash
# ============================================================
#  Aplica el esquema + las migraciones a TODAS las bases de los negocios.
#
#  Con una base por negocio, una migración no es un `psql` y listo: hay que
#  correrla en cada comercio activo, o la app queda pidiéndole a una base vieja
#  una columna que no tiene. Este script recorre los negocios de easy pos que
#  están en la central (bo_sole_central.negocio, producto='easypos') y les aplica
#  schema.sql + db/migrations/*.sql, que son idempotentes.
#
#  Correr DESPUÉS de agregar una migración y ANTES de desplegar el código que la
#  necesita (primero la base, después la app: al revés se rompe).
#
#  Variables:
#    CENTRAL_DATABASE_URL   base central de Case (obligatoria)
#    PGHOST/PGPORT/PGUSER/PGPASSWORD   servidor donde viven las bases
#    DRY_RUN=1              solo lista los negocios, no toca nada
#
#  Ejemplo:
#    CENTRAL_DATABASE_URL=postgresql://postgres:xxx@bilbo:5432/bo_sole_central \
#    PGHOST=bilbo PGUSER=postgres PGPASSWORD=xxx ./db/migrate-tenants.sh
# ============================================================
set -euo pipefail

: "${CENTRAL_DATABASE_URL:?Falta CENTRAL_DATABASE_URL (la base central de Case)}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DRY_RUN="${DRY_RUN:-0}"

BASES="$(psql "$CENTRAL_DATABASE_URL" -tAc \
  "SELECT db_name FROM negocio WHERE producto='easypos' AND estado <> 'baja' ORDER BY nombre")"

if [ -z "$BASES" ]; then
  echo "No hay negocios de easy pos en la central. Nada que migrar."
  exit 0
fi

echo "Negocios a migrar:"
echo "$BASES" | sed 's/^/  · /'
[ "$DRY_RUN" = "1" ] && { echo "(DRY_RUN=1: no se tocó nada)"; exit 0; }
echo

fallidas=0
for db in $BASES; do
  echo "→ $db"
  if ! psql -v ON_ERROR_STOP=1 -d "$db" -f "$DIR/schema.sql" >/dev/null 2>&1; then
    echo "  ✗ falló schema.sql"; fallidas=$((fallidas + 1)); continue
  fi
  for m in "$DIR"/migrations/*.sql; do
    [ -e "$m" ] || continue
    if ! psql -v ON_ERROR_STOP=1 -d "$db" -f "$m" >/dev/null 2>&1; then
      echo "  ✗ falló $(basename "$m")"; fallidas=$((fallidas + 1))
    fi
  done
  echo "  ✓ al día"
done

echo
if [ "$fallidas" -gt 0 ]; then
  echo "✗ $fallidas paso(s) fallaron. Revisá antes de desplegar la app." >&2
  exit 1
fi
echo "✓ Todas las bases al día."
