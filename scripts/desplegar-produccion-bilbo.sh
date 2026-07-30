#!/usr/bin/env bash
# ============================================================
#  Deja easy pos funcional en bilbo: código nuevo + panel + central PROPIA
#  (bo_epos_central) + nginx (easypos.easypaybo.com) + HTTPS.
#
#  CORRER ESTE SCRIPT **EN bilbo** (no en tu PC), con sudo disponible:
#      sudo bash scripts/desplegar-produccion-bilbo.sh
#
#  Es idempotente: se puede correr las veces que haga falta. Cada paso avisa
#  qué hace y no pisa secretos que ya existan (AUTH_SECRET, credenciales).
#
#  Ajustá las VARIABLES de abajo si tu instalación difiere.
# ============================================================
set -euo pipefail

# ---------- Variables (ajustar si hace falta) ----------
APP_DIR="${APP_DIR:-/opt/easypos}"          # dónde está el código en bilbo
BRANCH="${BRANCH:-main}"                     # rama que se despliega
PORT="${PORT:-3090}"                          # puerto interno de la app
DOMAIN="${DOMAIN:-easypos.easypaybo.com}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-desarrolloia@petroboxinc.com}"
# Base de la central propia y de Case (para arrastrar pareos nuevos). La
# credencial/host se toman del CENTRAL_DATABASE_URL que ya tenga el .env.
CENTRAL_DB="${CENTRAL_DB:-bo_epos_central}"
CASE_DB="${CASE_DB:-bo_case_central}"

say() { printf '\n\033[1;33m→ %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ -d "$APP_DIR/.git" ] || die "No encuentro el repo en $APP_DIR. Ajustá APP_DIR."
cd "$APP_DIR"

# ---------- 1. Código ----------
say "Trayendo el código nuevo (rama $BRANCH)…"
git fetch --all --prune
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH" || die "El pull no fue fast-forward. Resolvé el estado del repo en bilbo a mano."

say "Instalando dependencias (npm ci)…"
npm ci

# ---------- 2. .env: apuntar a la central PROPIA ----------
ENV_FILE="$APP_DIR/.env.production"
[ -f "$ENV_FILE" ] || ENV_FILE="$APP_DIR/.env.local"
[ -f "$ENV_FILE" ] || die "No encuentro .env.production ni .env.local en $APP_DIR."
say "Configurando $ENV_FILE (central → $CENTRAL_DB)…"
cp "$ENV_FILE" "$ENV_FILE.bak.$(date +%s)"

if grep -q '^CENTRAL_DATABASE_URL=' "$ENV_FILE"; then
  # Reapunta la base al final de la URL, conservando usuario/clave/host/puerto.
  sed -i -E "s#(^CENTRAL_DATABASE_URL=.*/)[A-Za-z0-9_]+(\??.*)?\$#\1${CENTRAL_DB}\2#" "$ENV_FILE"
else
  # No estaba: derivo de DATABASE_URL (mismo Postgres) cambiando la base.
  base_url="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
  [ -n "$base_url" ] || die "No hay DATABASE_URL para derivar la central. Agregá CENTRAL_DATABASE_URL a mano."
  central_url="$(echo "$base_url" | sed -E "s#/[A-Za-z0-9_]+(\??.*)?\$#/${CENTRAL_DB}#")"
  printf '\nCENTRAL_DATABASE_URL=%s\n' "$central_url" >> "$ENV_FILE"
fi
grep -q '^TENANT_DATABASE_URL_TEMPLATE=' "$ENV_FILE" || {
  tpl="$(grep -E '^CENTRAL_DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | sed -E "s#/[A-Za-z0-9_]+(\??.*)?\$#/{db}#")"
  printf 'TENANT_DATABASE_URL_TEMPLATE=%s\n' "$tpl" >> "$ENV_FILE"
}
CENTRAL_URL="$(grep -E '^CENTRAL_DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
echo "   CENTRAL_DATABASE_URL → …/$CENTRAL_DB"

# ---------- 3. Arrastrar pareos nuevos que hayan quedado en Case ----------
if psql "$CENTRAL_URL" -tAc 'select 1' >/dev/null 2>&1; then
  CASE_URL="$(echo "$CENTRAL_URL" | sed -E "s#/${CENTRAL_DB}(\??.*)?\$#/${CASE_DB}#")"
  if psql "$CASE_URL" -tAc 'select 1' >/dev/null 2>&1; then
    say "Sincronizando negocios/dispositivos desde Case (por si hubo pareos nuevos)…"
    CASE_URL="$CASE_URL" CENTRAL_URL="$CENTRAL_URL" bash "$APP_DIR/db/migrar-central-desde-case.sh" || \
      echo "   (aviso: la sync desde Case falló; seguí, la central ya tiene lo migrado el 2026-07-22)"
  fi
else
  die "No puedo conectar a la central ($CENTRAL_DB). Revisá credenciales y pg_hba."
fi

# ---------- 4. Build ----------
say "Compilando (npm run build)…"
npm run build

# ---------- 5. Reiniciar la app ----------
if command -v pm2 >/dev/null 2>&1 && pm2 describe easypos >/dev/null 2>&1; then
  say "Reiniciando con pm2 (proceso 'easypos')…"; pm2 restart easypos --update-env
elif command -v pm2 >/dev/null 2>&1 && pm2 list 2>/dev/null | grep -q online; then
  say "pm2 detectado pero sin proceso 'easypos'. Reiniciando TODO pm2…"; pm2 restart all --update-env
elif systemctl list-unit-files 2>/dev/null | grep -q '^easypos.service'; then
  say "Reiniciando con systemd (easypos.service)…"; systemctl restart easypos
else
  echo "   ⚠ No detecté pm2('easypos') ni easypos.service. Reiniciá la app a mano (puerto $PORT)."
fi

# ---------- 6. nginx + HTTPS ----------
say "Configurando nginx para $DOMAIN…"
install -m 0644 "$APP_DIR/deploy/easypos.easypaybo.com.conf" "/etc/nginx/sites-available/$DOMAIN.conf"
ln -sf "/etc/nginx/sites-available/$DOMAIN.conf" "/etc/nginx/sites-enabled/$DOMAIN.conf"
nginx -t && systemctl reload nginx

if command -v certbot >/dev/null 2>&1; then
  say "Emitiendo/renovando certificado HTTPS…"
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$CERTBOT_EMAIL" --redirect || \
    echo "   ⚠ certbot falló. Revisá que el DNS de $DOMAIN → esta IP y volvé a correr: certbot --nginx -d $DOMAIN"
else
  echo "   ⚠ certbot no está instalado. Instalalo (apt install certbot python3-certbot-nginx) y corré: certbot --nginx -d $DOMAIN"
fi

# ---------- 7. Prueba de humo ----------
say "Prueba de humo…"
sleep 3
code_local="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/panel" || true)"
echo "   app local /panel: $code_local (200 = ok)"
code_pub="$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN/api/business" || true)"
echo "   https://$DOMAIN/api/business: $code_pub (200/401 = ok, ya con HTTPS)"

printf '\n\033[1;32m✓ Despliegue terminado. Panel: https://%s/panel\033[0m\n' "$DOMAIN"
