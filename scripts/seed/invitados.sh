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

# HISTORIA DE ESTE FICHERO, que conviene conservar porque explica por qué existe la superficie nueva.
# Los cimientos de la fase 5 (E1) tuvieron que sembrar con un MASTER, y lo dejaron escrito: **una
# clienta no podía dar de alta a sus propios invitados por ninguna ruta permitida**. La única
# superficie estaba bajo `/admin/**`, que `SecurityConfig.kt:42` reserva a ADMIN y MASTER, y su
# gemela para el rol USER vivía en `modules/user/invitations`, área prohibida hasta la fase 7.
#
# Esa superficie ya existe: la construyó E2 en `modules/product/guests/panel`, con autorización por
# **propiedad de la invitación**. Así que esta siembra usa **un solo token, el de la clienta**, y de
# paso es una prueba de humo del camino real: si el alta de invitados dejara de funcionar para el
# rol USER, este script falla antes que ningún spec.
SUF="$(seed_sufijo)"
CORREO="cliente-invitados-$SUF@example.com"
TOKEN="$(seed_usuario "$CORREO" "Ana")"
[ -n "$TOKEN" ] && [ "$TOKEN" != null ] || { echo "seed/invitados: sin JWT de la clienta" >&2; exit 1; }
INV="$(seed_invitacion "$TOKEN")"

# Alta por la ruta del producto, con el token de la propia clienta. `comun.sh` no se toca (es el
# único punto compartido entre las cuatro sesiones y por eso es el que no puede tener conflictos),
# así que la llamada se escribe aquí con su ayudante genérico.
seed_invitado_del_producto() {
  local token="$1" invitacion="$2" nombre="$3" correo="$4" adultos="$5" ninos="$6" jovenes="$7"
  seed_llamar POST "/product/invitations/$invitacion/guests" \
    -H "Authorization: Bearer $token" -H 'Content-Type: application/json' \
    -d "$(jq -nc --arg n "$nombre" --arg e "$correo" \
      --argjson a "$adultos" --argjson c "$ninos" --argjson y "$jovenes" \
      '{fullName:$n, email:$e, adults:$a, children:$c, young:$y}')"
}

PRIMER_ID=""
for fila in "Ana y Diego López:2:0:0" "Familia Ruiz:2:3:0" "Sofía Márquez:1:0:1"; do
  IFS=: read -r nombre a c y <<< "$fila"
  cod="$(seed_invitado_del_producto "$TOKEN" "$INV" "$nombre" \
    "inv-$(echo "$nombre" | tr ' A-Z' '-a-z')-$SUF@example.com" "$a" "$c" "$y")"
  case "$cod" in
    200|201) : ;;
    *) echo "seed/invitados: alta de «$nombre» → HTTP $cod: $(cat "$SEED_TMP/r.json")" >&2; exit 1 ;;
  esac
  [ -n "$PRIMER_ID" ] || PRIMER_ID="$(seed_j '.id')"
done

# El enlace personal del primer invitado, por la ÚNICA ruta que revela un token (S-13: los listados
# del panel ya no lo llevan). Se pide aquí para que un spec del invitado no tenga que ir a la base
# de datos a buscarlo, que sería enseñar a hacer justo lo que el producto no hace.
#
# AVISO para quien escriba e2e de `/r/[token]`: esta invitación se inserta por SQL y **no tiene
# release activo**, así que `GET /public/r/<token>` responderá `404` — y es lo correcto, no un fallo.
# Para el camino feliz del invitado hace falta una invitación publicada: úsala con
# `crearInvitacionPublicable(token)` de `e2e/preparar-panel.ts` y da de alta los invitados con
# `POST /product/invitations/{id}/guests`, que es lo que hace este script.
ENLACE=""
if [ -n "$PRIMER_ID" ] && [ "$PRIMER_ID" != null ]; then
  if [ "$(seed_llamar GET "/product/invitations/$INV/guests/$PRIMER_ID/link" \
        -H "Authorization: Bearer $TOKEN")" = 200 ]; then
    ENLACE="$(seed_j '.url')"
  fi
fi

seed_llamar GET "/product/invitations/$INV/guests" -H "Authorization: Bearer $TOKEN" >/dev/null
printf 'SEED_INVITADOS_EMAIL=%q\nSEED_INVITADOS_TOKEN=%q\nSEED_INVITADOS_INVITACION=%q\nSEED_INVITADOS_PRIMER_ID=%q\nSEED_INVITADOS_ENLACE=%q\nSEED_INVITADOS_TOTAL=%q\n' \
  "$CORREO" "$TOKEN" "$INV" "$PRIMER_ID" "$ENLACE" "$(seed_j '(.content // .data // .) | length')"
