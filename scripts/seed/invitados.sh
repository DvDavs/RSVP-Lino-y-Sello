#!/usr/bin/env bash
# scripts/seed/invitados.sh — siembra del área de INVITADOS y RSVP. Dueña: sesión E2.
#
# Deja una clienta con UNA invitación propia y tres invitados en estados distintos, para que un spec
# de e2e tenga algo que enseñar sin depender de la invitación de `seed-demo.sh` (ADR-5-E1-03).
#
#   scripts/seed/invitados.sh            # imprime las variables del caso sembrado
#   eval "$(scripts/seed/invitados.sh)"  # y las deja en el entorno
set -uo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/comun.sh"
seed_requiere_backend || exit 2

# HALLAZGO, y es el motivo de que aquí haga falta un MASTER: **hoy una clienta NO puede dar de alta
# a sus propios invitados por ninguna ruta permitida**. La única superficie de invitados que existe
# está bajo `/admin/**`, que `SecurityConfig.kt:42` reserva a ADMIN y MASTER; la gemela para USER
# vive en `/user/invitations/{id}/guests`, es decir, dentro de `modules/user/invitations`, que es
# **área prohibida** hasta que se retire en la fase 7 (`AdminGuestsController.kt:30-31` lo dice por
# escrito). Sembrar con el token de la clienta devuelve `403 Access Denied`, verificado.
#
# Construir esa superficie para el rol USER, en `modules/product/guests`, es trabajo de **E2**.
# Mientras no exista, esta siembra usa un MASTER para poner los invitados en la invitación de la
# clienta; en cuanto E2 la tenga, esto se simplifica a un solo token y este comentario se borra.
SUF="$(seed_sufijo)"
CORREO="cliente-invitados-$SUF@example.com"
TOKEN="$(seed_usuario "$CORREO" "Ana")"
[ -n "$TOKEN" ] && [ "$TOKEN" != null ] || { echo "seed/invitados: sin JWT de la clienta" >&2; exit 1; }
TOKEN_MASTER="$(seed_master "master-invitados-$SUF@example.com")"
[ -n "$TOKEN_MASTER" ] && [ "$TOKEN_MASTER" != null ] || { echo "seed/invitados: sin JWT de MASTER" >&2; exit 1; }
INV="$(seed_invitacion "$TOKEN")"

for fila in "Ana y Diego López:2:0:0" "Familia Ruiz:2:3:0" "Sofía Márquez:1:0:1"; do
  IFS=: read -r nombre a c y <<< "$fila"
  cod="$(seed_invitado "$TOKEN_MASTER" "$INV" "$nombre" "inv-$(echo "$nombre" | tr ' A-Z' '-a-z')-$SUF@example.com" "$a" "$c" "$y")"
  [ "$cod" = 200 ] || { echo "seed/invitados: alta de «$nombre» → HTTP $cod: $(cat "$SEED_TMP/r.json")" >&2; exit 1; }
done

seed_invitados_de "$TOKEN_MASTER" "$INV" >/dev/null
printf 'SEED_INVITADOS_EMAIL=%q\nSEED_INVITADOS_TOKEN=%q\nSEED_INVITADOS_MASTER_TOKEN=%q\nSEED_INVITADOS_INVITACION=%q\nSEED_INVITADOS_TOTAL=%q\n' \
  "$CORREO" "$TOKEN" "$TOKEN_MASTER" "$INV" "$(seed_j '(.data // .content // .) | length')"
