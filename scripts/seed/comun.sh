#!/usr/bin/env bash
# scripts/seed/comun.sh — BIBLIOTECA de siembra de la fase 5. No se ejecuta sola: se hace `source`.
#
# POR QUÉ EXISTE (ADR-5-E1-03). La issue I-CI-01 dejó el job `e2e` del CI pasando solo con
# `--workers=1`. La causa no era el reloj: varios specs usaban LA MISMA invitación de
# `scripts/seed-demo.sh` y se pisaban al correr en paralelo. La regla de la fase 5 es que **cada
# spec crea sus propios datos**, y para que eso no cueste doscientas líneas por spec, aquí están
# las cuatro operaciones que todos necesitan, parametrizadas y con sufijo único.
#
# `seed-demo.sh` NO cambia y NO se toca: es la demostración que el dueño abre para juzgar el
# resultado visual. Esto es otra cosa: el andamio de las pruebas.
#
# USO
#   source scripts/seed/comun.sh
#   seed_requiere_backend                       # aborta con mensaje claro si no hay backend
#   SUF="$(seed_sufijo)"                        # p. ej. 7f3a1c-4821
#   TOKEN="$(seed_usuario "cliente-$SUF@example.com")"
#   INV="$(seed_invitacion "$TOKEN")"           # invitación propia, is_paid=false
#   seed_invitado "$TOKEN" "$INV" "Ana López" "ana-$SUF@example.com" 2 0 0
#
# CADA SESIÓN ESCRIBE SU PROPIO `scripts/seed/<area>.sh` y NUNCA edita este fichero ni los de otra
# área: `invitados.sh` (E2), `cuenta.sh` (E3), `plan.sh` (E4), `admin.sh` (E5).
set -uo pipefail

SEED_RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SEED_BASE="${TPL_DEV_BASE:-http://127.0.0.1:6003}"
SEED_PGBIN="${TPL_TEST_PGBIN:-/usr/lib/postgresql/16/bin}"
SEED_ESTADO="${TPL_TEST_STATE_DIR:-/tmp/templates2-pg}/state.env"
SEED_DB="${TPL_DEV_DB:-invitaciones_dev}"
SEED_PASS="${TPL_SEED_PASS:-Demo1234!}"
SEED_TMP="$(mktemp -d)"
trap 'rm -rf "$SEED_TMP"' EXIT

# Aborta si falta el entorno, con el comando exacto que lo arregla. Nunca sigue a ciegas.
seed_requiere_backend() {
  if ! curl -sS -o /dev/null --max-time 5 "$SEED_BASE/public/i/x/exists" 2>/dev/null; then
    echo "seed: el backend no responde en $SEED_BASE. Arranca antes: scripts/dev-backend.sh start" >&2
    return 2
  fi
  if [ ! -f "$SEED_ESTADO" ]; then
    echo "seed: no encuentro el clúster efímero ($SEED_ESTADO). Arranca antes: scripts/dev-backend.sh start" >&2
    return 2
  fi
  # shellcheck disable=SC1090
  SEED_PGPORT="$( . "$SEED_ESTADO"; echo "$TPL_TEST_PGPORT" )"
  export SEED_PGPORT
}

# Sufijo único por llamada. `$$` (pid) más aleatorio: dos workers de Playwright arrancados en el
# mismo segundo son pids distintos, y el aleatorio cubre el caso de dos procesos con el mismo pid en
# contenedores distintos contra la misma base.
seed_sufijo() { printf '%s-%s' "$$" "$(od -An -N3 -tx1 /dev/urandom | tr -d ' \n')"; }

seed_sql() {
  "$SEED_PGBIN/psql" -h 127.0.0.1 -p "$SEED_PGPORT" -U postgres -d "$SEED_DB" \
    -v ON_ERROR_STOP=1 -Atqc "$1"
}

seed_llamar() {
  local metodo="$1" ruta="$2"; shift 2
  curl -sS -o "$SEED_TMP/r.json" -w '%{http_code}' -X "$metodo" "$SEED_BASE$ruta" "$@"
}

seed_j() { jq -r "$1" < "$SEED_TMP/r.json"; }

# --------------------------------------------------------------------------------- cuentas
# Da de alta un USER y devuelve su JWT por stdout. Idempotente: si el correo ya existe, el signup
# falla en silencio y el token se pide igual. Mismo camino HTTP que `seed-demo.sh`.
# El TELÉFONO tiene que ser único: `POST /auth/signup` rechaza con 400 «Este número de teléfono no
# se encuentra disponible» si ya existe (verificado contra el backend real). Por eso el valor por
# defecto se DERIVA del correo en vez de estar escrito: dos specs en paralelo que sembraran el mismo
# número se romperían el uno al otro, que es justo lo que esta biblioteca existe para evitar.
# El formato REAL es `+52` seguido de diez dígitos (`Patterns.kt:56`, `^\+52\d{10}$`), no diez
# dígitos a secas: el mensaje de error del backend dice «10 digitos numéricos» y omite el prefijo,
# lo que hace fallar el intento evidente. Queda anotado como hallazgo para E3 en
# `memoria/preguntas-abiertas.md`.
seed_telefono_de() {
  printf '+5255%08d' "$(( 0x$(printf '%s' "$1" | md5sum | cut -c1-7) % 100000000 ))"
}

seed_usuario() {
  local email="$1" nombre="${2:-Prueba}" tel="${3:-$(seed_telefono_de "$1")}"
  curl -sS -o /dev/null -X POST "$SEED_BASE/auth/signup" -H 'Content-Type: application/json' \
    -d "$(jq -nc --arg e "$email" --arg n "$nombre" --arg t "$tel" --arg p "$SEED_PASS" \
      '{name:$n,lastName:"Prueba",email:$e,phone:$t,birthdate:null,address:null,city:null,
        postalCode:null,state:null,howKnow:null,password:$p}')"
  curl -sS -o "$SEED_TMP/auth" -X POST "$SEED_BASE/auth/token" -H 'Content-Type: application/json' \
    -d "$(jq -nc --arg e "$email" --arg p "$SEED_PASS" '{email:$e,password:$p}')"
  jq -r '.accessToken' < "$SEED_TMP/auth"
}

# Da de alta un MASTER y devuelve su JWT. El rol NO se puede pedir por `/auth/signup` —siempre crea
# USER (`CustomerService.kt:81`)— y la ruta que crea administradores exige ya ser MASTER: se promueve
# por SQL, que es la única vía en un entorno recién creado. Igual que `seed-demo.sh`, y dicho aquí
# con todas las letras para que nadie crea que hay un atajo por la API.
seed_master() {
  local email="$1"
  seed_usuario "$email" "Master" >/dev/null
  seed_sql "UPDATE customer SET role = 'MASTER' WHERE email = '$email';" >/dev/null
  seed_usuario "$email" "Master"
}

seed_customer_id() { seed_sql "SELECT id FROM customer WHERE email = '$1';"; }

# --------------------------------------------------------------------------- invitación propia
# Crea una invitación NUEVA para ese cliente y devuelve su id. Nunca reutiliza una existente: eso es
# justo lo que rompió I-CI-01.
#
# Por SQL y no por HTTP porque `uses_templates2` no tiene ruta que la active (ADR-2-4-02): templates2
# no crea invitaciones, eso es del módulo antiguo, que es área prohibida. Se rellenan TODAS las
# columnas booleanas y `total_amount`: son NULLABLE en la tabla pero `InvitationEntity` las mapea a
# primitivos de Kotlin, y un NULL convierte cualquier ruta del editor en 500 (defecto preexistente,
# `bitacora/3-0a.md`).
#
# `children_allowed` y `young_allowed` van en **true**, a diferencia de la invitación de
# `seed-demo.sh`: el backend rechaza con 400 «No se permiten agregar invitados con niños a esta
# invitación» si se intenta sembrar un invitado con `childrenCount > 0` sobre una invitación que no
# los admite (verificado). Una invitación de pruebas tiene que poder recibir los tres tipos de cupo;
# el spec que quiera probar el rechazo cambia la columna a mano y lo dice.
#
# `is_paid` es parámetro y por defecto **false**: la puerta de publicación de la fase 5
# (ADR-5-0B-01) exige plan pagado para publicar, y un spec que quiera probar el bloqueo necesita
# nacer sin pagar. Pásale `true` para el caso contrario.
seed_invitacion() {
  local token="$1" pagada="${2:-false}" fecha="${3:-2027-04-18}"
  # El id del cliente sale del propio JWT: así la invitación es SIEMPRE de quien pide, y dos specs
  # en paralelo no pueden acabar compartiendo dueño por una consulta mal acotada.
  local cid; cid="$(seed_cliente_del_token "$token")"
  [ -n "$cid" ] || { echo "seed_invitacion: no pude resolver el cliente del token" >&2; return 1; }
  seed_sql "INSERT INTO invitation (customer_id, template_id, is_enabled, is_paid, is_finished,
      all_events_same_location, uses_templates2, date, time, hashtag, cover_photo_url,
      children_allowed, young_allowed, has_music, has_gallery, has_extra_modules, total_amount,
      created_at, updated_at)
    VALUES ($cid, 5, true, $pagada, false, false, true, '$fecha', '17:00', '#Prueba', '',
      true, true, true, true, true, 0, now(), now()) RETURNING id;"
}

# El id del cliente sale del propio JWT. VERIFICADO contra un token real emitido por
# `POST /auth/token`: el `sub` es el **id numérico** del cliente (`{"sub":"14",…,"email":"…"}`), no
# el correo; el correo va en su propia reclamación. Se lee `sub` cuando es numérico y se cae a
# resolver por `email` si algún día cambia el formato — así el ayudante no se rompe en silencio.
#
# El payload se decodifica en base64url SIN verificar la firma: aquí no se toma ninguna decisión de
# seguridad, solo se lee un dato de un token que este mismo script acaba de pedir.
seed_cliente_del_token() {
  local carga json sub correo
  carga="$(printf '%s' "$1" | cut -d. -f2)"
  case $(( ${#carga} % 4 )) in 2) carga="$carga==";; 3) carga="$carga=";; esac
  json="$(printf '%s' "$carga" | tr '_-' '/+' | base64 -d 2>/dev/null)" || return 1
  sub="$(printf '%s' "$json" | jq -r '.sub // empty')"
  if [[ "$sub" =~ ^[0-9]+$ ]]; then printf '%s' "$sub"; return 0; fi
  correo="$(printf '%s' "$json" | jq -r '.email // empty')"
  [ -n "$correo" ] || return 1
  seed_customer_id "$correo"
}

# ------------------------------------------------------------------------------------ invitados
# Añade un invitado por la ruta HTTP real. Devuelve el código HTTP por stdout.
# `graduatesName` es obligatorio en el DTO aunque casi nunca aplique: se manda vacío.
seed_invitado() {
  local token="$1" invitacion="$2" nombre="$3" correo="$4"
  local adultos="${5:-2}" ninos="${6:-0}" jovenes="${7:-0}" mesa="${8:-null}"
  seed_llamar POST "/admin/invitations/$invitacion/guests/append" \
    -H "Authorization: Bearer $token" -H 'Content-Type: application/json' \
    -d "$(jq -nc --arg n "$nombre" --arg e "$correo" \
      --argjson a "$adultos" --argjson c "$ninos" --argjson y "$jovenes" --argjson m "$mesa" \
      '{fullName:$n, email:$e, graduatesName:"", phone:"5512340000",
        adultsCount:$a, childrenCount:$c, youngCount:$y, tableNumber:$m, whatsappSent:false}')"
}

# Lista los invitados de una invitación; deja el cuerpo en `$SEED_TMP/r.json` para `seed_j`.
seed_invitados_de() {
  seed_llamar GET "/admin/invitations/$2/guests" -H "Authorization: Bearer $1"
}
