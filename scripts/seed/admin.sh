#!/usr/bin/env bash
# scripts/seed/admin.sh — siembra del área de ADMINISTRACIÓN. Dueña: sesión E5.
#
# Un MASTER y una clienta ajena con una invitación, para que la tabla ruta x rol se pueda probar de
# verdad: hace falta alguien a quien el administrador NO sea, para comprobar que un USER no entra y
# que un ADMIN no abre lo que no es suyo (hallazgos S-03, S-04 y S-05 del inventario).
set -uo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/comun.sh"
seed_requiere_backend || exit 2

SUF="$(seed_sufijo)"
CORREO_MASTER="master-$SUF@example.com"
CORREO_AJENO="cliente-ajeno-$SUF@example.com"
TOKEN_MASTER="$(seed_master "$CORREO_MASTER")"
TOKEN_AJENO="$(seed_usuario "$CORREO_AJENO" "Ajena")"
[ -n "$TOKEN_MASTER" ] && [ "$TOKEN_MASTER" != null ] || { echo "seed/admin: sin JWT de MASTER" >&2; exit 1; }
INV_AJENA="$(seed_invitacion "$TOKEN_AJENO")"

printf 'SEED_ADMIN_EMAIL=%q\nSEED_ADMIN_TOKEN=%q\nSEED_ADMIN_AJENO_EMAIL=%q\nSEED_ADMIN_AJENO_TOKEN=%q\nSEED_ADMIN_INVITACION_AJENA=%q\n' \
  "$CORREO_MASTER" "$TOKEN_MASTER" "$CORREO_AJENO" "$TOKEN_AJENO" "$INV_AJENA"
