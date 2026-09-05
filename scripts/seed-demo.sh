#!/usr/bin/env bash
# scripts/seed-demo.sh — siembra LA INVITACIÓN DE DEMOSTRACIÓN y la publica.
#
# Bloque 3-2d de la fase 3. Deja una invitación de boda completa, con imaginería real y textos en
# es-MX, publicada y accesible por su enlace público. Es lo que el dueño abre para juzgar el
# resultado visual del rediseño.
#
#   scripts/dev-backend.sh start     # si no está levantado
#   scripts/seed-demo.sh             # imprime la URL pública al final
#
#   TPL_DEMO_SLUG=xv-jardin TPL_DEMO_PALETTE=lilac scripts/seed-demo.sh
#     `TPL_DEMO_PALETTE` (A6 del bloque 3-9) escoge la paleta: se aplica al documento con `setTheme`
#     Y decide qué carpeta de arte se sube (`frontend/templates/<slug>/demo/<paletteId>/`). Las dos
#     cosas van juntas a propósito: el arte está tintado por paleta desde 3-9, y sembrar una paleta
#     con el arte de otra es exactamente el defecto que 3-CV documentó en `O-07`. Por defecto se usa
#     la `defaultPaletteId` del `theme.json` real de la plantilla. `TPL_DEMO_FONTSET` hace lo mismo
#     con el set tipográfico ("serif-elegante" o "moderna"), que va en la misma operación.
#
# TODO va por las RUTAS HTTP REALES del módulo nuevo (`handoffs/2-5.md`), sin un solo INSERT en las
# tablas `tpl_*`. La única excepción, y está documentada desde la fase 2, es `invitation`:
# `uses_templates2` NO tiene ruta HTTP que la active (ADR-2-4-02, `handoffs/3-0a.md §3`), porque
# `templates2` no crea invitaciones — eso es del módulo antiguo, que es área prohibida. Esa fila se
# inserta por SQL, igual que hace `scripts/smoke.sh`, y se deja a la vista.
#
# Idempotente: se puede ejecutar tantas veces como se quiera y sobre un clúster recién creado.
#   · el registro de plantillas es idempotente por `package_hash`   → `200 noop_same_hash`
#   · la subida de assets es idempotente por `sha256`               → `200 {reused:true}`
#   · cada lote lleva un `clientBatchId` estable                    → `200 {applied:false}`
#   · la publicación se salta si ya hay un release con el mismo `contentHash`
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"
BASE="${TPL_DEV_BASE:-http://127.0.0.1:6003}"
PGBIN="${TPL_TEST_PGBIN:-/usr/lib/postgresql/16/bin}"
ESTADO="${TPL_TEST_STATE_DIR:-/tmp/templates2-pg}/state.env"
DB="${TPL_DEV_DB:-invitaciones_dev}"
SLUG="${TPL_DEMO_SLUG:-boda-clasica}"
VERSION="${TPL_DEMO_VERSION:-1.0.0}"
# A6 del bloque 3-9: la paleta que se aplica al documento Y la carpeta de arte que se sube (las dos
# tienen que decir lo mismo). Por defecto, la `defaultPaletteId` del `theme.json` REAL de la
# plantilla — ningún identificador escrito a mano aquí.
PALETA="${TPL_DEMO_PALETTE:-$(jq -r .defaultPaletteId "$RAIZ/frontend/templates/$SLUG/$VERSION/theme.json")}"
# El set tipográfico va por el mismo camino (`setTheme` acepta los dos). Sirve para sembrar una
# invitación con «Moderna», que es la otra opción que el editor ofrece y la que A4 destapó sin
# autoalojar (`O-02b` de 3-CV).
FONTSET="${TPL_DEMO_FONTSET:-$(jq -r .defaultFontSetId "$RAIZ/frontend/templates/$SLUG/$VERSION/theme.json")}"
EMAIL_USER="${TPL_DEMO_EMAIL:-demo.boda@example.com}"
EMAIL_MASTER="${TPL_DEMO_EMAIL_MASTER:-demo.master@example.com}"
PASS="${TPL_DEMO_PASS:-Demo1234!}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if ! curl -sS -o /dev/null --max-time 5 "$BASE/public/i/x/exists" 2>/dev/null; then
  echo "seed-demo: el backend no responde en $BASE. Arranca antes: scripts/dev-backend.sh start" >&2
  exit 2
fi
if [ ! -f "$ESTADO" ]; then
  echo "seed-demo: no encuentro el clúster efímero ($ESTADO). Arranca antes: scripts/dev-backend.sh start" >&2
  exit 2
fi
# shellcheck disable=SC1090
PGPORT_DEV="$( . "$ESTADO"; echo "$TPL_TEST_PGPORT" )"
sql() { "$PGBIN/psql" -h 127.0.0.1 -p "$PGPORT_DEV" -U postgres -d "$DB" -v ON_ERROR_STOP=1 -Atqc "$1"; }
j() { jq -r "$1" < "$TMP/r.json"; }

# `curl` con captura de cuerpo y código. Devuelve el código por stdout.
llamar() {
  local metodo="$1" ruta="$2"; shift 2
  curl -sS -o "$TMP/r.json" -w '%{http_code}' -X "$metodo" "$BASE$ruta" "$@"
}

echo "=============================================================================="
echo " seed-demo — invitación de demostración de $SLUG@$VERSION"
echo " base: $BASE   postgres: 127.0.0.1:$PGPORT_DEV/$DB   $(date -u +%FT%TZ)"
echo "=============================================================================="

# ---------------------------------------------------------------------- 1. cuentas y JWT (reales)
alta() {
  local email="$1" nombre="$2" tel="$3"
  curl -sS -o /dev/null -X POST "$BASE/auth/signup" -H 'Content-Type: application/json' \
    -d "$(jq -nc --arg e "$email" --arg n "$nombre" --arg t "$tel" --arg p "$PASS" \
      '{name:$n,lastName:"Demo",email:$e,phone:$t,birthdate:null,address:null,city:null,postalCode:null,state:null,howKnow:null,password:$p}')"
  curl -sS -o "$TMP/auth" -X POST "$BASE/auth/token" -H 'Content-Type: application/json' \
    -d "$(jq -nc --arg e "$email" --arg p "$PASS" '{email:$e,password:$p}')"
  jq -r '.accessToken' < "$TMP/auth"
}
echo
echo "-- 1. cuentas ---------------------------------------------------------------"
TOKEN_USER="$(alta "$EMAIL_USER" "Ana" "+525512347001")"
alta "$EMAIL_MASTER" "Master" "+525512347002" >/dev/null
# El rol MASTER no se puede pedir por `/auth/signup` (siempre crea USER, `CustomerService.kt:81`) y
# la ruta que crea administradores exige ya ser MASTER: se promueve por SQL. Única vía posible en un
# entorno recién creado; queda dicho con todas las letras.
sql "UPDATE customer SET role = 'MASTER' WHERE email = '$EMAIL_MASTER';" >/dev/null
TOKEN_MASTER="$(alta "$EMAIL_MASTER" "Master" "+525512347002")"
CUSTOMER_ID="$(sql "SELECT id FROM customer WHERE email = '$EMAIL_USER';")"
[ -n "$TOKEN_USER" ] && [ "$TOKEN_USER" != null ] || { echo "seed-demo: sin JWT de USER"; exit 1; }
echo "  cliente USER id=$CUSTOMER_ID ($EMAIL_USER) · MASTER $EMAIL_MASTER promovido por SQL"

AUTH_U=(-H "Authorization: Bearer $TOKEN_USER")
AUTH_M=(-H "Authorization: Bearer $TOKEN_MASTER")
JSON=(-H 'Content-Type: application/json')

# ------------------------------------------------------------------- 2. plantillas registradas
echo
echo "-- 2. plantillas ------------------------------------------------------------"
registrar() {
  local slug="$1" p="$RAIZ/frontend/templates/$1/$VERSION"
  local args=(-F "template=@$p/template.json" -F "theme=@$p/theme.json" -F "defaults=@$p/defaults.json")
  local f; for f in "$p"/assets/*; do args+=(-F "assets/$(basename "$f")=@$f"); done
  local c; c="$(llamar POST /master/templates2/versions "${AUTH_M[@]}" "${args[@]}")"
  printf '  %-14s HTTP %s  result=%-16s templateVersionId=%s  packageHash=%s\n' \
    "$slug@$VERSION" "$c" "$(j .result)" "$(j .templateVersionId)" "$(j .packageHash)"
  [ "$c" = 200 ] || [ "$c" = 201 ] || { echo "  cuerpo: $(cat "$TMP/r.json")"; return 1; }
}
registrar boda-clasica || exit 1
registrar xv-jardin    || exit 1
llamar GET /editor/templates2/catalog "${AUTH_U[@]}" >/dev/null
echo "  catálogo: $(j '[.items[] | "\(.slug)@\(.version)"] | join(", ")')"

# ------------------------------------------------------------ 3. invitación con uses_templates2
echo
echo "-- 3. invitación ------------------------------------------------------------"
INVITACION="$(sql "SELECT id FROM invitation WHERE customer_id = $CUSTOMER_ID AND uses_templates2 ORDER BY id LIMIT 1;")"
if [ -z "$INVITACION" ]; then
  # Se rellenan TODAS las columnas booleanas y `total_amount`: son NULLABLE en la tabla pero
  # `InvitationEntity` las mapea a primitivos de Kotlin, y un NULL convierte cualquier ruta del
  # editor en 500 TPL_INTERNAL (defecto preexistente y ajeno, ver bitacora/3-0a.md).
  # `template_id = 5` es "Boda Premium" (plan premium ⇒ planTier 2), compatible con minPlanTier 2.
  INVITACION="$(sql "INSERT INTO invitation (customer_id, template_id, is_enabled, is_paid, is_finished,
      all_events_same_location, uses_templates2, date, time, hashtag, cover_photo_url,
      children_allowed, young_allowed, has_music, has_gallery, has_extra_modules, total_amount,
      created_at, updated_at)
    VALUES ($CUSTOMER_ID, 5, true, true, false, false, true, '2027-04-18', '17:00', '#AnaYDiego2027', '',
      false, true, true, true, true, 0, now(), now()) RETURNING id;")"
  echo "  invitación id=$INVITACION creada por SQL (no hay ruta HTTP para uses_templates2, ADR-2-4-02)"
else
  echo "  invitación id=$INVITACION reutilizada"
fi
E="/editor/invitations/$INVITACION"

# ------------------------------------------------------------------- 4. :choose-template
echo
echo "-- 4. :choose-template ------------------------------------------------------"
CODE="$(llamar GET "$E/document" "${AUTH_U[@]}")"
if [ "$CODE" = 404 ]; then
  CODE="$(llamar POST "$E/document:choose-template" "${AUTH_U[@]}" "${JSON[@]}" \
    -d "$(jq -nc --arg s "$SLUG" --arg v "$VERSION" '{templateSlug:$s, templateVersion:$v}')")"
  echo "  POST …/document:choose-template → HTTP $CODE  revision=$(j .revision)  publicToken=$(j .publicToken)"
  CODE="$(llamar GET "$E/document" "${AUTH_U[@]}")"
else
  echo "  documento ya existente (HTTP $CODE): se reutiliza"
fi
[ "$CODE" = 200 ] || { echo "  no pude leer el documento: $(cat "$TMP/r.json")"; exit 1; }
cp "$TMP/r.json" "$TMP/doc0.json"
REV="$(jq -r .revision < "$TMP/doc0.json")"
TOKEN_PUB="$(jq -r .publicToken < "$TMP/doc0.json")"
echo "  revision=$REV publicToken=$TOKEN_PUB"
echo "  CompositionReport ANTES de sembrar: $(jq -c '.report | {missingRequired, stillDefault}' < "$TMP/doc0.json")"
echo "  (los assetId de defaults.json NO se resuelven: cover.image queda 'empty'. Diagnóstico en bitacora/3-2d.md §5)"

# ---------------------------------------------------- 5. assets por el camino real (binario crudo)
echo
echo "-- 5. assets ----------------------------------------------------------------"
# A6 del bloque 3-9 — EL ARTE DE DEMOSTRACIÓN ES POR PALETA. `build-art.mjs` genera un juego en
# `demo/<paletteId>/` por cada paleta del `theme.json`, y aquí se sube el que casa con la paleta que
# se va a aplicar. Antes había un solo juego, tintado con la paleta por defecto: con `navy` la
# invitación quedaba con trece imágenes rosas sobre un fondo azul frío (`O-07` de 3-CV).
DEMO="$RAIZ/frontend/templates/$SLUG/demo/$PALETA"
if [ ! -d "$DEMO" ]; then
  echo "  falta $DEMO"
  echo "  paletas con arte generado para $SLUG: $(ls "$RAIZ/frontend/templates/$SLUG/demo" 2>/dev/null | tr '\n' ' ')"
  echo "  ejecuta antes 'node frontend/templates/scripts/build-art.mjs', o fija TPL_DEMO_PALETTE a una de ellas"
  exit 1
fi
echo "  arte de la paleta \"$PALETA\" ($DEMO)"
echo '{}' > "$TMP/assets.json"
for f in "$DEMO"/*.webp; do
  n="$(basename "$f")"
  # Cuerpo BINARIO CRUDO, nunca multipart (ADR-1R-B-12). El SVG se rechaza a propósito
  # (ADR-2-5-04: un SVG de cliente en un bucket público es XSS), por eso todo esto es WebP.
  c="$(llamar POST "$E/assets" "${AUTH_U[@]}" -H 'Content-Type: image/webp' --data-binary "@$f")"
  if [ "$c" != 201 ] && [ "$c" != 200 ]; then
    echo "  $n → HTTP $c  $(head -c 300 "$TMP/r.json")"; exit 1
  fi
  a="$(j .assetId)"
  printf '  %-18s HTTP %s  assetId=%s  %s B  reused=%s\n' "$n" "$c" "$a" "$(stat -c%s "$f")" "$(j '.reused // false')"
  jq --arg k "$n" --arg v "$a" '. + {($k): $v}' "$TMP/assets.json" > "$TMP/assets2.json" && mv "$TMP/assets2.json" "$TMP/assets.json"
done
llamar GET "$E/assets?limit=50" "${AUTH_U[@]}" >/dev/null
echo "  GET …/assets → $(j '.items | length') assets en la invitación"

# --------------------------------------------------------- 6. contenido real por operaciones
echo
echo "-- 6. operaciones -----------------------------------------------------------"
node "$RAIZ/frontend/templates/scripts/demo-content.mjs" "$TMP/assets.json" > "$TMP/lotes.json" || exit 1
N="$(jq 'length' "$TMP/lotes.json")"
for i in $(seq 0 $((N - 1))); do
  jq --argjson i "$i" --argjson r "$REV" '.[$i] | {baseRevision:$r} + .' "$TMP/lotes.json" > "$TMP/lote.json"
  c="$(llamar POST "$E/document/operations" "${AUTH_U[@]}" "${JSON[@]}" --data-binary "@$TMP/lote.json")"
  if [ "$c" != 200 ]; then
    echo "  lote $(jq -r --argjson i "$i" '.[$i].clientBatchId' "$TMP/lotes.json") → HTTP $c"
    echo "  $(head -c 700 "$TMP/r.json")"; exit 1
  fi
  REV="$(j .revision)"
  printf '  %-34s HTTP %s  applied=%-5s revision=%s  (%s operaciones)\n' \
    "$(jq -r --argjson i "$i" '.[$i].clientBatchId' "$TMP/lotes.json")" "$c" "$(j .applied)" "$REV" \
    "$(jq -r --argjson i "$i" '.[$i].operations | length' "$TMP/lotes.json")"
done

# -------------------------------------------------------- 6b. paleta (A6 del bloque 3-9)
# El arte que se acaba de subir está tintado con `$PALETA`; el documento tiene que decir lo mismo, o
# el sistema vuelve a prometer tres paletas y servir una. Se aplica con `setTheme`, que es la
# operación REAL del editor (`DomainJson.kt:830`), no un atajo por SQL.
echo
echo "-- 6b. paleta ---------------------------------------------------------------"
# La revisión se relee del servidor en vez de arrastrar `$REV`: cuando un lote sale `applied=false`
# —porque ese `clientBatchId` ya se aplicó en una corrida anterior, que es lo normal en un script
# idempotente— la respuesta trae la revisión de ENTONCES, no la actual, y el `setTheme` se iría
# contra una base vieja (`409 TPL_REVISION_CONFLICT`). Medido [V] sobre la invitación sembrada, que
# además se comparte entre sesiones (`bitacora/3-cv.md §6`).
llamar GET "$E/document" "${AUTH_U[@]}" >/dev/null
REV="$(j .revision)"
jq -nc --argjson r "$REV" --arg p "$PALETA" --arg f "$FONTSET" \
  '{baseRevision:$r, clientBatchId:("seed-tema-" + $p + "-" + $f),
    operations:[{op:"setTheme", paletteId:$p, fontSetId:$f}]}' > "$TMP/tema.json"
CODE="$(llamar POST "$E/document/operations" "${AUTH_U[@]}" "${JSON[@]}" --data-binary "@$TMP/tema.json")"
if [ "$CODE" = 200 ]; then
  REV="$(j .revision)"
  echo "  setTheme paletteId=$PALETA fontSetId=$FONTSET → HTTP $CODE  applied=$(j .applied)  revision=$REV"
else
  echo "  setTheme paletteId=$PALETA fontSetId=$FONTSET → HTTP $CODE  $(head -c 300 "$TMP/r.json")"; exit 1
fi

# ------------------------------------------------------------------------ 7. preflight y release
echo
echo "-- 7. publicación -----------------------------------------------------------"
llamar GET "$E/release/preflight" "${AUTH_U[@]}" >/dev/null
echo "  preflight: canPublish=$(j .canPublish)  bloqueos=$(j '[.blockers[]? | .code] | join(",") // "ninguno"')"
if [ "$(j .canPublish)" != true ]; then
  echo "  informe: $(j '.report')"
  echo "  seed-demo: la invitación NO se puede publicar todavía." >&2; exit 1
fi
CODE="$(llamar POST "$E/release" "${AUTH_U[@]}" "${JSON[@]}" -d "$(jq -nc --argjson b "$REV" '{baseRevision:$b}')")"
if [ "$CODE" = 201 ] || [ "$CODE" = 200 ]; then
  echo "  POST …/release → HTTP $CODE  contentHash=$(j .contentHash)"
else
  echo "  POST …/release → HTTP $CODE  $(head -c 300 "$TMP/r.json")"
  echo "  (se continúa: puede que ya estuviera publicada con el mismo contenido)"
fi
llamar GET "$E/releases?limit=5" "${AUTH_U[@]}" >/dev/null
echo "  releases: $(j '[.items[] | "#\(.revision // .id) \(.contentHash[0:20])…"] | join("  ")')"

# --------------------------------------------------------------------------- 8. render público
echo
echo "-- 8. render público --------------------------------------------------------"
CODE="$(curl -sS -o "$TMP/pub.json" -D "$TMP/pub.head" -w '%{http_code}' "$BASE/public/i/$TOKEN_PUB/render")"
ETAG="$(grep -i '^etag:' "$TMP/pub.head" | tr -d '\r' | sed 's/^[^:]*: *//')"
echo "  GET /public/i/$TOKEN_PUB/render → HTTP $CODE"
echo "  ETag: $ETAG"
echo "  secciones visibles: $(jq -r '[.composed.sections[] | select(.visible != false) | .key] | join(", ")' "$TMP/pub.json")"
echo "  imágenes resueltas: $(jq '[.. | objects | select(.kind? == "image") | .url] | length' "$TMP/pub.json")"
UNA="$(jq -r '[.. | objects | select(.kind? == "image") | .url][0] // empty' "$TMP/pub.json")"
if [ -n "$UNA" ]; then
  echo "  primera imagen: $UNA → HTTP $(curl -sS -o /dev/null -w '%{http_code}' "$UNA")"
fi

echo
echo "=============================================================================="
echo "  INVITACIÓN PUBLICADA"
echo "    enlace público   $BASE/public/i/$TOKEN_PUB/render   (JSON del render)"
echo "    ruta de apps/web /i/$TOKEN_PUB"
echo "    plantilla        $SLUG@$VERSION   paleta $PALETA   tipografía $FONTSET"
echo "    invitationId     $INVITACION      customerId $CUSTOMER_ID"
echo "    editor           $EMAIL_USER / $PASS"
echo "=============================================================================="
