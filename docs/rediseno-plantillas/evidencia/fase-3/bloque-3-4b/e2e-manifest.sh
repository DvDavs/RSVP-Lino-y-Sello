#!/usr/bin/env bash
# e2e-manifest.sh — prueba de extremo a extremo del bloque 3-4b, contra el BACKEND REAL.
#
# Demuestra, sobre Tomcat y Postgres de verdad, que `GET /editor/invitations/{iid}/document` entrega
# al editor las cinco cosas que le faltaban y que ninguna de las 19 rutas daba (defecto de 3-4b):
#   1. `BlockSpec.constraints` (`maxLength`, `multiline`)   → escenario U-17 de `04 §20.1`
#   2. las opciones de un bloque `choice`
#   3. `SectionSpec.required`                                → escenario U-18 de `04 §20.1`
#   4. `SectionSpec.variants`                                → selector de variante
#   5. el catálogo de paletas y conjuntos tipográficos       → selector de tema
#
# Se ejecuta ANTES del cambio (falla: sale 1 y dice qué falta) y DESPUÉS (pasa: sale 0).
#
#   BASE=http://127.0.0.1:6003 IID=3 EMAIL=… PASSWORD=… docs/…/e2e-manifest.sh
set -uo pipefail

BASE="${BASE:-http://127.0.0.1:6003}"
IID="${IID:-3}"
EMAIL="${EMAIL:-demo.boda@example.com}"
PASSWORD="${PASSWORD:-Demo1234!}"

fallos=0
ok()   { printf '  OK    %s\n' "$1"; }
mal()  { printf '  FALLA %s\n' "$1"; fallos=$((fallos + 1)); }

# `esperado` y `obtenido` se comparan como texto: jq ya normaliza el JSON.
comprobar() { # <descripción> <esperado> <obtenido>
  if [ "$2" = "$3" ]; then ok "$1 → $3"; else mal "$1: esperaba <$2>, obtuve <$3>"; fi
}

echo "== e2e 3-4b — el manifiesto de la plantilla en GET .../document =="
echo "backend: $BASE · invitación: $IID"
echo

TOKEN="$(curl -sS --max-time 15 -X POST "$BASE/auth/token" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | jq -r '.accessToken // empty')"
if [ -z "$TOKEN" ]; then echo "no pude autenticarme con $EMAIL en $BASE" >&2; exit 2; fi

DOC="$(curl -sS --max-time 20 -H "Authorization: Bearer $TOKEN" "$BASE/editor/invitations/$IID/document")"
if [ "$(printf '%s' "$DOC" | jq -r 'has("document")')" != "true" ]; then
  echo "GET .../document no respondió un documento:" >&2; printf '%s\n' "$DOC" | head -20 >&2; exit 2
fi

echo "1. campos de primer nivel de la respuesta"
printf '%s' "$DOC" | jq -c 'keys'
comprobar "existe .manifest"       true "$(printf '%s' "$DOC" | jq -r 'has("manifest")')"
comprobar "existe .theme"          true "$(printf '%s' "$DOC" | jq -r 'has("theme")')"
comprobar ".manifest es el de la plantilla vigente" \
  "$(printf '%s' "$DOC" | jq -r '.templateVersion.slug + "@" + .templateVersion.version')" \
  "$(printf '%s' "$DOC" | jq -r '(.manifest.slug // "?") + "@" + (.manifest.version // "?")')"
echo

echo "2. U-17 — constraints de un TextSpec (maxLength y multiline)"
printf '%s' "$DOC" | jq -c '[.manifest.sections[]?.blocks[]? | select(.type=="text") | {id, constraints}] | .[0:3]'
comprobar "family.godparents/label declara maxLength 40" 40 \
  "$(printf '%s' "$DOC" | jq -r '[.manifest.sections[]?.blocks[]? | select(.id=="family.godparents") | .itemBlocks[]? | select(.id=="label") | .constraints.maxLength] | if length == 0 then "AUSENTE" else (.[0] | tostring) end')"
comprobar "cover.title declara multiline" false \
  "$(printf '%s' "$DOC" | jq -r '[.manifest.sections[]?.blocks[]? | select(.id=="cover.title") | .constraints.multiline] | if length == 0 then "AUSENTE" else (.[0] | tostring) end')"
echo

echo "3. opciones de un bloque choice"
comprobar "gifts.options/kind trae sus 3 opciones" "bank,store,cash" \
  "$(printf '%s' "$DOC" | jq -r '[.manifest.sections[]?.blocks[]? | .itemBlocks[]? | select(.type=="choice") | .options[].id] | if length == 0 then "AUSENTE" else join(",") end')"
echo

echo "4. U-18 — SectionSpec.required (hoy sólo se descubre fallando)"
printf '%s' "$DOC" | jq -c '[.manifest.sections[]? | {key, required, variants}] | .[0:4]'
comprobar "la sección cover es required"    true  "$(printf '%s' "$DOC" | jq -r '[.manifest.sections[]? | select(.key=="cover") | .required] | if length == 0 then "AUSENTE" else (.[0] | tostring) end')"
comprobar "la sección gallery NO es required" false "$(printf '%s' "$DOC" | jq -r '[.manifest.sections[]? | select(.key=="gallery") | .required] | if length == 0 then "AUSENTE" else (.[0] | tostring) end')"
echo

echo "5. SectionSpec.variants — selector de variante"
comprobar "cover ofrece full y framed" "full,framed" \
  "$(printf '%s' "$DOC" | jq -r '[.manifest.sections[]? | select(.key=="cover") | .variants[]] | if length == 0 then "AUSENTE" else join(",") end')"
echo

echo "6. paletas y conjuntos tipográficos (el compuesto sólo trae el tema YA resuelto)"
printf '%s' "$DOC" | jq -c '{composed_theme_resuelto: (.composed.theme | {paletteId, fontSetId}), presets: {palettes: [.theme.palettes[]?.id], fontSets: [.theme.fontSets[]?.id]}}'
comprobar "3 paletas entre las que elegir" "blush,olive,navy" \
  "$(printf '%s' "$DOC" | jq -r '[.theme.palettes[]?.id] | if length == 0 then "AUSENTE" else join(",") end')"
comprobar "2 conjuntos tipográficos" "serif-elegante,moderna" \
  "$(printf '%s' "$DOC" | jq -r '[.theme.fontSets[]?.id] | if length == 0 then "AUSENTE" else join(",") end')"
comprobar "los tokens de cada paleta viajan completos" 6 \
  "$(printf '%s' "$DOC" | jq -r '[.theme.palettes[0]?.tokens | keys[]] | length')"
echo

echo "7. control: ninguna OTRA ruta lo daba (por eso hacía falta este campo)"
CAT="$(curl -sS --max-time 20 -H "Authorization: Bearer $TOKEN" "$BASE/editor/templates2/catalog")"
comprobar "el catálogo NO trae sections"  0 "$(printf '%s' "$CAT" | jq -r '[.items[]? | select(has("sections"))] | length')"
comprobar "el catálogo NO trae palettes"  0 "$(printf '%s' "$CAT" | jq -r '[.items[]? | select(has("palettes"))] | length')"
comprobar "el compuesto NO trae constraints" 0 \
  "$(printf '%s' "$DOC" | jq -r '[.composed.sections[]?.blocks[]? | select(has("constraints"))] | length')"
comprobar "el compuesto NO trae required de sección" 0 \
  "$(printf '%s' "$DOC" | jq -r '[.composed.sections[]? | select(has("required"))] | length')"
comprobar "el compuesto NO trae variants disponibles" 0 \
  "$(printf '%s' "$DOC" | jq -r '[.composed.sections[]? | select(has("variants"))] | length')"
echo

if [ "$fallos" -eq 0 ]; then
  echo "RESULTADO: 0 fallos — el editor ya puede construir formularios, selector de variante y de tema."
  exit 0
fi
echo "RESULTADO: $fallos comprobaciones FALLAN — el editor no puede editar con lo que hoy recibe."
exit 1
