#!/usr/bin/env bash
# scripts/smoke.sh — recorre LAS 19 RUTAS de `handoffs/2-5.md` contra un Tomcat REAL.
#
# Es la primera vez en todo el proyecto que estas rutas responden de verdad: hasta el bloque 3-0a la
# aplicación completa no arrancaba (ADR-2-ORQ-02) y las pruebas de contrato corrían sobre contextos
# Spring acotados. Cualquier discrepancia que este script encuentre es un defecto real.
#
#   scripts/dev-backend.sh start
#   scripts/smoke.sh | tee docs/rediseno-plantillas/evidencia/fase-3/bloque-0/smoke.txt
#
# Sale con 1 si alguna ruta no devuelve el código esperado. Imprime "N/19 OK" al final.
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"
BASE="${TPL_DEV_BASE:-http://127.0.0.1:6003}"
PGBIN="${TPL_TEST_PGBIN:-/usr/lib/postgresql/16/bin}"
ESTADO="${TPL_TEST_STATE_DIR:-/tmp/templates2-pg}/state.env"
DB="${TPL_DEV_DB:-invitaciones_dev}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ ! -f "$ESTADO" ]; then
  echo "smoke: no encuentro el clúster efímero ($ESTADO). Arranca antes: scripts/dev-backend.sh start" >&2
  exit 2
fi
# shellcheck disable=SC1090
PGPORT_DEV="$( . "$ESTADO"; echo "$TPL_TEST_PGPORT" )"
sql() { "$PGBIN/psql" -h 127.0.0.1 -p "$PGPORT_DEV" -U postgres -d "$DB" -v ON_ERROR_STOP=1 -Atqc "$1"; }

OK=0; FALLOS=0; TOTAL=0
CUERPO="$TMP/body"; CABECERAS="$TMP/head"

# Ejecuta una llamada y compara el código HTTP. `$1` etiqueta (n. de ruta), `$2` método, `$3` ruta,
# `$4` código esperado (o varios separados por "|"), el resto se pasa tal cual a curl.
llamar() {
  local etiqueta="$1" metodo="$2" ruta="$3" esperado="$4"; shift 4
  TOTAL=$((TOTAL + 1))
  local codigo
  codigo="$(curl -sS -o "$CUERPO" -D "$CABECERAS" -w '%{http_code}' -X "$metodo" "$BASE$ruta" "$@" 2>"$TMP/err")"
  if [[ "|$esperado|" == *"|$codigo|"* ]]; then
    printf '  [OK ] %-4s %-6s %-58s esperado %-7s obtenido %s\n' "$etiqueta" "$metodo" "$ruta" "$esperado" "$codigo"
    OK=$((OK + 1))
    return 0
  fi
  printf '  [FAIL] %-3s %-6s %-58s esperado %-7s obtenido %s\n' "$etiqueta" "$metodo" "$ruta" "$esperado" "$codigo"
  echo "         cuerpo: $(head -c 500 "$CUERPO")"
  FALLOS=$((FALLOS + 1))
  return 1
}

jqv() { jq -r "$1" < "$CUERPO"; }

echo "=============================================================================="
echo " smoke templates2 — 19 rutas sobre Tomcat real"
echo " base: $BASE   postgres: 127.0.0.1:$PGPORT_DEV/$DB   $(date -u +%FT%TZ)"
echo "=============================================================================="

# --------------------------------------------------------------------------- 1. JWT por el camino real
# `POST /auth/signup` (`/auth/**` es permitAll, `SecurityConfig.kt:35`) y, si el correo ya existía,
# `POST /auth/token`. No se firma ningún JWT a mano: se usa el emisor del propio backend.
EMAIL_USER="smoke.user@example.com"
EMAIL_MASTER="smoke.master@example.com"
PASS='Smoke1234!'

# `Patterns.PHONE_NUMBER_PATTERN` es `^\+52\d{10}$` y `ALPHABETIC_SPECIAL_CHARACTERS` no admite
# dígitos: los datos de prueba tienen que cumplirlo o `/auth/signup` responde 400.
registrar_o_entrar() {
  local email="$1" nombre="$2" tel="$3"
  local r
  r="$(curl -sS -o "$TMP/auth" -w '%{http_code}' -X POST "$BASE/auth/signup" \
        -H 'Content-Type: application/json' -d "$(jq -nc --arg e "$email" --arg n "$nombre" --arg t "$tel" --arg p "$PASS" \
        '{name:$n,lastName:"Smoke",email:$e,phone:$t,birthdate:null,address:null,city:null,postalCode:null,state:null,howKnow:null,password:$p}')")"
  if [ "$r" != "200" ]; then
    curl -sS -o "$TMP/auth" -X POST "$BASE/auth/token" -H 'Content-Type: application/json' \
      -d "$(jq -nc --arg e "$email" --arg p "$PASS" '{email:$e,password:$p}')" >/dev/null
  fi
  jq -r '.accessToken' < "$TMP/auth"
}

echo
echo "-- Preparación --------------------------------------------------------------"
TOKEN_USER="$(registrar_o_entrar "$EMAIL_USER" "Smoke" "+525512340001")"
registrar_o_entrar "$EMAIL_MASTER" "Master" "+525512340002" >/dev/null
# El rol MASTER no se puede pedir por `/auth/signup` (siempre crea `USER`, `CustomerService.kt:81`) y
# la ruta que crea administradores exige ya ser MASTER: se promueve por SQL. Es la única vía en un
# entorno recién creado, y queda dicho aquí con todas las letras.
sql "UPDATE customer SET role = 'MASTER' WHERE email = '$EMAIL_MASTER';" >/dev/null
curl -sS -o "$TMP/auth" -X POST "$BASE/auth/token" -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg e "$EMAIL_MASTER" --arg p "$PASS" '{email:$e,password:$p}')" >/dev/null
TOKEN_MASTER="$(jq -r '.accessToken' < "$TMP/auth")"
CUSTOMER_ID="$(sql "SELECT id FROM customer WHERE email = '$EMAIL_USER';")"
echo "  customer USER id=$CUSTOMER_ID (JWT por POST /auth/token), customer MASTER promovido por SQL"

if [ -z "$TOKEN_USER" ] || [ "$TOKEN_USER" = "null" ]; then
  echo "smoke: no pude obtener un JWT de USER. Cuerpo: $(cat "$TMP/auth")" >&2; exit 1
fi

# --------------------------------------------------------- 2. Invitación de prueba, uses_templates2
# `uses_templates2` NO tiene ruta HTTP que la active: `templates2` no crea invitaciones (eso es del
# módulo antiguo, área prohibida) y la sonda de Mongo responde "no lo sé" por defecto, así que sin la
# bandera toda edición sale `409 TPL_NOT_MIGRATED` (ADR-2-4-02). Se inserta por SQL, que hoy es el
# único camino posible. `template_id = 6` es "XV Años Elegance Premium" (event_type "Quince años",
# plan premium ⇒ planTier 2), compatible con `xv-jardin@1.0.0` (minPlanTier 1).
# Se rellenan TODAS las columnas booleanas y `total_amount`: en `invitation` son NULLABLE, pero
# `InvitationEntity` las mapea a tipos primitivos de Kotlin (`InvitationEntity.kt:34-75`), así que un
# NULL en cualquiera de ellas rompe la lectura con `JpaSystemException` → `500 TPL_INTERNAL`. Es un
# desajuste preexistente y AJENO al módulo (ver bitacora/3-0a.md); aquí sólo se evita.
INVITACION="$(sql "INSERT INTO invitation (customer_id, template_id, is_enabled, is_paid, is_finished,
    all_events_same_location, uses_templates2, date, time, hashtag, cover_photo_url,
    children_allowed, young_allowed, has_music, has_gallery, has_extra_modules, total_amount,
    created_at, updated_at)
  VALUES ($CUSTOMER_ID, 6, true, true, false, false, true, '2027-05-15', '18:00', '#SmokeXV2027', '',
    true, true, false, false, false, 0,
    now(), now()) RETURNING id;")"
echo "  invitación id=$INVITACION (template_id=6, uses_templates2=true) creada por SQL"

AUTH_U=(-H "Authorization: Bearer $TOKEN_USER")
AUTH_M=(-H "Authorization: Bearer $TOKEN_MASTER")
JSON=(-H 'Content-Type: application/json')
IID="/editor/invitations/$INVITACION"

echo
echo "-- Las 19 rutas -------------------------------------------------------------"

# 1 --------------------------------------------------------------------------------------------
llamar "1" GET "/editor/templates2/catalog" 200 "${AUTH_U[@]}"
CATALOGO="$(jqv '[.items[].slug] | sort | join(",")' 2>/dev/null || echo '?')"
echo "         catálogo = [$CATALOGO]"
if [ "$CATALOGO" != "boda-clasica,xv-jardin" ]; then
  echo "  [AVISO] el catálogo no trae exactamente las dos plantillas registradas"
fi

# 2 --------------------------------------------------------------------------------------------
llamar "2" POST "$IID/document:choose-template" 201 "${AUTH_U[@]}" "${JSON[@]}" \
  -d '{"templateSlug":"xv-jardin","templateVersion":"1.0.0"}'
REV="$(jqv '.revision')"; TOKEN_PUB="$(jqv '.publicToken')"
echo "         revision=$REV publicToken=$TOKEN_PUB"

# 3 --------------------------------------------------------------------------------------------
llamar "3" GET "$IID/document" 200 "${AUTH_U[@]}"

# 7 --- se adelanta: el lote de operaciones necesita un assetId real ---------------------------
# WebP, no PNG: ADR-3-2d-02 pasó toda la imaginería de los paquetes a `.webp` y los `.png` dejaron de
# existir. Mientras esto decía `preview.png`, `curl` no abría el fichero, el `assetId` salía `null` y
# cascadeaban ocho rutas (4, 6, 7, 7b, 9, 11, 15, 15b) — H-ADV-04 de `bitacora/3-adv.md`.
FOTO="frontend/templates/xv-jardin/1.0.0/assets/preview.webp"
llamar "7" POST "$IID/assets" "201|200" "${AUTH_U[@]}" -H 'Content-Type: image/webp' --data-binary "@$FOTO"
ASSET="$(jqv '.assetId')"; PREVIEW="$(jqv '.previewUrl')"
echo "         assetId=$ASSET previewUrl=$PREVIEW"
# Segundo asset, que NO se referencia desde el documento: es el que se podrá borrar en la ruta 9
# (borrar uno referenciado por el documento, su attic o cualquier release da 409, ADR-2-5-05).
llamar "7b" POST "$IID/assets" "201|200" "${AUTH_U[@]}" -H 'Content-Type: image/webp' \
  --data-binary "@frontend/templates/boda-clasica/1.0.0/assets/rsvp-bg.webp"
ASSET_LIBRE="$(jqv '.assetId')"
TOTAL=$((TOTAL - 1)); OK=$((OK - 1))   # 7b es la misma ruta 7: no cuenta como una de las 19

# 4 --------------------------------------------------------------------------------------------
LOTE1="$(jq -nc --argjson rev "$REV" --arg a "$ASSET" '{
  baseRevision: $rev, clientBatchId: "smoke-batch-01",
  operations: [
    {op:"setBlock", blockId:"cover.title",   value:{kind:"text", value:"Valentina"}},
    {op:"setBlock", blockId:"honoree.person",value:{kind:"person", name:"Valentina Ríos"}},
    {op:"setBlock", blockId:"cover.image",   value:{kind:"image", assetId:$a, alt:"Foto de portada",
                                                    focal:{x:0.5, y:0.4}}}
  ]}')"
llamar "4" POST "$IID/document/operations" 200 "${AUTH_U[@]}" "${JSON[@]}" -d "$LOTE1"
REV="$(jqv '.revision')"
echo "         revision=$REV applied=$(jqv '.applied')"
REV_COMPLETA="$REV"

# Segundo lote, para que `restore` tenga a dónde volver sin quedarse sin bloques obligatorios.
LOTE2="$(jq -nc --argjson rev "$REV" '{baseRevision:$rev, clientBatchId:"smoke-batch-02",
  operations:[{op:"setBlock", blockId:"cover.subtitle", value:{kind:"text", value:"Mis XV años"}}]}')"
curl -sS -o "$CUERPO" -X POST "$BASE$IID/document/operations" "${AUTH_U[@]}" "${JSON[@]}" -d "$LOTE2" >/dev/null
REV="$(jqv '.revision')"

# 5 --------------------------------------------------------------------------------------------
llamar "5" GET "$IID/document/history?limit=10" 200 "${AUTH_U[@]}"
echo "         revisiones en el historial: $(jqv '[.items[].revision] | join(",")')"

# 6 --------------------------------------------------------------------------------------------
llamar "6" POST "$IID/document/restore" 200 "${AUTH_U[@]}" "${JSON[@]}" \
  -d "$(jq -nc --argjson r "$REV_COMPLETA" --argjson b "$REV" '{revision:$r, baseRevision:$b}')"
REV="$(jqv '.revision')"
echo "         revision=$REV (restaurada la $REV_COMPLETA)"

# 8 --------------------------------------------------------------------------------------------
llamar "8" GET "$IID/assets?limit=10" 200 "${AUTH_U[@]}"
echo "         assets = $(jqv '[.items[].assetId] | join(",")')"

# 10 -------------------------------------------------------------------------------------------
llamar "10" GET "$IID/release/preflight" 200 "${AUTH_U[@]}"
echo "         canPublish=$(jqv '.canPublish') missingRequired=$(jqv '.report.missingRequired | length')"

# 11 -------------------------------------------------------------------------------------------
llamar "11" POST "$IID/release" 201 "${AUTH_U[@]}" "${JSON[@]}" \
  -d "$(jq -nc --argjson b "$REV" '{baseRevision:$b}')"
CONTENT_HASH="$(jqv '.contentHash')"
echo "         contentHash=$CONTENT_HASH"

# 15 -------------------------------------------------------------------------------------------
llamar "15" GET "/public/i/$TOKEN_PUB/render" 200
ETAG="$(grep -i '^etag:' "$CABECERAS" | tr -d '\r' | sed 's/^[Ee][Tt][Aa][Gg]: *//')"
CACHE="$(grep -i '^cache-control:' "$CABECERAS" | tr -d '\r' | sed 's/^[^:]*: *//')"
echo "         ETag: $ETAG"
echo "         Cache-Control: $CACHE"
[ -n "$ETAG" ] || { echo "  [FAIL] el render público no trajo ETag"; FALLOS=$((FALLOS + 1)); }
case "$ETAG" in "\"sha256:"*) : ;; *) echo "  [FAIL] el ETag no tiene la forma \"sha256:…\""; FALLOS=$((FALLOS + 1));; esac
case "$CACHE" in *max-age=300*) : ;; *) echo "  [FAIL] Cache-Control sin max-age=300"; FALLOS=$((FALLOS + 1));; esac

# 15b — revalidación condicional: 304 y SIN cuerpo -----------------------------------------------
# `%{size_download}` es el tamaño REAL del cuerpo recibido. No vale mirar el archivo de `-o`: en un
# 304 curl ni siquiera lo abre, así que conservaría el cuerpo de la llamada anterior y mentiría.
RESP_304="$(curl -sS -o /dev/null -D "$CABECERAS" -w '%{http_code} %{size_download}' \
  -H "If-None-Match: $ETAG" "$BASE/public/i/$TOKEN_PUB/render")"
CODIGO_304="${RESP_304%% *}"; BYTES_304="${RESP_304##* }"
if [ "$CODIGO_304" = "304" ] && [ "$BYTES_304" = "0" ]; then
  printf '  [OK ] %-4s %-6s %-58s esperado %-7s obtenido %s (cuerpo %s B)\n' "15b" GET \
    "/public/i/{token}/render (If-None-Match)" "304" "$CODIGO_304" "$BYTES_304"
else
  printf '  [FAIL] %-3s %-6s %-58s esperado %-7s obtenido %s (cuerpo %s B)\n' "15b" GET \
    "/public/i/{token}/render (If-None-Match)" "304" "$CODIGO_304" "$BYTES_304"
  FALLOS=$((FALLOS + 1))
fi

# 16 -------------------------------------------------------------------------------------------
llamar "16" GET "/public/i/$TOKEN_PUB/exists" 200
echo "         cuerpo: $(head -c 160 "$CUERPO")"

# 13 -------------------------------------------------------------------------------------------
llamar "13" GET "$IID/releases?limit=10" 200 "${AUTH_U[@]}"

# 14 -------------------------------------------------------------------------------------------
llamar "14" POST "$IID/public-token:rotate" 200 "${AUTH_U[@]}"
TOKEN_NUEVO="$(jqv '.publicToken')"
echo "         publicToken $TOKEN_PUB → $TOKEN_NUEVO"

# 12 -------------------------------------------------------------------------------------------
llamar "12" DELETE "$IID/release" 204 "${AUTH_U[@]}"

# 9 --------------------------------------------------------------------------------------------
llamar "9" DELETE "$IID/assets/$ASSET_LIBRE" 204 "${AUTH_U[@]}"

# 17 — registro por HTTP; el paquete ya está registrado ⇒ 200 con alreadyRegistered ---------------
# Los TRES assets, no uno: `template.json` declara `assets/divider.webp`, `assets/preview.webp` y
# `assets/rsvp-bg.webp` (`jq '.assets[].path'`, no a mano), y mandar sólo uno da
# `422 TPL_PACKAGE_ASSET_MISMATCH` («declara assets que no vienen»). Con `preview.png` ni siquiera
# abría el fichero.
PKG="frontend/templates/xv-jardin/1.0.0"
ASSET_ARGS=()
while IFS= read -r ruta_asset; do
  ASSET_ARGS+=(-F "$ruta_asset=@$PKG/$ruta_asset")
done < <(jq -r '.assets[].path' "$PKG/template.json")
llamar "17" POST "/master/templates2/versions" "200|201" "${AUTH_M[@]}" \
  -F "template=@$PKG/template.json" -F "theme=@$PKG/theme.json" -F "defaults=@$PKG/defaults.json" \
  "${ASSET_ARGS[@]}"
echo "         result=$(jqv '.result') alreadyRegistered=$(jqv '.alreadyRegistered')"

# 17b — versión DESECHABLE del mismo paquete (`1.0.99`), sólo para que la 19 tenga qué deprecar sin
# depender de lo que haya sembrado nadie. No cuenta como una de las 19: es la misma ruta 17.
# Por qué no basta con deprecar una versión real: `boda-clasica@1.0.0` y `xv-jardin@1.0.0` son hoy
# la ÚNICA versión publicada de su slug, así que `TemplateCatalogService.kt:166` exige que la
# deprecación NO deje "documentsUsing > 0" sin ninguna versión publicada. En un clúster recién
# sembrado, `xv-jardin@1.0.0` ya tiene un documento (el de este mismo smoke, ruta 2) y, en cuanto
# `scripts/dev-backend.sh register` siembra la demostración, `boda-clasica@1.0.0` también lo tiene
# (H-ADV-04) — cualquiera de las dos reales da `409 TPL_VERSION_LAST_PUBLISHED` según el orden en que
# se ejecute. La desechable no la elige `:choose-template` en ningún sitio, así que su
# `documentsUsing` es 0 por construcción y la ruta 19 deja de depender del orden.
VERSION_DESECHABLE="1.0.99"
PKG_TMP="$TMP/pkg-desechable"
mkdir -p "$PKG_TMP/assets"
jq --arg v "$VERSION_DESECHABLE" '.version = $v' "$PKG/template.json" > "$PKG_TMP/template.json"
jq --arg v "$VERSION_DESECHABLE" '.templateVersion = $v' "$PKG/defaults.json" > "$PKG_TMP/defaults.json"
cp "$PKG/theme.json" "$PKG_TMP/theme.json"
ASSET_ARGS_TMP=()
while IFS= read -r ruta_asset; do
  cp "$PKG/$ruta_asset" "$PKG_TMP/$ruta_asset"
  ASSET_ARGS_TMP+=(-F "$ruta_asset=@$PKG_TMP/$ruta_asset")
done < <(jq -r '.assets[].path' "$PKG/template.json")
llamar "17b" POST "/master/templates2/versions" "200|201" "${AUTH_M[@]}" \
  -F "template=@$PKG_TMP/template.json" -F "theme=@$PKG_TMP/theme.json" -F "defaults=@$PKG_TMP/defaults.json" \
  "${ASSET_ARGS_TMP[@]}"
ID_DESECHABLE="$(jqv '.templateVersionId')"
echo "         xv-jardin@$VERSION_DESECHABLE id=$ID_DESECHABLE alreadyRegistered=$(jqv '.alreadyRegistered')"
TOTAL=$((TOTAL - 1)); OK=$((OK - 1))   # 17b es la misma ruta 17: no cuenta como una de las 19

# 18 -------------------------------------------------------------------------------------------
llamar "18" GET "/master/templates2/versions?limit=20" 200 "${AUTH_M[@]}"
echo "         versiones = $(jqv '[.items[] | "\(.slug)@\(.version):\(.status)"] | join(", ")')"

# 19 — se deprecia la versión DESECHABLE de la 17b, no una real: da igual el orden en que se ejecute
# el script y da igual qué demostración esté sembrada (ver comentario de la 17b). Idempotente:
# deprecar lo ya deprecado responde 200 igualmente (`TemplateCatalogService.kt:151`), así que una
# segunda corrida — que reencuentra la MISMA desechable por `package_hash`, ADR-008 — también pasa.
# No hace falta 'restaurar' nada por SQL: la desechable nace y muere deprecada, sin tocar
# `boda-clasica` ni `xv-jardin@1.0.0`, que es lo que de verdad usan la demostración y este smoke.
llamar "19" POST "/master/templates2/versions/$ID_DESECHABLE:deprecate" 200 "${AUTH_M[@]}"
echo "         status=$(jqv '.status') documentsUsing=$(jqv '.documentsUsing')"

# --- Extra: el asset se puede LEER por la URL que devolvió el backend --------------------------
CODIGO_ASSET="$(curl -sS -o /dev/null -w '%{http_code}' "$PREVIEW")"
echo
echo "-- Extras -------------------------------------------------------------------"
echo "  previewUrl del asset ($PREVIEW) → HTTP $CODIGO_ASSET"
[ "$CODIGO_ASSET" = "200" ] || { echo "  [FAIL] la URL del asset no se puede leer"; FALLOS=$((FALLOS + 1)); }

echo
echo "=============================================================================="
echo " $OK/19 OK   ·   $FALLOS comprobación(es) fallida(s)"
echo "=============================================================================="
[ "$FALLOS" -eq 0 ] && [ "$OK" -eq 19 ] || exit 1
exit 0
