#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:6003}"
# Credenciales SIN valor por defecto (fase 5, ADR-5-E3-A3-01): este script traía escritos en claro
# la cuenta y la contraseña de un usuario MASTER real. Ahora las exige del entorno:
#   EMAIL=... PASSWORD=... scripts/create_complete_template.sh ...
EMAIL="${EMAIL:-}"
PASSWORD="${PASSWORD:-}"
if [[ -z "$EMAIL" || -z "$PASSWORD" ]]; then
  echo "create_complete_template: faltan EMAIL y/o PASSWORD (credenciales MASTER del backend)." >&2
  echo "                          Exporta las tuyas: EMAIL=... PASSWORD=... $0 ..." >&2
  exit 2
fi

if [[ $# -lt 7 ]]; then
  echo "Uso: $0 <name> <price> <image_url> <demo_url> <event_id> <plan_id> <visual_config_json_path> [content_config_json_path]"
  echo "Ejemplo:"
  echo "  $0 \"Nueva Plantilla\" 399.99 https://example.com/img.jpg https://example.com/demo 6 2 /tmp/visual.json"
  exit 1
fi

NAME="$1"
PRICE="$2"
IMAGE_URL="$3"
DEMO_URL="$4"
EVENT_ID="$5"
PLAN_ID="$6"
VISUAL_JSON_PATH="$7"
CONTENT_JSON_PATH="${8:-}"

if [[ ! -f "$VISUAL_JSON_PATH" ]]; then
  echo "Error: no existe visual_config_json_path: $VISUAL_JSON_PATH"
  exit 1
fi

ACCESS_TOKEN=$(curl -s -X POST "$BASE_URL/auth/token" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | jq -r '.accessToken')

if [[ -z "$ACCESS_TOKEN" || "$ACCESS_TOKEN" == "null" ]]; then
  echo "Error: no se pudo obtener accessToken"
  exit 1
fi

if [[ -n "$CONTENT_JSON_PATH" ]]; then
  if [[ ! -f "$CONTENT_JSON_PATH" ]]; then
    echo "Error: no existe content_config_json_path: $CONTENT_JSON_PATH"
    exit 1
  fi

  jq -n \
    --arg name "$NAME" \
    --argjson price "$PRICE" \
    --arg image "$IMAGE_URL" \
    --arg url "$DEMO_URL" \
    --argjson eventId "$EVENT_ID" \
    --argjson planId "$PLAN_ID" \
    --slurpfile visual "$VISUAL_JSON_PATH" \
    --slurpfile content "$CONTENT_JSON_PATH" \
    '{
      name: $name,
      price: $price,
      image: $image,
      url: $url,
      eventId: $eventId,
      planId: $planId,
      reuseExistingContent: false,
      visualConfig: $visual[0],
      contentConfig: $content[0]
    }' > /tmp/complete_template_request.json
else
  jq -n \
    --arg name "$NAME" \
    --argjson price "$PRICE" \
    --arg image "$IMAGE_URL" \
    --arg url "$DEMO_URL" \
    --argjson eventId "$EVENT_ID" \
    --argjson planId "$PLAN_ID" \
    --slurpfile visual "$VISUAL_JSON_PATH" \
    '{
      name: $name,
      price: $price,
      image: $image,
      url: $url,
      eventId: $eventId,
      planId: $planId,
      reuseExistingContent: true,
      visualConfig: $visual[0]
    }' > /tmp/complete_template_request.json
fi

echo "Request construido en /tmp/complete_template_request.json"

curl -s -X POST "$BASE_URL/master/templates/complete" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d @/tmp/complete_template_request.json | jq '.'
