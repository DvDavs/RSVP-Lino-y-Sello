#!/usr/bin/env bash
# evidencia/fase-4/0a/registrar-http.sh — registra UN paquete de plantilla por la ruta HTTP real
# `POST /master/templates2/versions` (ADR-033, `contratos.md §4`) con un JWT MASTER, y muestra el
# cuerpo completo de la respuesta.
#
# Existe porque `scripts/dev-backend.sh register` es el camino de LÍNEA DE COMANDOS y exige el
# backend PARADO (`scripts/dev-backend.sh:262-266`), así que no sirve para demostrar idempotencia
# contra una instancia viva ni para el uso normal de la fase 4. Este ayudante es el camino HTTP: no
# toca Kotlin, no reinicia nada (P4).
#
#   source build/dev/env-4-0a.sh
#   docs/rediseno-plantillas/evidencia/fase-4/0a/registrar-http.sh frontend/templates/xv-jardin/1.0.0
#
# La cuenta MASTER es la que siembra `scripts/seed-demo.sh` (demo.master@example.com / Demo1234!);
# si no existe todavía, este script la crea por `/auth/signup` y la promueve por SQL, exactamente
# igual y por el mismo motivo que `seed-demo.sh:96` (no hay ruta HTTP para crear un MASTER inicial).
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../../.." && pwd)"
cd "$RAIZ"
PKG="${1:?uso: registrar-http.sh <dir frontend/templates/<slug>/<version>>}"
BASE="${TPL_DEV_BASE:-http://127.0.0.1:6003}"
PGBIN="${TPL_TEST_PGBIN:-/usr/lib/postgresql/16/bin}"
ESTADO="${TPL_TEST_STATE_DIR:-/tmp/templates2-pg}/state.env"
DB="${TPL_DEV_DB:-invitaciones_dev}"
EMAIL="${TPL_MASTER_EMAIL:-demo.master@example.com}"
PASS="${TPL_MASTER_PASS:-Demo1234!}"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

PGPORT_DEV="$( . "$ESTADO"; echo "$TPL_TEST_PGPORT" )"
sql() { "$PGBIN/psql" -h 127.0.0.1 -p "$PGPORT_DEV" -U postgres -d "$DB" -v ON_ERROR_STOP=1 -Atqc "$1"; }

curl -sS -o /dev/null -X POST "$BASE/auth/signup" -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg e "$EMAIL" --arg p "$PASS" \
    '{name:"Master",lastName:"Demo",email:$e,phone:"+525512347002",birthdate:null,address:null,city:null,postalCode:null,state:null,howKnow:null,password:$p}')"
sql "UPDATE customer SET role = 'MASTER' WHERE email = '$EMAIL';" >/dev/null
TOKEN="$(curl -sS -X POST "$BASE/auth/token" -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg e "$EMAIL" --arg p "$PASS" '{email:$e,password:$p}')" | jq -r '.accessToken')"
[ -n "$TOKEN" ] && [ "$TOKEN" != null ] || { echo "registrar-http: sin JWT MASTER" >&2; exit 1; }

# Los assets se mandan TODOS los que declara el manifiesto, leídos de `template.json` con jq y nunca
# a mano: mandar de menos da `422 TPL_PACKAGE_ASSET_MISMATCH` (`scripts/smoke.sh:245-249`).
ASSET_ARGS=()
while IFS= read -r a; do ASSET_ARGS+=(-F "$a=@$PKG/$a"); done < <(jq -r '.assets[].path' "$PKG/template.json")
# `migrations/` viaja como una parte más, con el nombre de fichero derivado `<from>-to-<version>.json`
# (`01 §2.1`); el manifiesto lo exige una por cada `migrationsFrom` (`TemplatePackageParser.kt:230`).
MIG_ARGS=()
if [ -d "$PKG/migrations" ]; then
  for m in "$PKG"/migrations/*.json; do
    [ -e "$m" ] || continue
    MIG_ARGS+=(-F "migrations/$(basename "$m")=@$m")
  done
fi

CODIGO="$(curl -sS -o "$TMP/r.json" -w '%{http_code}' -X POST "$BASE/master/templates2/versions" \
  -H "Authorization: Bearer $TOKEN" \
  -F "template=@$PKG/template.json" -F "theme=@$PKG/theme.json" -F "defaults=@$PKG/defaults.json" \
  "${ASSET_ARGS[@]}" ${MIG_ARGS[@]+"${MIG_ARGS[@]}"})"
echo "POST /master/templates2/versions  ($PKG)  →  HTTP $CODIGO"
jq . < "$TMP/r.json"
case "$CODIGO" in 2*) exit 0 ;; *) exit 1 ;; esac
