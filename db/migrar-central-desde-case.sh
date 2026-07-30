#!/usr/bin/env bash
# ============================================================
#  Copia los negocios easy pos (y sus dispositivos) desde la central de Case
#  (`bo_case_central`) a la central PROPIA (`bo_epos_central`).
#
#  - A Case SOLO lo lee: no borra ni modifica nada ahí.
#  - Idempotente (ON CONFLICT DO NOTHING): se puede correr las veces que haga
#    falta. La última corrida conviene hacerla justo antes de apuntar
#    CENTRAL_DATABASE_URL a la central nueva, para arrastrar los pareos que se
#    hayan hecho mientras tanto.
#
#  Uso:
#    CASE_URL=postgresql://usuario:clave@host:5432/bo_case_central \
#    CENTRAL_URL=postgresql://usuario:clave@host:5432/bo_epos_central \
#      ./db/migrar-central-desde-case.sh
# ============================================================
set -euo pipefail

: "${CASE_URL:?Falta CASE_URL (la central de Case, solo lectura)}"
: "${CENTRAL_URL:?Falta CENTRAL_URL (la central propia de easy pos)}"

NEG_COLS="id, nombre, slug, db_name, rubro, nit, telefono, email, direccion, ciudad, estado, fecha_alta"
DIS_COLS="id, negocio_id, token, label, habilitado, last_seen, fecha_alta, plataforma, modelo, os_version, app_version, device_name, ultimo_ip"

echo "→ Copiando negocios easy pos de Case a la central propia…"
{
  echo "CREATE TEMP TABLE _neg AS SELECT ${NEG_COLS} FROM negocio WITH NO DATA;"
  echo "\\copy _neg (${NEG_COLS}) FROM STDIN"
  psql "$CASE_URL" -c "\\copy (SELECT ${NEG_COLS} FROM negocio WHERE producto = 'easypos') TO STDOUT"
  echo "\\."
  echo "INSERT INTO negocio (${NEG_COLS}) SELECT ${NEG_COLS} FROM _neg ON CONFLICT (id) DO NOTHING;"
} | psql -v ON_ERROR_STOP=1 "$CENTRAL_URL" >/dev/null

echo "→ Copiando dispositivos de esos negocios…"
{
  echo "CREATE TEMP TABLE _dis AS SELECT ${DIS_COLS} FROM dispositivo WITH NO DATA;"
  echo "\\copy _dis (${DIS_COLS}) FROM STDIN"
  psql "$CASE_URL" -c "\\copy (SELECT ${DIS_COLS} FROM dispositivo WHERE negocio_id IN (SELECT id FROM negocio WHERE producto = 'easypos')) TO STDOUT"
  echo "\\."
  echo "INSERT INTO dispositivo (${DIS_COLS}) SELECT ${DIS_COLS} FROM _dis ON CONFLICT (id) DO NOTHING;"
} | psql -v ON_ERROR_STOP=1 "$CENTRAL_URL" >/dev/null

psql "$CENTRAL_URL" -Atc \
  "SELECT '✓ Central propia: ' || (SELECT count(*) FROM negocio) || ' negocios, ' || (SELECT count(*) FROM dispositivo) || ' dispositivos.'"
