#!/usr/bin/env bash
# scripts/seed/plan.sh — siembra del área de PAGOS. Dueña: sesión E4.
#
# Dos invitaciones de la MISMA clienta: una sin pagar y otra pagada. Es el par que hace falta para
# probar la puerta de publicación de ADR-5-0B-01 en sus dos lados sin tocar la del vecino.
set -uo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/comun.sh"
seed_requiere_backend || exit 2

SUF="$(seed_sufijo)"
CORREO="cliente-plan-$SUF@example.com"
TOKEN="$(seed_usuario "$CORREO" "Lucía")"
[ -n "$TOKEN" ] && [ "$TOKEN" != null ] || { echo "seed/plan: sin JWT" >&2; exit 1; }
SIN_PAGAR="$(seed_invitacion "$TOKEN" false)"
PAGADA="$(seed_invitacion "$TOKEN" true)"

# Codigo del plan recomendado del catalogo real (`GET /public/plans`, sembrado por V42). Se consulta
# y NO se escribe aqui: si el dueno cambia el catalogo, esta siembra le sigue sin tocar el script.
# Si el backend aun no tiene la ruta, queda vacio y quien lo use decide que hacer.
CODIGO="$(curl -sS --max-time 5 "$SEED_BASE/public/plans" 2>/dev/null \
  | jq -r '[.planes[]? | select(.recomendado)][0].codigo // (.planes[0]?.codigo // "")' 2>/dev/null)"
[ "$CODIGO" = null ] && CODIGO=""

printf 'SEED_PLAN_EMAIL=%q\nSEED_PLAN_TOKEN=%q\nSEED_PLAN_SIN_PAGAR=%q\nSEED_PLAN_PAGADA=%q\nSEED_PLAN_CODIGO=%q\n' \
  "$CORREO" "$TOKEN" "$SIN_PAGAR" "$PAGADA" "$CODIGO"
