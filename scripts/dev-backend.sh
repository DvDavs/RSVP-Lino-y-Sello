#!/usr/bin/env bash
# scripts/dev-backend.sh — levanta TODA la aplicación (no un contexto acotado) con un solo comando,
# sobre el PostgreSQL efímero de `scripts/pg-ephemeral.sh`, y espera activamente a que responda.
#
# Bloque 3-0a de la fase 3. Antes de él la aplicación completa no arrancaba: `InvitationGuestEntity`
# mapea `invitation_guest.graduates_name`, columna que ninguna migración creaba, con
# `ddl-auto: validate` (ADR-2-ORQ-02). Lo desbloquea `V40__add_invitation_guest_graduates_name.sql`.
#
#   scripts/dev-backend.sh start     # arranca (idempotente: si ya responde, no hace nada)
#   scripts/dev-backend.sh stop      # para el backend y el clúster efímero
#   scripts/dev-backend.sh status    # 0 si el backend responde
#   scripts/dev-backend.sh restart
#   scripts/dev-backend.sh env       # imprime las variables para hacer `eval $(… env)` en otro shell
#   scripts/dev-backend.sh register <dir>   # registra un paquete de plantilla con el backend PARADO
#                                           # (`--templates2.register.*` de handoffs/2-3.md)
#
# Variables que puedes fijar antes de llamar:
#   TPL_DEV_PORT           puerto HTTP del backend           (por defecto 6003, el de application.yml)
#   TEMPLATES2_ASSETS_BUCKET  bucket declarado                (por defecto templates2-dev-local)
#   TEMPLATES2_ASSETS_MODE    's3' o 'local'                  (por defecto local, ver más abajo)
#   TPL_DEV_LOG            archivo de log                     (por defecto build/dev/backend.log)
#   TPL_DEV_TIMEOUT        segundos de espera del arranque    (por defecto 300)
#   TPL_DEV_FRONTEND_URL   origen de `apps/web` para el webhook de revalidación (por defecto
#                          http://127.0.0.1:3000, el puerto de `next start`; usa TPL_DEV_FRONTEND_URL
#                          o PW_PORT si tu `apps/web` escucha en otro puerto, p.ej. Playwright)
#   TEMPLATES2_REVALIDATE_TOKEN  secreto compartido con `REVALIDATE_SECRET` de `apps/web`
#                          (por defecto un valor DE DESARROLLO, nunca uses este valor en producción)
#
# Secretos que `application.yml` exige y ya NO tienen valor por defecto (fase 5, ADR-5-E3-A3-01):
#   JWT_SECRET             clave de firma de los tokens de sesión
#   AWS_ACCESS_KEY_ID      credencial de AWS
#   AWS_SECRET_ACCESS_KEY  secreto de esa credencial
#   MAIL_USERNAME          cuenta del buzón transaccional
#   MAIL_PASSWORD          contraseña de aplicación de ese buzón
# Este script las define con valores DE DESARROLLO, evidentemente falsos, para que arrancar en local
# siga siendo un solo comando. Sin ellas el arranque falla y dice cuáles faltan
# (`core/config/SecretosObligatorios.kt`). Exporta las tuyas antes de llamar si necesitas otras.
#
# WhatsApp NO se define aquí a propósito (fase 5, ADR-5-E3-C3-01). Sus dos secretos
# —WHATSAPP_ACCESS_TOKEN y WHATSAPP_WEBHOOK_VERIFY_TOKEN— también salieron del repositorio, pero
# **no impiden el arranque**: vacío significa canal apagado, y en desarrollo apagado es lo correcto
# (hoy WhatsApp es solo click-to-chat, `decisiones-dueno.md` D-04). Con el canal apagado
# `/api/whatsapp/send-masivo` y `/webhook` responden 503 y no se llama a Meta. Si necesitas
# ejercitarlo contra Meta, expórtalos tú: este script nunca llevará valores de WhatsApp escritos.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

PUERTO="${TPL_DEV_PORT:-6003}"
LOG="${TPL_DEV_LOG:-$RAIZ/build/dev/backend.log}"
PIDFILE="${TPL_DEV_PIDFILE:-$RAIZ/build/dev/backend.pid}"
TIMEOUT="${TPL_DEV_TIMEOUT:-300}"
BASE="http://127.0.0.1:$PUERTO"
DB="${TPL_DEV_DB:-invitaciones_dev}"

# --- Secretos de `application.yml` (fase 5, ADR-5-E3-A3-01) -----------------------------------
# Los cuatro secretos que estaban en claro en `application.yml` (clave JWT, par de AWS, cuenta y
# contraseña del correo) son ahora `${VAR}` SIN valor por defecto: la aplicación no arranca sin
# ellos. Aquí se declaran valores DE DESARROLLO y se eligen de forma que su falsedad se vea a
# simple vista; ninguno se parece a un valor real ni funciona contra ningún servicio.
#
#   JWT_SECRET   es un valor FIJO, no uno generado en cada arranque: generarlo al vuelo invalidaría
#                los tokens que las pruebas y los scripts de siembra acaban de obtener en cuanto el
#                backend se reiniciara. 64 caracteres porque `JwtUtil.kt:18` lo usa tal cual como
#                clave HMAC de HS256 (mínimo 32). Vale sólo para este entorno local.
#   AWS_*        credenciales INSERVIBLES a propósito: este script trabaja con
#                TEMPLATES2_ASSETS_MODE=local (ver abajo), que escribe en disco y no llama a AWS.
#                Si fuerzas `s3`, exporta credenciales de verdad tú mismo — aquí nunca irán.
#   MAIL_*       igual: no hay SMTP en este entorno. Desde ADR-5-E3-A4-01 estas dos SÍ mandan de
#                verdad: `core/email/MailConfig.kt` (que fijaba servidor y credenciales en el código
#                y hacía que `spring.mail.*` no lo leyera nadie) ya no existe, y el `JavaMailSender`
#                lo construye Spring Boot desde `application.yml`. Consecuencia deseada: con estos
#                valores falsos un envío de correo desde este entorno FALLA en la autenticación en
#                vez de salir de verdad desde el buzón de la empresa, que es lo que pasaba antes.
export JWT_SECRET="${JWT_SECRET:-clave-jwt-solo-de-desarrollo-no-sirve-en-ningun-otro-sitio-0000}"
export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-credencial-aws-de-desarrollo-inservible}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-secreto-aws-de-desarrollo-inservible}"
export MAIL_USERNAME="${MAIL_USERNAME:-correo-de-desarrollo@ejemplo.invalido}"
export MAIL_PASSWORD="${MAIL_PASSWORD:-contrasena-de-correo-de-desarrollo-inservible}"

# --- Bucket de assets -------------------------------------------------------------------------
# OBLIGATORIA y sin defecto en `application.yml` (ADR-2-ORQ-03) porque el único defecto natural era
# el bucket de PRODUCCIÓN. Aquí se declara un nombre de PRUEBAS explícito y se comprueba que nadie
# haya exportado el de producción: escribir ahí desde un entorno de desarrollo es inaceptable.
export TEMPLATES2_ASSETS_BUCKET="${TEMPLATES2_ASSETS_BUCKET:-templates2-dev-local}"
BUCKET_DE_PRODUCCION="invitacionesdigitalesassets"
if [ "$TEMPLATES2_ASSETS_BUCKET" = "$BUCKET_DE_PRODUCCION" ]; then
  echo "dev-backend: NO. TEMPLATES2_ASSETS_BUCKET apunta al bucket de PRODUCCIÓN ($BUCKET_DE_PRODUCCION)." >&2
  echo "             Este script es de desarrollo y nunca escribe ahí. Cambia la variable." >&2
  exit 2
fi

# --- Modo de assets ---------------------------------------------------------------------------
# `s3` es el valor por defecto de `application.yml`; aquí el defecto es `local` (ADR-3-0a-02) porque
# en este entorno no hay ningún bucket de S3 utilizable: con `s3` toda subida devuelve
# `502 TPL_ASSET_STORAGE_UNAVAILABLE` (evidencia en bitacora/3-0a.md). Fuerza `s3` si tienes bucket:
#   TEMPLATES2_ASSETS_MODE=s3 scripts/dev-backend.sh start
export TEMPLATES2_ASSETS_MODE="${TEMPLATES2_ASSETS_MODE:-local}"
export TEMPLATES2_ASSETS_LOCAL_DIR="${TEMPLATES2_ASSETS_LOCAL_DIR:-$RAIZ/build/templates2-assets}"
export TEMPLATES2_ASSETS_LOCAL_BASE_URL="${TEMPLATES2_ASSETS_LOCAL_BASE_URL:-$BASE/public/templates2-assets}"
if [ "$TEMPLATES2_ASSETS_MODE" = "local" ]; then
  # `AssetUrlResolver` construye "{public-base-url}/{s3_key}" (`02 §10.4`): en modo local tiene que
  # apuntar al propio backend, o el `composed` traería URL de un bucket que no existe.
  export TEMPLATES2_ASSETS_PUBLIC_BASE_URL="${TEMPLATES2_ASSETS_PUBLIC_BASE_URL:-$TEMPLATES2_ASSETS_LOCAL_BASE_URL}"
fi

# --- Revalidación del render público (I-07, ADR-2-6-01, ADR-3-8-04) ---------------------------
# `templates2.revalidate.url`/`.token` (`RevalidationNotifier.kt`) llegan VACÍAS de
# `application.yml` a propósito (ADR-2-6-01: sin host por defecto). Sin ellas el webhook queda
# desactivado y el enlace público sólo se corrige con el `max-age` de 300 s (`contratos.md §8`,
# issue I-07, U-5). Aquí sí puede ir un valor de desarrollo — nunca en `application.yml` — porque
# este script es exclusivamente de entorno local.
# `TPL_DEV_FRONTEND_URL` apunta a `apps/web`: 3000 es el puerto de `next start` sin nada más
# declarado; con Playwright, pásalo (o exporta PW_PORT) para que el webhook golpee ESE servidor.
TPL_DEV_FRONTEND_URL="${TPL_DEV_FRONTEND_URL:-http://127.0.0.1:${PW_PORT:-3000}}"
export TEMPLATES2_REVALIDATE_URL="${TEMPLATES2_REVALIDATE_URL:-$TPL_DEV_FRONTEND_URL/api/revalidate}"
# Mismo valor por defecto que `playwright.config.ts` ya usa para `REVALIDATE_SECRET`
# (`app/api/revalidate/route.ts`): así el backend y `apps/web` quedan cableados con el MISMO
# secreto sin que nadie tenga que exportar nada a mano para que las e2e midan el webhook real.
# Evidentemente de desarrollo: no es apto para ningún entorno con tráfico real.
export TEMPLATES2_REVALIDATE_TOKEN="${TEMPLATES2_REVALIDATE_TOKEN:-e2e-secreto-de-pruebas}"

# --- Mongo ------------------------------------------------------------------------------------
# `templates2` no usa Mongo (ADR-009) pero `MongoDataInitializer` es un `CommandLineRunner` del
# módulo antiguo que siembra al arrancar. No hay `mongod` en este entorno; el sembrador captura sus
# propias excepciones (`MongoDataInitializer.kt:88,113`) así que NO tumba el arranque, pero con el
# tiempo de selección de servidor por defecto (30 s × 16 operaciones) tardaría ~8 minutos. Se
# recorta a 250 ms: el arranque queda en segundos y los errores siguen apareciendo en el log.
export SPRING_DATA_MONGODB_URI="${SPRING_DATA_MONGODB_URI:-mongodb://localhost:27017/invitaciones?serverSelectionTimeoutMS=250&connectTimeoutMS=250}"

# "Responde" = Tomcat contesta CUALQUIER código HTTP. No se elige una ruta concreta a propósito:
# la sonda no debe depender de que esa ruta esté bien, sólo de que el servidor esté escuchando.
responde() {
  local codigo
  codigo="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 "$BASE/public/i/sonda/exists" 2>/dev/null)" || return 1
  [ -n "$codigo" ] && [ "$codigo" != "000" ]
}

arrancar_postgres() {
  # `pg-ephemeral.sh start` EXPORTA sus variables en el shell que hace `source` — pero también
  # define funciones llamadas `start`, `stop` y `status`, que PISARÍAN las de este script. Por eso
  # se hace el `source` en un subshell y sólo se importan de vuelta las tres variables.
  local vars
  vars="$(bash -c "source '$RAIZ/scripts/pg-ephemeral.sh' start >/dev/null 2>&1
    printf 'TPL_TEST_PGPORT=%s\nTPL_TEST_PGDATA=%s\nTPL_TEST_JDBC_URL=%s\n' \
      \"\$TPL_TEST_PGPORT\" \"\$TPL_TEST_PGDATA\" \"\$TPL_TEST_JDBC_URL\"")"
  eval "$(printf '%s\n' "$vars" | sed 's/^/export /')"
  if [ -z "${TPL_TEST_PGPORT:-}" ]; then
    echo "dev-backend: pg-ephemeral.sh no arrancó ningún clúster" >&2
    return 1
  fi
  local puerto="$TPL_TEST_PGPORT"
  local pgbin="${TPL_TEST_PGBIN:-/usr/lib/postgresql/16/bin}"

  # V1__initial_schema.sql hace `ALTER TABLE … OWNER TO evolution`: sin ese rol Flyway falla con
  # `ERROR: role "evolution" does not exist`. Es un requisito del volcado original, no del módulo.
  "$pgbin/psql" -h 127.0.0.1 -p "$puerto" -U postgres -d postgres -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'evolution') THEN
    CREATE ROLE evolution LOGIN SUPERUSER PASSWORD 'evolution123';
  END IF;
END \$\$;
SQL
  if ! "$pgbin/psql" -h 127.0.0.1 -p "$puerto" -U postgres -d postgres -Atqc \
      "SELECT 1 FROM pg_database WHERE datname = '$DB'" | grep -q 1; then
    "$pgbin/createdb" -h 127.0.0.1 -p "$puerto" -U postgres -O evolution "$DB"
  fi

  # Flyway lo ejecuta el propio arranque (`spring.flyway.enabled: true`, `application.yml:35`):
  # no hace falta invocarlo aparte, y hacerlo dos veces sería peor.
  export SPRING_DATASOURCE_URL="jdbc:postgresql://127.0.0.1:$puerto/$DB"
  export SPRING_DATASOURCE_USERNAME="evolution"
  export SPRING_DATASOURCE_PASSWORD="evolution123"
  export TPL_DEV_PGPORT="$puerto"
}

start() {
  if responde; then
    echo "dev-backend: ya responde en $BASE (idempotente, no hago nada)"
    imprimir_resumen
    return 0
  fi
  mkdir -p "$(dirname "$LOG")"
  arrancar_postgres
  : > "$LOG"
  echo "dev-backend: compilando y arrancando… (log: $LOG)" >&2
  # `--console=plain` y sin daemon: el log queda legible y `stop` mata un árbol de procesos pequeño.
  # `--args=--server.port` es OBLIGATORIO, no un adorno: sin él `bootRun` toma el puerto de
  # `application.yml` (6003) y `TPL_DEV_PORT` sólo movía la sonda, así que dos instancias con
  # puertos "distintos" peleaban las dos por el 6003 — medido en la fase 3-B, donde una instancia
  # de un agente se quedó con el 6003 de otro y sirvió una base sin sembrar.
  nohup ./gradlew bootRun --console=plain --no-daemon \
      --args="--server.port=$PUERTO" \
      -Dorg.gradle.jvmargs=-Xmx1g >>"$LOG" 2>&1 &
  echo $! > "$PIDFILE"
  local pid; pid="$(cat "$PIDFILE")"

  # Espera ACTIVA: se sondea el puerto, no se duerme un tiempo fijo. Se aborta en cuanto el proceso
  # muere o el log dice que el arranque falló, para no esperar el tope entero ante un fallo obvio.
  local t=0
  while [ "$t" -lt "$TIMEOUT" ]; do
    if responde; then
      echo
      echo "dev-backend: ARRIBA en $BASE (PID $pid, ${t}s)"
      grep -aoE "Started InvitationsApplicationKt in [0-9.]+ seconds \(process running for [0-9.]+\)" "$LOG" | tail -1 || true
      imprimir_resumen
      return 0
    fi
    if ! kill -0 "$pid" 2>/dev/null; then
      echo >&2
      echo "dev-backend: el proceso murió durante el arranque. Últimas líneas del log:" >&2
      tail -40 "$LOG" >&2
      return 1
    fi
    if grep -qa "APPLICATION FAILED TO START\|Application run failed" "$LOG"; then
      echo >&2
      echo "dev-backend: el arranque FALLÓ. Últimas líneas del log:" >&2
      tail -40 "$LOG" >&2
      # NO se llama a `stop`: hace `pkill -f InvitationsApplicationKt` y un arranque fallido aquí
      # mataría los backends de las demás sesiones de la máquina (ocurrió en la fase 3-B). Se mata
      # sólo el árbol propio, que es lo único que este arranque ha creado.
      pkill -TERM -P "$pid" 2>/dev/null || true
      kill -TERM "$pid" 2>/dev/null || true
      rm -f "$PIDFILE"
      return 1
    fi
    printf '.' >&2
    sleep 2
    t=$((t + 2))
  done
  echo >&2
  echo "dev-backend: agotado el tope de ${TIMEOUT}s sin respuesta. Últimas líneas del log:" >&2
  tail -40 "$LOG" >&2
  return 1
}

imprimir_resumen() {
  cat <<RESUMEN

  URL          $BASE
  PID          $(cat "$PIDFILE" 2>/dev/null || echo '(desconocido)')
  Log          $LOG
  Postgres     ${SPRING_DATASOURCE_URL:-(ya en marcha; usa 'status')}
  Assets       modo=$TEMPLATES2_ASSETS_MODE bucket=$TEMPLATES2_ASSETS_BUCKET
  Revalidate   url=$TEMPLATES2_REVALIDATE_URL (token de desarrollo cableado; exporta REVALIDATE_SECRET
               con el MISMO valor al arrancar apps/web para que el webhook se acepte)
RESUMEN
}

stop() {
  if [ -f "$PIDFILE" ]; then
    local pid; pid="$(cat "$PIDFILE")"
    # `bootRun` lanza la aplicación como HIJO del proceso de Gradle: hay que matar el grupo entero,
    # o el Tomcat sigue escuchando con Gradle ya muerto.
    if kill -0 "$pid" 2>/dev/null; then
      pkill -TERM -P "$pid" 2>/dev/null || true
      kill -TERM "$pid" 2>/dev/null || true
      local t=0
      while kill -0 "$pid" 2>/dev/null && [ "$t" -lt 30 ]; do sleep 1; t=$((t + 1)); done
      pkill -KILL -P "$pid" 2>/dev/null || true
      kill -KILL "$pid" 2>/dev/null || true
    fi
    rm -f "$PIDFILE"
  fi
  # Red de seguridad, ACOTADA A NUESTRO PUERTO. Antes era `pgrep -f InvitationsApplicationKt`, que
  # mata cualquier JVM del proyecto en la máquina: con varias sesiones o agentes en paralelo, un
  # `stop` se llevaba por delante los backends de los demás (medido en la fase 3-B).
  # Hallazgo de I-07: con `set -o pipefail`, cuando NO quedan restos (el caso normal: el PID de
  # arriba ya se mató solo) `grep` no encuentra nada y sale con estado 1, lo que abortaba el script
  # entero por `set -e` ANTES de llegar a `pg-ephemeral.sh stop` de la línea siguiente — cada `stop`
  # que sí lograba matar el proceso por PID dejaba el clúster de Postgres efímero huérfano
  # (medido: el proceso `postgres -D .../data-*` seguía vivo tras un `stop` con salida 1). El
  # `|| true` de `grep` es el que falta; el de `ss` de arriba no cubre esta rama.
  local restos; restos="$( (ss -ltnpH "sport = :$PUERTO" 2>/dev/null || true) | (grep -oP 'pid=\K[0-9]+' || true) | sort -u)"
  if [ -n "$restos" ]; then kill -KILL $restos 2>/dev/null || true; fi
  "$RAIZ/scripts/pg-ephemeral.sh" stop || true
  echo "dev-backend: parado (idempotente)"
}

status() {
  if responde; then
    echo "dev-backend: EN MARCHA — $BASE (PID $(cat "$PIDFILE" 2>/dev/null || echo '?'))"
    return 0
  fi
  echo "dev-backend: parado"
  return 1
}

env_vars() {
  # Para `eval "$(scripts/dev-backend.sh env)"` desde otro shell (lo usa scripts/smoke.sh).
  local estado="${TPL_TEST_STATE_DIR:-/tmp/templates2-pg}/state.env"
  if [ -f "$estado" ]; then
    local puerto; puerto="$( . "$estado"; echo "$TPL_TEST_PGPORT" )"
    echo "export TPL_DEV_PGPORT=$puerto"
    echo "export TPL_DEV_JDBC_URL=jdbc:postgresql://127.0.0.1:$puerto/$DB"
    echo "export PGPORT_DEV=$puerto"
  fi
  echo "export TPL_DEV_BASE=$BASE"
  echo "export TEMPLATES2_ASSETS_BUCKET=$TEMPLATES2_ASSETS_BUCKET"
  echo "export TEMPLATES2_ASSETS_MODE=$TEMPLATES2_ASSETS_MODE"
  # `apps/web` necesita el MISMO valor en `REVALIDATE_SECRET` para aceptar el webhook (I-07).
  echo "export REVALIDATE_SECRET=$TEMPLATES2_REVALIDATE_TOKEN"
}

# Registro de un paquete por línea de comandos (handoffs/2-3.md). Recorre EXACTAMENTE el mismo
# servicio que `POST /master/templates2/versions` (P4: registrar una plantilla no toca Kotlin).
# Necesita el puerto libre, así que se ejecuta con el backend parado.
register() {
  local ruta="${1:-}"
  if [ -z "$ruta" ]; then echo "uso: $0 register <dir templates/<slug>/<version>/ | .zip>" >&2; exit 2; fi
  if responde; then
    echo "dev-backend: hay un backend en marcha en $BASE; párale antes de registrar por línea de comandos" >&2
    echo "             (o usa la ruta HTTP POST /master/templates2/versions con un JWT MASTER)." >&2
    exit 2
  fi
  arrancar_postgres
  mkdir -p "$(dirname "$LOG")"
  # `server.port=0` para no chocar con nada; el `ApplicationRunner` corre igual y después se sale.
  # `web-application-type=none` para no abrir puerto, y `templates2.scheduling.enabled=false` porque
  # el planificador del módulo levanta un hilo NO demonio: sin apagarlo la JVM no termina nunca
  # después de registrar (ADR-2-4-06 / ADR-2-6-02).
  ./gradlew bootRun --console=plain --no-daemon --args="\
--templates2.register.enabled=true \
--templates2.register.path=$ruta \
--spring.main.web-application-type=none \
--templates2.scheduling.enabled=false" 2>&1 | tee -a "$LOG" \
    | grep -aE "templates2: registro|templates2: (created|noop|CREATED)|Started Invitations" || true
}

case "${1:-start}" in
  start) start ;;
  stop) stop ;;
  restart) stop; start ;;
  status) status ;;
  env) env_vars ;;
  register) shift; register "$@" ;;
  *) echo "uso: $0 start|stop|restart|status|env|register <ruta>" >&2; exit 2 ;;
esac
