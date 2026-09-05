// e2e/util/auth-cache.ts — token JWT de la cuenta de demostración, obtenido UNA SOLA VEZ para TODA
// la corrida de Playwright y compartido entre archivos y workers (bloque 3-6, política anti-flake de
// `contratos.md` §6 / ADR-1R-C-11).
//
// Por qué existe: `RefreshTokenService.kt:20` (módulo `auth`, ANTIGUO, prohibido tocar) responde 500
// con `IncorrectResultSizeDataAccessException: Query did not return a unique result: 2 results were
// returned` cuando la MISMA cuenta se autentica dos veces en paralelo — dos filas de refresh token
// nuevas compiten por la fila única que espera el `SELECT`. Antes de este bloque, `jwtDemo()`
// (`e2e/preparar.ts`) y `pedirJwt()` (`e2e/util/demo.ts`) hacían un `POST /auth/token` NUEVO por
// PRUEBA, y con `fullyParallel: true` eso dispara la carrera solo (medido: 16 ocurrencias en 6
// corridas, `preguntas-abiertas.md` § P-3-3b-8/§"Fase 3 · 3-6"). Con un solo login por corrida
// —`global-setup.ts` lo hace ANTES de que arranque ningún worker— la carrera no tiene con qué
// dispararse: cero autenticaciones concurrentes de la cuenta de demostración.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
/** Escrito por `global-setup.ts`; nunca se versiona (`.gitignore`: lleva un JWT vivo). */
export const RUTA_CACHE = path.join(AQUI, "..", ".auth-cache.json");

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:6003";
const EMAIL = process.env.TPL_DEMO_EMAIL ?? "demo.boda@example.com";
const PASS = process.env.TPL_DEMO_PASS ?? "Demo1234!";

let memo: string | null = null;
let enVuelo: Promise<string> | null = null;

/** Login en vivo — SOLO como red de seguridad si `global-setup.ts` no llegó a correr (alguien
 *  importa este módulo desde un script suelto, fuera de `playwright test`). Memoizado con una
 *  promesa compartida para que, incluso en ese caso degradado, dos llamadas concurrentes del MISMO
 *  proceso no disparen dos POST — la protección real sigue siendo el login único de `global-setup.ts`. */
function loginVivo(): Promise<string> {
  if (enVuelo) return enVuelo;
  enVuelo = (async () => {
    const r = await fetch(`${API}/auth/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASS }),
    });
    if (!r.ok) {
      throw new Error(
        `auth-cache: POST /auth/token respondió ${r.status} para ${EMAIL}. ¿Está sembrada la ` +
          `demostración? Ejecuta 'scripts/dev-backend.sh start && scripts/seed-demo.sh'.`,
      );
    }
    const cuerpo = (await r.json()) as { accessToken?: string };
    if (!cuerpo.accessToken) throw new Error("auth-cache: /auth/token no devolvió accessToken");
    return cuerpo.accessToken;
  })();
  return enVuelo;
}

/**
 * Token JWT compartido por TODA la corrida. Orden:
 *   1. memoria de este proceso (worker) — no vuelve a tocar el disco ni la red.
 *   2. `.auth-cache.json`, escrito una única vez por `global-setup.ts`.
 *   3. login en vivo (memoizado), solo si (2) no existe.
 * Nunca hagas `fetch(.../auth/token)` directamente en un `.spec.ts`: usa esta función.
 */
export async function tokenCompartido(): Promise<string> {
  if (memo) return memo;
  if (existsSync(RUTA_CACHE)) {
    const contenido = JSON.parse(readFileSync(RUTA_CACHE, "utf8")) as { accessToken?: string };
    if (contenido.accessToken) {
      memo = contenido.accessToken;
      return memo;
    }
  }
  memo = await loginVivo();
  return memo;
}
