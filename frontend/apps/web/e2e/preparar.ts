// e2e/preparar.ts — utilidades compartidas de los e2e del EDITOR, contra el BACKEND REAL.
//
// Sin mocks de la API (04 §20.3, literal: "un e2e con la API simulada no habría detectado ninguno de
// los defectos de contrato que esta revisión encontró"). Requisitos previos, ambos documentados:
//   scripts/dev-backend.sh start   → backend en :6003 + clúster efímero
//   scripts/seed-demo.sh           → cuenta demo, plantillas registradas e invitación publicada
//
// La única cosa que NO se puede hacer por HTTP es crear una invitación con `uses_templates2=true`:
// no existe ruta (ADR-2-4-02, `handoffs/3-0a.md` §3), porque `templates2` no crea invitaciones.
// Igual que `scripts/seed-demo.sh`, se inserta por SQL y se deja a la vista.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:6003";
export const DEMO_EMAIL = process.env.TPL_DEMO_EMAIL ?? "demo.boda@example.com";
export const DEMO_PASS = process.env.TPL_DEMO_PASS ?? "Demo1234!";
const PGBIN = process.env.TPL_TEST_PGBIN ?? "/usr/lib/postgresql/16/bin";
const ESTADO = `${process.env.TPL_TEST_STATE_DIR ?? "/tmp/templates2-pg"}/state.env`;
const DB = process.env.TPL_DEV_DB ?? "invitaciones_dev";
/** Clave de `lib/api-client.ts` — el token vive SOLO ahí y en `sessionStorage` (P8). */
const CLAVE_TOKEN = "invitaciones.auth.token";

function puertoPostgres(): string {
  const linea = readFileSync(ESTADO, "utf8").match(/TPL_TEST_PGPORT=(\d+)/);
  if (!linea?.[1]) throw new Error(`No encuentro el clúster efímero en ${ESTADO}: arranca scripts/dev-backend.sh start`);
  return linea[1];
}

export function sql(consulta: string): string {
  return execFileSync(
    `${PGBIN}/psql`,
    ["-h", "127.0.0.1", "-p", puertoPostgres(), "-U", "postgres", "-d", DB, "-v", "ON_ERROR_STOP=1", "-Atqc", consulta],
    { encoding: "utf8" },
  ).trim();
}

export async function jwtDemo(): Promise<string> {
  const r = await fetch(`${API_BASE}/auth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASS }),
  });
  if (!r.ok) throw new Error(`No pude autenticarme como ${DEMO_EMAIL} (HTTP ${r.status}): ¿corriste scripts/seed-demo.sh?`);
  // `POST /auth/token` responde `accessToken`, NUNCA `token` (`handoffs/2-5.md`, verificado).
  const cuerpo = (await r.json()) as { accessToken: string };
  return cuerpo.accessToken;
}

/** Inyecta el token ANTES de que cargue cualquier script de la página (igual que un login real). */
export async function sesionDemo(page: Page, token: string): Promise<void> {
  await page.addInitScript(
    ([clave, valor]) => {
      try {
        window.sessionStorage.setItem(clave as string, valor as string);
      } catch {
        /* almacenamiento bloqueado: la prueba fallará con un mensaje claro más adelante */
      }
    },
    [CLAVE_TOKEN, token] as const,
  );
}

export function customerIdDemo(): number {
  return Number(sql(`SELECT id FROM customer WHERE email = '${DEMO_EMAIL}';`));
}

/** La invitación que `seed-demo.sh` dejó publicada (tiene documento y release). */
export function invitacionSembrada(): number {
  const id = sql(`SELECT id FROM invitation WHERE customer_id = ${customerIdDemo()} AND uses_templates2 ORDER BY id LIMIT 1;`);
  if (!id) throw new Error("No hay invitación sembrada: corre scripts/seed-demo.sh");
  return Number(id);
}

/**
 * Invitación NUEVA con `uses_templates2=true` y **sin documento**: el estado inicial real del
 * producto, en el que `GET .../document` responde `404 TPL_DOCUMENT_NOT_STARTED` y el editor tiene
 * que llamar antes a `:choose-template` (contratos §4, ADR-1R-X-03).
 *
 * Las nueve columnas booleanas y `total_amount` se rellenan a la fuerza: son NULLABLE en la tabla
 * pero `InvitationEntity` las mapea a primitivos de Kotlin y un NULL convierte cualquier ruta del
 * editor en `500 TPL_INTERNAL` (defecto preexistente y ajeno, `handoffs/3-0a.md` §3).
 */
export function invitacionSinDocumento(): number {
  const cliente = customerIdDemo();
  const id = sql(`INSERT INTO invitation (customer_id, template_id, is_enabled, is_paid, is_finished,
      all_events_same_location, uses_templates2, date, time, hashtag, cover_photo_url,
      children_allowed, young_allowed, has_music, has_gallery, has_extra_modules, total_amount,
      created_at, updated_at)
    VALUES (${cliente}, 5, true, true, false, false, true, '2027-04-18', '17:00', '#PruebaE2E', '',
      false, true, true, true, true, 0, now(), now()) RETURNING id;`);
  return Number(id);
}

/** Deja la invitación de la prueba fuera del camino de las siguientes corridas. */
export function borrarInvitacion(id: number): void {
  try {
    sql(`DELETE FROM tpl_document WHERE invitation_id = ${id};`);
  } catch {
    /* puede no existir */
  }
  try {
    sql(`DELETE FROM invitation WHERE id = ${id};`);
  } catch {
    /* la puede referenciar un release: no es fatal para la prueba */
  }
}

/** Lee la revisión actual del documento por la ruta real (no por SQL). */
export async function revisionActual(invitationId: number, token: string): Promise<number> {
  const r = await fetch(`${API_BASE}/editor/invitations/${invitationId}/document`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const cuerpo = (await r.json()) as { revision: number };
  return cuerpo.revision;
}

/**
 * Aplica un lote por la RUTA REAL, leyendo antes la revisión vigente. Se usa para la LIMPIEZA de las
 * pruebas (devolver la invitación de demostración a su estado), nunca para lo que se está midiendo.
 *
 * Va por HTTP y no por la interfaz a propósito: la limpieza se ejecuta cuando la revisión del
 * servidor puede haber avanzado por otra prueba o por el `keepalive` de una pestaña que se cerró, y
 * un `409` en el paso de limpieza haría fallar una prueba que ya había demostrado lo suyo. El
 * editor sabe resolver ese `409` — eso lo mide `conflicto.spec.ts`, que es su sitio.
 */
export async function aplicarOperaciones(
  invitationId: number,
  token: string,
  operations: unknown[],
): Promise<{ status: number; revision: number | null }> {
  const baseRevision = await revisionActual(invitationId, token);
  const r = await fetch(`${API_BASE}/editor/invitations/${invitationId}/document/operations`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ baseRevision, clientBatchId: `limpieza${Date.now().toString(36)}`, operations }),
  });
  const cuerpo = (await r.json()) as { revision?: number };
  return { status: r.status, revision: cuerpo.revision ?? null };
}
