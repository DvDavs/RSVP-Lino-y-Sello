// e2e/util/demo.ts — localiza la INVITACIÓN DE DEMOSTRACIÓN que siembra `scripts/seed-demo.sh`,
// contra el backend REAL (06 §8.2.4: cero mocks de la API en e2e).
//
// Por qué se descubre y no se escribe a mano: `seed-demo.sh` acuña un `publicToken` nuevo cada vez
// que se siembra sobre un clúster limpio (`PublicTokenGenerator` con `SecureRandom`, contratos §5),
// y el clúster de desarrollo es EFÍMERO (`handoffs/3-0a.md` §1: `stop` borra el `PGDATA`). Una
// constante en el código quedaría obsoleta en la siguiente sesión.
//
// Orden de resolución:
//   1. `TPL_DEMO_PUBLIC_TOKEN` / `TPL_DEMO_INVITATION_ID` del entorno, si están (CI, o quien ya lo
//      sepa).
//   2. Descubrimiento por la API real: `POST /auth/token` con las credenciales DETERMINISTAS de
//      `seed-demo.sh` (`TPL_DEMO_EMAIL`/`TPL_DEMO_PASS`, con los mismos valores por defecto) y
//      `GET /editor/invitations/{id}/document` sobre un rango corto de ids hasta encontrar la que
//      pertenece a ese cliente. Es exactamente lo que haría una persona: no toca la base de datos.
//
// Nada de esto vive en `lib/api-client.ts`: es utillaje de pruebas y no debe entrar en el bundle.
import { tokenCompartido } from "./auth-cache.ts";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:6003";
const EMAIL = process.env.TPL_DEMO_EMAIL ?? "demo.boda@example.com";
/** `seed-demo.sh` crea la invitación por SQL sobre un clúster recién creado: el id es un entero
 *  bajo. 24 intentos cubren de sobra cualquier reejecución sin convertirse en un barrido. */
const MAX_INVITACIONES = 24;

export interface Demo {
  readonly invitationId: number;
  readonly publicToken: string;
  readonly jwt: string;
}

let cache: Demo | null = null;

/** Datos de la invitación de demostración, cacheados para todo el proceso de pruebas.
 *  El JWT NO se pide aquí: `tokenCompartido()` lee el login ÚNICO de `global-setup.ts` (bloque 3-6,
 *  política anti-flake `contratos.md` §6 — ver `e2e/util/auth-cache.ts` para el porqué). */
export async function obtenerDemo(): Promise<Demo> {
  if (cache) return cache;

  const jwt = await tokenCompartido();

  const idDeclarado = process.env.TPL_DEMO_INVITATION_ID;
  const tokenDeclarado = process.env.TPL_DEMO_PUBLIC_TOKEN;
  if (idDeclarado && tokenDeclarado) {
    cache = { invitationId: Number(idDeclarado), publicToken: tokenDeclarado, jwt };
    return cache;
  }

  for (let id = 1; id <= MAX_INVITACIONES; id++) {
    const r = await fetch(`${API}/editor/invitations/${id}/document`, {
      headers: { Authorization: `Bearer ${jwt}`, Accept: "application/json" },
    });
    if (r.status !== 200) continue; // 403 = de otro cliente; 404 = sin documento. Ninguna es un error.
    const doc = (await r.json()) as { publicToken?: string };
    if (!doc.publicToken) continue;
    const publicado = await fetch(`${API}/public/i/${doc.publicToken}/exists`);
    if (!publicado.ok) continue;
    const { published } = (await publicado.json()) as { published: boolean };
    if (!published) continue;
    cache = { invitationId: id, publicToken: doc.publicToken, jwt };
    return cache;
  }

  throw new Error(
    `e2e/util/demo: ninguna invitación publicada de ${EMAIL} entre 1 y ${MAX_INVITACIONES}. ` +
      `Ejecuta 'scripts/seed-demo.sh' antes de las e2e.`,
  );
}

/** `GET /editor/invitations/{id}/document` — devuelve `{revision, composed, ...}`. */
export async function leerDocumento(
  demo: Demo,
): Promise<{ revision: number; secciones: Array<{ key: string; visible: boolean }> }> {
  const r = await fetch(`${API}/editor/invitations/${demo.invitationId}/document`, {
    headers: { Authorization: `Bearer ${demo.jwt}`, Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`e2e/util/demo: GET document → ${r.status}`);
  const doc = (await r.json()) as {
    revision: number;
    composed: { sections: Array<{ key: string; visible: boolean }> };
  };
  return {
    revision: doc.revision,
    secciones: doc.composed.sections.map((s) => ({ key: s.key, visible: s.visible })),
  };
}

/** `POST …/document/operations` con UN lote de una operación. Devuelve la revisión resultante. */
export async function aplicarOperacion(
  demo: Demo,
  baseRevision: number,
  operacion: Record<string, unknown>,
): Promise<number> {
  // `clientBatchId` debe casar `^[A-Za-z0-9_-]{8,64}$` (handoffs/3-0a.md §4); uno corto sale como
  // `400 TPL_MALFORMED_JSON`. Se genera uno nuevo por lote: reusar uno haría el lote idempotente
  // (`200 {applied:false}`) y la prueba no cambiaría nada.
  const clientBatchId = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const r = await fetch(`${API}/editor/invitations/${demo.invitationId}/document/operations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${demo.jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ baseRevision, clientBatchId, operations: [operacion] }),
  });
  if (!r.ok) throw new Error(`e2e/util/demo: POST operations → ${r.status} ${await r.text()}`);
  const cuerpo = (await r.json()) as { revision: number };
  return cuerpo.revision;
}

/** `POST …/release` — publica la revisión indicada. */
export async function publicar(demo: Demo, baseRevision: number): Promise<void> {
  const r = await fetch(`${API}/editor/invitations/${demo.invitationId}/release`, {
    method: "POST",
    headers: { Authorization: `Bearer ${demo.jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ baseRevision }),
  });
  if (!r.ok && r.status !== 200) throw new Error(`e2e/util/demo: POST release → ${r.status} ${await r.text()}`);
}

/**
 * Golpea el webhook REAL de `apps/web` (`04 §15.2`, ADR-1R-F-09) con el cuerpo EXACTO que manda el
 * backend (ADR-2-6-01). Es lo mismo que hará `RevalidationNotifier` en producción; aquí se llama a
 * mano porque el backend de desarrollo apunta su webhook a donde diga su configuración, no
 * necesariamente al servidor de Playwright.
 */
export async function revalidar(baseWeb: string, publicToken: string): Promise<Response> {
  return fetch(`${baseWeb}/api/revalidate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-revalidate-token": process.env.REVALIDATE_SECRET ?? "e2e-secreto-de-pruebas",
    },
    body: JSON.stringify({ tag: `invitation:${publicToken}`, publicToken, reason: "published" }),
  });
}
