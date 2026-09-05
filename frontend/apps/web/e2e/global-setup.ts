// e2e/global-setup.ts — autentica la cuenta de demostración UNA SOLA VEZ, antes de que arranque
// ningún worker de Playwright (bloque 3-6, política anti-flake de `contratos.md` §6 / ADR-1R-C-11).
//
// Sin esto, decenas de pruebas repartidas en varios workers (`fullyParallel: true`) llamaban cada
// una a `POST /auth/token` con la MISMA cuenta (`e2e/preparar.ts` `jwtDemo()`, `e2e/util/demo.ts`
// `pedirJwt()`, ninguna de las dos cacheaba entre pruebas). Dos autenticaciones concurrentes de la
// misma cuenta crean dos filas de refresh token y disparan
// `IncorrectResultSizeDataAccessException: Query did not return a unique result: 2 results were
// returned` en `RefreshTokenService.kt:20` (módulo `auth`, ANTIGUO — fuera de alcance, no se toca):
// medido, 16 ocurrencias en 6 corridas seguidas de la suite (`preguntas-abiertas.md` § P-3-3b-8).
// Con un login único por corrida la carrera no tiene con qué dispararse.
//
// Escribe el token en `.auth-cache.json` (ver `e2e/util/auth-cache.ts`), que SÍ persiste entre los
// procesos de los distintos workers (a diferencia de una variable de entorno fijada aquí, que
// Playwright NO propaga a los workers que arranca después).
import { writeFileSync } from "node:fs";
import { RUTA_CACHE } from "./util/auth-cache.ts";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:6003";
const EMAIL = process.env.TPL_DEMO_EMAIL ?? "demo.boda@example.com";
const PASS = process.env.TPL_DEMO_PASS ?? "Demo1234!";

export default async function globalSetup(): Promise<void> {
  const r = await fetch(`${API}/auth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  if (!r.ok) {
    throw new Error(
      `global-setup: POST /auth/token respondió ${r.status} para ${EMAIL}. ¿Arrancaste el backend y ` +
        `sembraste la demostración? 'scripts/dev-backend.sh start && scripts/seed-demo.sh'.`,
    );
  }
  const cuerpo = (await r.json()) as { accessToken?: string };
  if (!cuerpo.accessToken) throw new Error("global-setup: /auth/token no devolvió accessToken");
  writeFileSync(RUTA_CACHE, JSON.stringify({ accessToken: cuerpo.accessToken, obtainedAt: Date.now() }), "utf8");
  console.log(`global-setup: token de ${EMAIL} obtenido una sola vez y cacheado para toda la corrida.`);
}
