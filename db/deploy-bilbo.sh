#!/usr/bin/env bash
# ============================================================
#  Despliega el esquema de easy pos a bilbo (por Tailscale).
#
#  bilbo escucha Postgres en el 5432 (no en 2002: ese puerto está cerrado).
#  La base `easypos` y el rol `petrobox` los crea db/bootstrap.sql, que corre
#  el superusuario del servidor.
#
#  Uso:
#    ./db/deploy-bilbo.sh
# ============================================================
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

HOST="${BILBO_HOST:-bilbo}"
PORT="${BILBO_PORT:-5432}"

echo "→ Verificando conectividad con ${HOST}:${PORT} …"
if ! PGCONNECT_TIMEOUT=8 pg_isready -h "$HOST" -p "$PORT" >/dev/null 2>&1; then
  echo "✗ ${HOST}:${PORT} no responde. Revisá Tailscale (tailscale status) y el firewall." >&2
  exit 1
fi

PGHOST="$HOST" PGPORT="$PORT" PGUSER=petrobox PGPASSWORD=petrobox PGDATABASE=easypos \
  "${DIR}/apply.sh"

echo "✓ Esquema de easy pos desplegado en ${HOST}:${PORT}/easypos"
