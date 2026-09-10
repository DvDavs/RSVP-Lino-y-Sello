#!/usr/bin/env bash
# scripts/seed/admin.sh — siembra del área de ADMINISTRACIÓN. Dueña: sesión E5.
#
# Un MASTER, un ADMIN, una clienta DEL ADMIN con invitación y una clienta AJENA con invitación, para
# que la tabla ruta × rol y la prueba de alcance se puedan medir de verdad: hace falta alguien a quien
# el administrador NO sea, para comprobar que un USER no entra y que un ADMIN no ve lo que no es suyo
# (hallazgos S-03, S-04 y S-05 del inventario).
#
# El ADMIN existe porque la fila «ADMIN» de la tabla no se puede medir con el MASTER: MASTER lo ve
# todo por definición, así que un alcance roto pasaría desapercibido. La regla que hay que poder
# romper es `customer.id = :yo OR customer.created_by = :yo` (`DashboardRepository.kt:50`), y para eso
# hacen falta las dos clientas: una con `created_by` = ese ADMIN y otra sin.
#
# El rol y el `created_by` se ponen por SQL, igual que `seed_master` de `comun.sh:96-101` y por el
# mismo motivo: `/auth/signup` siempre crea USER (`CustomerService.kt:81`) y las rutas que crean
# administradores exigen ya ser MASTER. No hay atajo por la API en un entorno recién creado.
set -uo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/comun.sh"
seed_requiere_backend || exit 2

SUF="$(seed_sufijo)"
CORREO_MASTER="master-$SUF@example.com"
CORREO_ADMIN="admin-$SUF@example.com"
CORREO_PROPIA="cliente-propia-$SUF@example.com"
CORREO_AJENO="cliente-ajeno-$SUF@example.com"

TOKEN_MASTER="$(seed_master "$CORREO_MASTER")"
[ -n "$TOKEN_MASTER" ] && [ "$TOKEN_MASTER" != null ] || { echo "seed/admin: sin JWT de MASTER" >&2; exit 1; }

# ADMIN: se da de alta como USER y se promueve por SQL.
seed_usuario "$CORREO_ADMIN" "Admin" >/dev/null
seed_sql "UPDATE customer SET role = 'ADMIN' WHERE email = '$CORREO_ADMIN';" >/dev/null
TOKEN_ADMIN="$(seed_usuario "$CORREO_ADMIN" "Admin")"
[ -n "$TOKEN_ADMIN" ] && [ "$TOKEN_ADMIN" != null ] || { echo "seed/admin: sin JWT de ADMIN" >&2; exit 1; }
ID_ADMIN="$(seed_customer_id "$CORREO_ADMIN")"

# Clienta DEL admin: `created_by` apunta al ADMIN, que es lo que la regla de alcance mira.
TOKEN_PROPIA="$(seed_usuario "$CORREO_PROPIA" "Propia")"
seed_sql "UPDATE customer SET created_by = $ID_ADMIN WHERE email = '$CORREO_PROPIA';" >/dev/null
INV_PROPIA="$(seed_invitacion "$TOKEN_PROPIA")"

# Clienta AJENA: sin `created_by`, así que ese ADMIN no debe verla ni contarla.
TOKEN_AJENO="$(seed_usuario "$CORREO_AJENO" "Ajena")"
INV_AJENA="$(seed_invitacion "$TOKEN_AJENO")"

printf 'SEED_ADMIN_EMAIL=%q\nSEED_ADMIN_TOKEN=%q\nSEED_ADMIN_ADMIN_EMAIL=%q\nSEED_ADMIN_ADMIN_TOKEN=%q\nSEED_ADMIN_ADMIN_ID=%q\nSEED_ADMIN_PROPIA_EMAIL=%q\nSEED_ADMIN_PROPIA_TOKEN=%q\nSEED_ADMIN_INVITACION_PROPIA=%q\nSEED_ADMIN_AJENO_EMAIL=%q\nSEED_ADMIN_AJENO_TOKEN=%q\nSEED_ADMIN_INVITACION_AJENA=%q\n' \
  "$CORREO_MASTER" "$TOKEN_MASTER" \
  "$CORREO_ADMIN" "$TOKEN_ADMIN" "$ID_ADMIN" \
  "$CORREO_PROPIA" "$TOKEN_PROPIA" "$INV_PROPIA" \
  "$CORREO_AJENO" "$TOKEN_AJENO" "$INV_AJENA"
