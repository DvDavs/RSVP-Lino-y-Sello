#!/usr/bin/env bash
# scripts/seed/cuenta.sh — siembra del área de CUENTA, MARCA y LEGAL. Dueña: sesión E3.
#
# Una clienta recién registrada y SIN invitaciones: es el estado que E3 tiene que atender en
# `/perfil` y el que destapó G-01 en la fase 3-C (la clienta sin nada y sin salida).
set -uo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/comun.sh"
seed_requiere_backend || exit 2

SUF="$(seed_sufijo)"
CORREO="cliente-cuenta-$SUF@example.com"
TOKEN="$(seed_usuario "$CORREO" "Marta")"
[ -n "$TOKEN" ] && [ "$TOKEN" != null ] || { echo "seed/cuenta: sin JWT" >&2; exit 1; }

printf 'SEED_CUENTA_EMAIL=%q\nSEED_CUENTA_PASS=%q\nSEED_CUENTA_TOKEN=%q\nSEED_CUENTA_CLIENTE=%q\n' \
  "$CORREO" "$SEED_PASS" "$TOKEN" "$(seed_customer_id "$CORREO")"
