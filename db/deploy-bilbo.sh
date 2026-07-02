#!/usr/bin/env bash
# ============================================================
#  Despliega la base de datos a bilbo (Tailscale) puerto 2002.
#  Requiere que el rol 'petrobox' y la base 'floreria' ya existan
#  en bilbo (ver db/bootstrap.sql, que corre el admin del servidor).
#
#  Uso:
#    ./db/deploy-bilbo.sh
# ============================================================
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "→ Verificando conectividad con bilbo:2002 …"
if ! PGCONNECT_TIMEOUT=6 pg_isready -h bilbo -p 2002 >/dev/null 2>&1; then
  echo "✗ bilbo:2002 no responde. Revisa Tailscale / firewall / que Postgres escuche en 2002." >&2
  exit 1
fi

PGHOST=bilbo PGPORT=2002 PGUSER=petrobox PGPASSWORD=petrobox PGDATABASE=floreria \
  "${DIR}/apply.sh"

echo "✓ Base desplegada en bilbo:2002/floreria"
