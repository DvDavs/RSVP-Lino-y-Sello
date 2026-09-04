#!/usr/bin/env bash
# scripts/pg-ephemeral.sh — clúster PostgreSQL 16 efímero para la suite de integración de
# templates2, SIN Docker (Docker no está disponible en este entorno; ADR-025 + ADR-1R-C-10,
# 06-pruebas-y-calidad.md §6.2). Adaptado respecto al script de esa sección: puerto ALEATORIO por
# defecto (no fijo 55432) y nombre `pg-ephemeral.sh` (el brief de este sub-agente lo pide así;
# `06 §6.2` lo llama `pg-test-cluster.sh` — mismo contrato, mismo contenido, nombre de fichero
# distinto; registrado en la bitácora de 2-0a).
#
# Contrato (06 §6.1): arranca un clúster, expone/exporta TPL_TEST_JDBC_URL / TPL_TEST_DB_USER /
# TPL_TEST_DB_PASSWORD, y `IntegrationTestBase` los usa tal cual si TPL_TEST_JDBC_URL ya viene
# definida por el entorno (en CI, `services: postgres` de GitHub Actions) no debe llamarse a este
# script en absoluto — es el camino LOCAL, sin Docker.
#
# `initdb` se niega a correr como root (verificado, contratos.md §7): si este script se ejecuta como
# root delega en el usuario del sistema `postgres` vía `su postgres -c '...'`.
#
# Uso:
#   source scripts/pg-ephemeral.sh start   # arranca (o reutiliza uno ya en marcha) y EXPORTA las
#                                           # tres variables en el shell que hace `source`
#   scripts/pg-ephemeral.sh stop           # para y limpia (PGDATA se borra: es efímero)
#   scripts/pg-ephemeral.sh status         # 0 si hay un clúster en marcha, 1 si no
#   scripts/pg-ephemeral.sh selftest       # start -> SELECT 1 + jsonb ->>/@> -> stop, con salida
#                                           # verificable (lo que pide el criterio de aceptación)
#
# Idempotencia: una segunda llamada a `start` mientras el clúster ya está arriba lo REUTILIZA (no
# arranca un segundo postmaster ni pisa el PGDATA existente); una segunda llamada a `stop` sobre un
# clúster ya parado es un no-op.
#
# CONCURRENCIA (revisión 2-0a-REV, objeción O-09): el fichero de estado es UNO por $STATE_DIR, así
# que dos suites que corran a la vez en la misma máquina con el STATE_DIR por defecto comparten
# clúster — y el primer `stop` mata el que la segunda sigue usando. Para dos clústeres realmente
# independientes (dos agentes, CI local + IDE), cada uno debe fijar su propio directorio de estado:
#   TPL_TEST_STATE_DIR=/tmp/templates2-pg-$$ source scripts/pg-ephemeral.sh start
# El puerto aleatorio (ADR-2-0a-05) solo evita la colisión de puertos, no la del estado compartido.
#
# Limpieza automática: un llamador que quiera garantizar la parada aunque el proceso termine mal
# debe hacer, en su propio shell:  trap 'scripts/pg-ephemeral.sh stop' EXIT
# (un `trap` puesto DENTRO de este script no serviría de nada para `start`, porque `start` se
# ejecuta con `source` en el shell del llamador, no en un subshell propio que vaya a terminar).
set -euo pipefail

PGBIN="${TPL_TEST_PGBIN:-/usr/lib/postgresql/16/bin}"
STATE_DIR="${TPL_TEST_STATE_DIR:-/tmp/templates2-pg}"
STATE_FILE="$STATE_DIR/state.env"

as_postgres() {
  # Ejecuta "$*" como el usuario `postgres` si somos root; tal cual si no.
  if [ "$(id -u)" -eq 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi
}

free_port() {
  python3 - <<'PY'
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.bind(("127.0.0.1", 0))
print(s.getsockname()[1])
s.close()
PY
}

is_running() {
  [ -f "$STATE_FILE" ] || return 1
  # El `source` va DENTRO de un subshell a propósito (revisión 2-0a-REV, objeción O-08): si el
  # fichero de estado está obsoleto (la máquina se reinició, alguien mató el postmaster, se borró
  # /tmp) esta función devuelve 1, pero las variables que acabara de importar seguirían vivas en el
  # shell del llamador y `start()` reutilizaría el PUERTO y el PGDATA muertos
  # (`${TPL_TEST_PGPORT:-$(free_port)}`), en vez de pedir un puerto libre: `initdb` fallaría con
  # "directory exists but is not empty" o `pg_ctl` con el puerto ya ocupado por otro proceso.
  # shellcheck disable=SC1090
  ( . "$STATE_FILE"; as_postgres "$PGBIN/pg_ctl -D $TPL_TEST_PGDATA status" >/dev/null 2>&1 )
}

start() {
  if is_running; then
    # shellcheck disable=SC1090
    . "$STATE_FILE"
    echo "pg-ephemeral: ya en marcha en 127.0.0.1:$TPL_TEST_PGPORT (PGDATA=$TPL_TEST_PGDATA) — reutilizando" >&2
    export TPL_TEST_JDBC_URL TPL_TEST_DB_USER TPL_TEST_DB_PASSWORD TPL_TEST_PGPORT TPL_TEST_PGDATA
    return 0
  fi
  # Estado obsoleto (postmaster muerto sin `stop`: caída, reinicio, pkill). Se limpia también el
  # PGDATA huérfano al que apunta —solo si cuelga de $STATE_DIR, nunca una ruta arbitraria— o
  # /tmp/templates2-pg/ acumularía un clúster muerto por cada caída (revisión 2-0a-REV, O-08).
  if [ -f "$STATE_FILE" ]; then
    viejo="$( . "$STATE_FILE"; echo "${TPL_TEST_PGDATA:-}" )"
    case "$viejo" in "$STATE_DIR"/*) rm -rf "$viejo" ;; esac
  fi
  rm -f "$STATE_FILE"

  mkdir -p "$STATE_DIR"
  local port="${TPL_TEST_PGPORT:-$(free_port)}"
  local pgdata="${TPL_TEST_PGDATA:-$STATE_DIR/data-$$}"

  mkdir -p "$pgdata"
  if [ "$(id -u)" -eq 0 ]; then chown postgres:postgres "$pgdata"; fi
  chmod 700 "$pgdata"

  as_postgres "$PGBIN/initdb -D $pgdata -U postgres --auth=trust -E UTF8 --locale=C" >/dev/null
  as_postgres "$PGBIN/pg_ctl -D $pgdata -w -l $pgdata/server.log \
        -o '-p $port -k $pgdata -c listen_addresses=127.0.0.1 \
            -c fsync=off -c full_page_writes=off -c synchronous_commit=off' start"
  "$PGBIN/createdb" -h 127.0.0.1 -p "$port" -U postgres templates2_test

  local jdbc="jdbc:postgresql://127.0.0.1:$port/templates2_test"
  {
    echo "TPL_TEST_PGPORT=$port"
    echo "TPL_TEST_PGDATA=$pgdata"
    echo "TPL_TEST_JDBC_URL=$jdbc"
    echo "TPL_TEST_DB_USER=postgres"
    echo "TPL_TEST_DB_PASSWORD="
  } > "$STATE_FILE"

  # shellcheck disable=SC1090
  . "$STATE_FILE"
  export TPL_TEST_JDBC_URL TPL_TEST_DB_USER TPL_TEST_DB_PASSWORD TPL_TEST_PGPORT TPL_TEST_PGDATA
  echo "pg-ephemeral: arrancado en 127.0.0.1:$port (PGDATA=$pgdata)" >&2
  echo "TPL_TEST_JDBC_URL=$jdbc"
}

stop() {
  if [ ! -f "$STATE_FILE" ]; then
    echo "pg-ephemeral: nada que parar (idempotente)" >&2
    return 0
  fi
  # shellcheck disable=SC1090
  . "$STATE_FILE"
  as_postgres "$PGBIN/pg_ctl -D $TPL_TEST_PGDATA -m immediate -w stop" || true
  rm -rf "$TPL_TEST_PGDATA" "$STATE_FILE"
  echo "pg-ephemeral: parado y limpiado" >&2
}

status() {
  if is_running; then
    # shellcheck disable=SC1090
    . "$STATE_FILE"
    echo "pg-ephemeral: EN MARCHA — 127.0.0.1:$TPL_TEST_PGPORT (PGDATA=$TPL_TEST_PGDATA)"
    return 0
  fi
  echo "pg-ephemeral: parado"
  return 1
}

selftest() {
  start
  # shellcheck disable=SC1090
  . "$STATE_FILE"
  echo "-- SELECT 1 --"
  PGPASSWORD="$TPL_TEST_DB_PASSWORD" psql -h 127.0.0.1 -p "$TPL_TEST_PGPORT" -U "$TPL_TEST_DB_USER" -d templates2_test -Atc "SELECT 1;"
  echo "-- jsonb ->> y @> --"
  PGPASSWORD="$TPL_TEST_DB_PASSWORD" psql -h 127.0.0.1 -p "$TPL_TEST_PGPORT" -U "$TPL_TEST_DB_USER" -d templates2_test <<'SQL'
CREATE TEMP TABLE selftest_jsonb (v jsonb);
INSERT INTO selftest_jsonb VALUES ('{"a": 1, "b": {"c": true}}'::jsonb);
SELECT v ->> 'a' AS arrow_arrow, v @> '{"b": {"c": true}}'::jsonb AS contains FROM selftest_jsonb;
SQL
  echo "-- version --"
  PGPASSWORD="$TPL_TEST_DB_PASSWORD" psql -h 127.0.0.1 -p "$TPL_TEST_PGPORT" -U "$TPL_TEST_DB_USER" -d templates2_test -Atc "SELECT version();"
  stop
}

case "${1:-start}" in
  start) start ;;
  stop) stop ;;
  status) status ;;
  selftest) selftest ;;
  *) echo "uso: $0 start|stop|status|selftest" >&2; exit 2 ;;
esac
