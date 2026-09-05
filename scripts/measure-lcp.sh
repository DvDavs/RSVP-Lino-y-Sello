#!/usr/bin/env bash
# scripts/measure-lcp.sh — I-11 (issues-fase-3.md): protocolo REPRODUCIBLE de medición del LCP de
# la ruta pública (`/i/[publicToken]`), para que no vuelva a haber dos cifras contradictorias en la
# memoria por el mismo build (3-3 midió mediana 2 314 ms; 3-6 midió 3 191-3 544 ms).
#
# Documentado en `docs/rediseno-plantillas/diseno/04-frontend-y-editor.md` §16.2b. Corrige los tres
# defectos medidos y registrados en ADR-3-7-03 (`memoria/decisiones.md`) y en la bitácora
# `memoria/bitacora/3b-i11.md`:
#
#   1. Con `throttlingMethod: "simulate"` (el que trae Lighthouse por defecto) la métrica es
#      BIMODAL: 15 corridas del MISMO build dieron 11 valores en 2,0-2,3 s y 4 en 3,2-3,3 s, con un
#      hueco limpio entre medio y nada que distinga a los dos grupos (mismo TTFB, mismo JS, mismo
#      elemento LCP). Con 5 corridas la mediana cae en un modo u otro por AZAR — eso es lo que
#      explicaba la contradicción entre bloques, no un cambio de código.
#   2. Las corridas `NO_LCP` (Lighthouse no logra registrar un elemento LCP: `audits[
#      "largest-contentful-paint"].score === null`, `numericValue` ausente) SESGAN LA MEDIANA A LA
#      BAJA si se cuentan como si fueran ceros o se dejan que el agregador de `@lhci/cli` las trate
#      igual que una corrida válida. Aquí se DESCARTAN explícitamente, y se informa cuántas.
#   3. Si otra sesión de agente ya tiene ocupado el puerto, `next start` muere con `EADDRINUSE` sin
#      imprimir su patrón de "listo", pero `@lhci/cli` avisa y SIGUE, midiendo el servidor de OTRO
#      proceso (otro build, otro código). Este script comprueba el puerto ANTES de tocar Lighthouse
#      y falla ruidosamente si no es suyo: no mide y no miente.
#
# Salidas de Lighthouse en estrangulamiento REAL (`throttlingMethod: "devtools"`, ADR-3-7-03): NO
# es el simulador de Lantern. El resto de ajustes (perfil móvil, servidor propio, sin
# `prefers-reduced-motion`) los fija `frontend/apps/web/lighthouserc.cjs`, que este script reutiliza
# tal cual — no se duplica esa configuración aquí.
#
# Uso:
#   scripts/measure-lcp.sh [opciones]
#
# Opciones (o la variable de entorno equivalente entre paréntesis):
#   --port <n>     Puerto PROPIO donde arrancará `next start`.            (LHCI_PORT,  por defecto 3033)
#   --runs <n>     Número de corridas de Lighthouse a intentar.            (LCP_RUNS,   por defecto 9)
#   --budget <ms>  Presupuesto de LCP en milisegundos (contratos §8).      (LCP_BUDGET_MS, por defecto 2500)
#   --url <url>    URL completa a medir; salta el descubrimiento del token. (LHCI_URL)
#   -h, --help     Esta ayuda.
#
# Requiere: `frontend/apps/web` ya compilado (`pnpm --filter web run build`), el backend compartido
# respondiendo y una invitación PUBLICADA (`scripts/seed-demo.sh`, o pasa `--url` con la tuya).
#
# Salida (código de proceso):
#   0  la mediana de las corridas válidas cumple el presupuesto.
#   1  la mediana de las corridas válidas SUPERA el presupuesto — es una medida real, solo que mala.
#   2  uso incorrecto del script (argumento inválido).
#   3  no se pudo medir de verdad: puerto ajeno ocupado, el build no existe, el servidor no
#      arrancó, o TODAS las corridas fueron `NO_LCP` (no hay con qué calcular una mediana honesta).
#
# Por qué N=9 por defecto, por qué se descartan los `NO_LCP` y qué significa el rango: ver
# `docs/rediseno-plantillas/diseno/04-frontend-y-editor.md` §16.2b y `memoria/bitacora/3b-i11.md`.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$RAIZ/frontend/apps/web"

PORT="${LHCI_PORT:-3033}"
RUNS="${LCP_RUNS:-9}"
BUDGET_MS="${LCP_BUDGET_MS:-2500}"
URL="${LHCI_URL:-}"

uso() {
  sed -n '29,47p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --port)
      [ $# -ge 2 ] || { echo "measure-lcp: --port necesita un valor" >&2; exit 2; }
      PORT="$2"; shift 2 ;;
    --runs)
      [ $# -ge 2 ] || { echo "measure-lcp: --runs necesita un valor" >&2; exit 2; }
      RUNS="$2"; shift 2 ;;
    --budget)
      [ $# -ge 2 ] || { echo "measure-lcp: --budget necesita un valor" >&2; exit 2; }
      BUDGET_MS="$2"; shift 2 ;;
    --url)
      [ $# -ge 2 ] || { echo "measure-lcp: --url necesita un valor" >&2; exit 2; }
      URL="$2"; shift 2 ;;
    -h|--help)
      uso; exit 0 ;;
    *)
      echo "measure-lcp: opción desconocida: $1" >&2
      uso >&2
      exit 2 ;;
  esac
done

case "$PORT" in ''|*[!0-9]*) echo "measure-lcp: --port debe ser un entero (recibí: $PORT)" >&2; exit 2 ;; esac
case "$RUNS" in ''|*[!0-9]*) echo "measure-lcp: --runs debe ser un entero (recibí: $RUNS)" >&2; exit 2 ;; esac
case "$BUDGET_MS" in ''|*[!0-9]*) echo "measure-lcp: --budget debe ser un entero (recibí: $BUDGET_MS)" >&2; exit 2 ;; esac
if [ "$RUNS" -lt 3 ]; then
  echo "measure-lcp: --runs=$RUNS es demasiado bajo para descartar NO_LCP y seguir teniendo una" >&2
  echo "             muestra útil. Usa al menos 3; el valor de fábrica (9) es el recomendado." >&2
  exit 2
fi

if [ ! -d "$WEB_DIR/.next" ]; then
  echo "measure-lcp: no encuentro $WEB_DIR/.next — compila antes de medir:" >&2
  echo "             pnpm --filter web run build" >&2
  exit 3
fi

echo "== measure-lcp: protocolo de LCP (I-11) =========================================="
echo "puerto propio ......... $PORT"
echo "corridas objetivo ...... $RUNS"
echo "presupuesto ............ ${BUDGET_MS} ms"
echo "carga de la máquina .... $(uptime)"
echo "===================================================================================="

# --- 1) El puerto es NUESTRO antes de tocar Lighthouse -----------------------------------------
# Defensa en profundidad: `lighthouserc.cjs` ya hace esta misma comprobación al evaluarse (ADR-3-
# 7-03, `comprobarPuertoLibre`), pero ese fallo llega como una traza de node enterrada dentro de
# `@lhci/cli`. Aquí se repite a nivel de shell para que la razón del fallo sea la PRIMERA línea que
# se ve, sin depender de que nadie lea un stack trace ajeno.
if timeout 1 bash -c "exec 3<>/dev/tcp/127.0.0.1/${PORT}" 2>/dev/null; then
  echo "" >&2
  echo "measure-lcp: NO. El puerto ${PORT} YA ESTÁ OCUPADO por otro proceso." >&2
  echo "             next start moriría con EADDRINUSE y @lhci/cli mediría la aplicación de ESE" >&2
  echo "             proceso ajeno — otro build, otro código. No mide y no miente: se para aquí." >&2
  echo "             Usa --port <libre> (o LHCI_PORT=<libre>) con un puerto que sea tuyo." >&2
  exit 3
fi
echo "puerto ${PORT}: libre — confirmado antes de medir."

# --- 2) Lanza `lhci collect` (arranca su propio `next start`, corre $RUNS Lighthouse) -----------
# Un solo `require()` de `lighthouserc.cjs` por invocación de este script, así que como mucho hay UN
# login contra `/auth/token` (el límite es 5 fallos/cuenta y 20/IP en 15 min) — nunca uno por
# corrida. Si ya conoces el token publicado, pásalo con --url y ni siquiera se llama a ese login.
CHROME_PATH="${CHROME_PATH:-/opt/pw-browsers/chromium-1194/chrome-linux/chrome}"
if [ ! -x "$CHROME_PATH" ]; then
  echo "measure-lcp: no encuentro Chromium en \$CHROME_PATH ($CHROME_PATH)." >&2
  echo "             No se descarga uno nuevo (contratos §7): fija CHROME_PATH al binario preinstalado." >&2
  exit 3
fi
export CHROME_PATH
export LHCI_PORT="$PORT"
if [ -n "$URL" ]; then export LHCI_URL="$URL"; fi

LHCI_BIN="$WEB_DIR/node_modules/.bin/lhci"
if [ ! -x "$LHCI_BIN" ]; then
  echo "measure-lcp: no encuentro $LHCI_BIN — instala dependencias antes de medir:" >&2
  echo "             cd frontend && pnpm install --frozen-lockfile" >&2
  exit 3
fi

echo ""
echo "-- lhci collect (${RUNS} corridas, throttlingMethod: devtools, puerto ${PORT}) -----------"
LHCI_LOG="$(mktemp)"
if ! (cd "$WEB_DIR" && "$LHCI_BIN" collect --numberOfRuns="$RUNS" 2>&1 | tee "$LHCI_LOG"); then
  echo "" >&2
  echo "measure-lcp: \`lhci collect\` terminó con error (arriba, completo). No hay corridas de las" >&2
  echo "             que fiarse — probable puerto ajeno, servidor que no llegó a 'Ready in', o" >&2
  echo "             backend compartido (http://127.0.0.1:6003) sin responder." >&2
  rm -f "$LHCI_LOG"
  exit 3
fi
rm -f "$LHCI_LOG"

# --- 3) Analiza los LHR crudos: descarta NO_LCP, calcula mediana y rango ------------------------
# Se lee `.lighthouseci/lhr-*.json` directamente (el LHR de Lighthouse, sin pasar por el agregador
# de `lhci assert`) para que la definición de NO_LCP y el cálculo de la mediana sean explícitos y
# auditables aquí, en vez de heredar cualquier tratamiento implícito que le dé el agregador a una
# corrida sin métrica.
LHCI_DIR="$WEB_DIR/.lighthouseci"
if REPORTE="$(node --input-type=commonjs -e '
const fs = require("node:fs");
const path = require("node:path");

const dir = process.argv[1];
const budget = Number(process.argv[2]);
const requested = Number(process.argv[3]);

const archivos = fs.readdirSync(dir).filter(f => /^lhr-\d+\.json$/.test(f)).sort();
if (archivos.length === 0) {
  console.log("SIN_DATOS: .lighthouseci no tiene ningún lhr-*.json");
  process.exit(3);
}

const corridas = archivos.map((archivo, i) => {
  const lhr = JSON.parse(fs.readFileSync(path.join(dir, archivo), "utf8"));
  const audit = lhr.audits && lhr.audits["largest-contentful-paint"];
  const runtimeError = lhr.runtimeError && lhr.runtimeError.message;
  const valida = !runtimeError && audit && audit.score !== null && typeof audit.numericValue === "number";
  return {
    n: i + 1,
    archivo,
    valida,
    valor: valida ? audit.numericValue : null,
    motivo: valida ? null : (runtimeError || (audit && audit.errorMessage) || "NO_LCP"),
  };
});

const validas = corridas.filter(c => c.valida);
const descartadas = corridas.filter(c => !c.valida);

console.log("");
console.log("corridas por número:");
for (const c of corridas) {
  if (c.valida) {
    console.log(`  #${c.n}  LCP = ${c.valor.toFixed(1)} ms`);
  } else {
    console.log(`  #${c.n}  DESCARTADA (${c.motivo})`);
  }
}
console.log("");

if (validas.length === 0) {
  console.log(`SIN_DATOS: ${corridas.length} corridas, las ${corridas.length} fueron NO_LCP/error — no hay mediana que calcular.`);
  process.exit(3);
}

const valores = validas.map(c => c.valor).sort((a, b) => a - b);
const mid = Math.floor(valores.length / 2);
const mediana = valores.length % 2 === 0 ? (valores[mid - 1] + valores[mid]) / 2 : valores[mid];
const minimo = valores[0];
const maximo = valores[valores.length - 1];

console.log(`N solicitado ........... ${requested}`);
console.log(`N efectivo (válidas) .... ${validas.length}`);
console.log(`Descartadas (NO_LCP) .... ${descartadas.length}`);
console.log(`Mediana ................. ${mediana.toFixed(1)} ms`);
console.log(`Rango .................... ${minimo.toFixed(1)} – ${maximo.toFixed(1)} ms`);
console.log(`Presupuesto .............. ${budget} ms`);
console.log("");

if (mediana > budget) {
  console.log(`RESULTADO: NO CUMPLE — la mediana (${mediana.toFixed(1)} ms) supera el presupuesto (${budget} ms).`);
  process.exit(1);
}
console.log(`RESULTADO: CUMPLE — la mediana (${mediana.toFixed(1)} ms) está dentro del presupuesto (${budget} ms).`);
process.exit(0);
' "$LHCI_DIR" "$BUDGET_MS" "$RUNS")"; then
  CODIGO=0
else
  CODIGO=$?
fi

echo "$REPORTE"
echo "===================================================================================="
echo "LHR crudos conservados en: $LHCI_DIR (uno por corrida, incluidas las descartadas)."
exit "$CODIGO"
