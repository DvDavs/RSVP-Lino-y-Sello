#!/usr/bin/env bash
set -euo pipefail

# Aplica el alta/correccion de templates 11 y 12 en ambiente local Docker.
#
# Incluye:
# 1) Ajuste en PostgreSQL de invitation_template (ids 11 y 12)
# 2) Upsert de visual/content defaults en Mongo para ids 11 y 12
# 3) Deshabilitar duplicados operativos 16 y 17 (si existen)

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-postgres-db}"
MONGO_CONTAINER="${MONGO_CONTAINER:-mongo-db}"
POSTGRES_DB="${POSTGRES_DB:-invitaciones}"
POSTGRES_USER="${POSTGRES_USER:-evolution}"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

PAYLOAD_WEDDING="${ROOT_DIR}/src/main/resources/data/mongo/payload-template-2.json"
PAYLOAD_XV="${ROOT_DIR}/src/main/resources/data/mongo/payload-template-xv-2.json"
UPSERT_SCRIPT="${ROOT_DIR}/scripts/upsert_template_11_12.js"

if [[ ! -f "$PAYLOAD_WEDDING" || ! -f "$PAYLOAD_XV" || ! -f "$UPSERT_SCRIPT" ]]; then
  echo "Faltan archivos requeridos."
  echo "Verifica payloads y scripts en el repositorio."
  exit 1
fi

echo "[1/3] Actualizando templates en PostgreSQL..."
docker exec -i "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
UPDATE invitation_template
SET name='Boda Premium 2',
    price=599,
    image='https://invitacionesdigitales.s3.us-east-2.amazonaws.com/demos/boda/template2/preview.jpg',
    url='https://www.invitaciones-digitales.com.mx/templates/wedding/premium/2',
    event_type_id=1,
    invitation_plan_id=2,
    updated_at=NOW()
WHERE id=11;

UPDATE invitation_template
SET name='XV Premium 2',
    price=599,
    image='https://invitacionesdigitales.s3.us-east-2.amazonaws.com/demos/xv/premium/2/preview.jpg',
    url='https://www.invitaciones-digitales.com.mx/templates/xv/premium/2',
    event_type_id=2,
    invitation_plan_id=2,
    updated_at=NOW()
WHERE id=12;

UPDATE invitation_template
SET is_enabled=false,
    updated_at=NOW()
WHERE id IN (16,17);
"

echo "[2/3] Copiando payloads y script al contenedor Mongo..."
docker cp "$PAYLOAD_WEDDING" "$MONGO_CONTAINER:/tmp/payload-template-2.json"
docker cp "$PAYLOAD_XV" "$MONGO_CONTAINER:/tmp/payload-template-xv-2.json"
docker cp "$UPSERT_SCRIPT" "$MONGO_CONTAINER:/tmp/upsert_template_11_12.js"

echo "[3/3] Ejecutando upsert en Mongo..."
docker exec -i "$MONGO_CONTAINER" mongosh --quiet \
  'mongodb://evolution:evolution123@localhost:27017/invitaciones?authSource=admin' \
  /tmp/upsert_template_11_12.js

echo "Listo. Templates 11 y 12 aplicados en PostgreSQL + Mongo."
