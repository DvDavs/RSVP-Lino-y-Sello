#!/usr/bin/env bash
# scripts/ci-backend.sh — arranca el backend para el job `e2e` de GitHub Actions y ESPERA de forma
# activa a que responda, fallando con el log a la vista si no arranca.
#
# Por qué existe (tarea «CI real en GitHub»): el job `e2e` lanzaba `./gradlew bootRun … &` dentro de
# un `run:` y luego daba por bueno el arranque pasara lo que pasara — el bucle de espera terminaba
# sin comprobar nada, así que un backend muerto se manifestaba mucho más tarde, como un 401 opaco de
# `seed-demo.sh` o como 79 e2e rojas sin causa visible. Aquí la espera se aborta en cuanto el proceso
# muere o el log dice «APPLICATION FAILED TO START», y el paso falla con las últimas líneas del log.
#
# NO sustituye a `scripts/dev-backend.sh`: ese arranca ADEMÁS el clúster efímero de
# `scripts/pg-ephemeral.sh`, que es el camino LOCAL sin Docker. En CI manda el servicio
# `postgres:16` del propio workflow (`06 §6.1`: «en CI no debe llamarse a pg-ephemeral en
# absoluto»), así que aquí solo se prepara ese servidor y se arranca la aplicación.
#
# Variables (todas con defecto utilizable):
#   TPL_DEV_PORT        puerto HTTP del backend            (6003, el de application.yml)
#   TPL_CI_PGPORT       puerto del servicio de Postgres    (55432)
#   TPL_CI_DB           base de datos de la corrida        (templates2_e2e)
#   TPL_DEV_FRONTEND_URL  origen de apps/web para el webhook de revalidación (http://127.0.0.1:3000)
#   TPL_DEV_TIMEOUT     tope de espera en segundos         (420)
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

PUERTO="${TPL_DEV_PORT:-6003}"
BASE="http://127.0.0.1:$PUERTO"
PGPORT="${TPL_CI_PGPORT:-55432}"
DB="${TPL_CI_DB:-templates2_e2e}"
LOG="${TPL_DEV_LOG:-$RAIZ/build/dev/backend-e2e.log}"
PIDFILE="${TPL_DEV_PIDFILE:-$RAIZ/build/dev/backend-e2e.pid}"
TIMEOUT="${TPL_DEV_TIMEOUT:-420}"

# `psql` en el runner de GitHub vive en /usr/bin (envoltorio de postgresql-common), no en
# /usr/lib/postgresql/16/bin, que es el defecto de los scripts locales. Se resuelve por PATH.
PGBIN="${TPL_TEST_PGBIN:-$(dirname "$(command -v psql)")}"
export PGPASSWORD="${TPL_CI_PGPASSWORD:-postgres}"

# --- Postgres del servicio: rol `evolution` y propiedad de la base -------------------------------
# `V1__initial_schema.sql` hace `ALTER TABLE … OWNER TO evolution`: sin ese rol Flyway falla con
# `role "evolution" does not exist`. El clúster efímero local lo crea `scripts/dev-backend.sh`; el
# servicio `postgres:16` de GitHub Actions no crea nada, así que se hace aquí.
"$PGBIN/psql" -h 127.0.0.1 -p "$PGPORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'evolution') THEN
    CREATE ROLE evolution LOGIN SUPERUSER PASSWORD 'evolution123';
  END IF;
END \$\$;
ALTER DATABASE $DB OWNER TO evolution;
SQL

# --- Entorno de la aplicación, el mismo que fija `scripts/dev-backend.sh` ------------------------
export SPRING_DATASOURCE_URL="jdbc:postgresql://127.0.0.1:$PGPORT/$DB"
export SPRING_DATASOURCE_USERNAME="evolution"
export SPRING_DATASOURCE_PASSWORD="evolution123"

# Assets: `TEMPLATES2_ASSETS_BUCKET` es obligatoria y sin defecto (ADR-2-ORQ-03) y no hay S3 en CI,
# así que modo local (ADR-3-0a-02), igual que en el entorno de desarrollo.
export TEMPLATES2_ASSETS_BUCKET="${TEMPLATES2_ASSETS_BUCKET:-templates2-ci-e2e}"
export TEMPLATES2_ASSETS_MODE="${TEMPLATES2_ASSETS_MODE:-local}"
export TEMPLATES2_ASSETS_LOCAL_DIR="${TEMPLATES2_ASSETS_LOCAL_DIR:-$RAIZ/build/templates2-assets}"
export TEMPLATES2_ASSETS_LOCAL_BASE_URL="${TEMPLATES2_ASSETS_LOCAL_BASE_URL:-$BASE/public/templates2-assets}"
export TEMPLATES2_ASSETS_PUBLIC_BASE_URL="${TEMPLATES2_ASSETS_PUBLIC_BASE_URL:-$TEMPLATES2_ASSETS_LOCAL_BASE_URL}"

# Revalidación del render público: sin estas dos variables el webhook queda DESACTIVADO
# (ADR-2-6-01: `application.yml` no trae host por defecto) y `e2e/render-publico.spec.ts`, que mide
# el ciclo real publicar → webhook → recargar de `04 §15.2`, mediría un 401. El token es el mismo
# valor de desarrollo que `playwright.config.ts` pasa como `REVALIDATE_SECRET`.
TPL_DEV_FRONTEND_URL="${TPL_DEV_FRONTEND_URL:-http://127.0.0.1:${PW_PORT:-3000}}"
export TEMPLATES2_REVALIDATE_URL="${TEMPLATES2_REVALIDATE_URL:-$TPL_DEV_FRONTEND_URL/api/revalidate}"
export TEMPLATES2_REVALIDATE_TOKEN="${TEMPLATES2_REVALIDATE_TOKEN:-e2e-secreto-de-pruebas}"

# Sin `mongod` en el runner: `MongoDataInitializer` (módulo antiguo) captura sus excepciones y no
# tumba el arranque, pero con el tiempo de selección por defecto lo alargaría ~8 minutos
# (`handoffs/3-0a.md` §1). Mismo recorte que hace `scripts/dev-backend.sh`.
export SPRING_DATA_MONGODB_URI="${SPRING_DATA_MONGODB_URI:-mongodb://localhost:27017/invitaciones?serverSelectionTimeoutMS=250&connectTimeoutMS=250}"

responde() {
  local codigo
  codigo="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 "$BASE/public/i/sonda/exists" 2>/dev/null)" || return 1
  [ -n "$codigo" ] && [ "$codigo" != "000" ]
}

mkdir -p "$(dirname "$LOG")"
: > "$LOG"
# Sin `--spring.profiles.active=test`: no existe `application-test.yml` ni una sola `@Profile` en
# `src/main/kotlin` (comprobado), así que el perfil no cambiaba nada; se arranca con exactamente la
# misma configuración con la que `scripts/dev-backend.sh` midió las 79/79 e2e en local.
# I-CI-01, medido: se COMPILA primero y se arranca el JAR, en vez de dejar `bootRun` vivo.
# `./gradlew bootRun` mantiene durante TODA la fase de pruebas el JVM lanzador de Gradle, el worker
# que ejecuta la aplicación y el demonio de Kotlin — el propio runner los enumera al limpiar
# («Terminate orphan process: (java)», CUATRO en la corrida 34299786630). En una máquina de 4 vCPU
# que además sostiene Postgres, `next start` y dos Chromium, esas JVM de más son justo la CPU que le
# falta al lienzo del editor para pintar dentro de su presupuesto (`06 §8.2` punto 8: `expect` 5 s).
# Con el jar queda UN solo proceso Java, que además es el artefacto de producción — lo que el CI
# debería estar probando de todos modos. `in-process` evita el demonio de Kotlin al compilar.
echo "ci-backend: compilando el jar (bootJar)"
./gradlew bootJar --console=plain --no-daemon \
    -Dkotlin.compiler.execution.strategy=in-process \
    -Dorg.gradle.jvmargs=-Xmx2g >>"$LOG" 2>&1 || {
  echo "ci-backend: falló la compilación del jar. Últimas 60 líneas del log:" >&2
  tail -60 "$LOG" >&2
  exit 1
}
JAR="$(ls -1 "$RAIZ"/build/libs/*.jar 2>/dev/null | grep -v -- '-plain\.jar$' | head -1)"
[ -n "$JAR" ] || { echo "ci-backend: no encuentro el jar en build/libs" >&2; ls -la "$RAIZ/build/libs" >&2; exit 1; }

echo "ci-backend: arrancando $JAR en $BASE (log: $LOG)"
nohup java -jar "$JAR" --server.port="$PUERTO" >>"$LOG" 2>&1 &
echo $! > "$PIDFILE"
PID="$(cat "$PIDFILE")"

t=0
while [ "$t" -lt "$TIMEOUT" ]; do
  if responde; then
    echo "ci-backend: ARRIBA en ${t}s (PID $PID)"
    grep -aoE "Started InvitationsApplicationKt in [0-9.]+ seconds" "$LOG" | tail -1 || true
    exit 0
  fi
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "ci-backend: el proceso murió durante el arranque. Últimas 60 líneas del log:" >&2
    tail -60 "$LOG" >&2
    exit 1
  fi
  if grep -qa "APPLICATION FAILED TO START\|Application run failed" "$LOG"; then
    echo "ci-backend: el arranque FALLÓ. Últimas 60 líneas del log:" >&2
    tail -60 "$LOG" >&2
    exit 1
  fi
  sleep 3
  t=$((t + 3))
done

echo "ci-backend: agotado el tope de ${TIMEOUT}s sin respuesta. Últimas 60 líneas del log:" >&2
tail -60 "$LOG" >&2
exit 1
