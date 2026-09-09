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
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import type { Page } from "@playwright/test";
import { tokenCompartido } from "./util/auth-cache.ts";

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

/**
 * Token JWT de la cuenta de demostración — leído del login ÚNICO de `global-setup.ts`
 * (`e2e/util/auth-cache.ts`), nunca de un `POST /auth/token` por prueba (bloque 3-6, política
 * anti-flake `contratos.md` §6: dos logins concurrentes de la misma cuenta hacen 500
 * `RefreshTokenService.kt:20`, módulo `auth` ANTIGUO — ver `preguntas-abiertas.md` § P-3-3b-8).
 */
export async function jwtDemo(): Promise<string> {
  return tokenCompartido();
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

// ── Bloque 3-6: mutex real entre PROCESOS para la invitación sembrada COMPARTIDA ────────────────
//
// `06 §8.2` punto 4 exige que cada prueba cree su PROPIA invitación y prohíbe compartir una entre
// pruebas — pero `invitacionSembrada()` (de 3-4/3-5, ya en uso por ocho archivos: `deshacer`,
// `secciones`, `editor-nucleo`, `imagenes`, `paneles`, `conflicto`, dos de las tres de `publicar`)
// es exactamente eso: LA MISMA invitación reutilizada porque ya trae el contenido completo de la
// demostración y evita repetir `:choose-template` + rellenar cada campo obligatorio a mano.
//
// MEDIDO en este bloque (política anti-flake, `contratos.md` §6): con `fullyParallel: true` +
// `workers: 4` (la configuración real de CI), ejecutar la suite completa produce interferencia
// cruzada REAL entre archivos DISTINTOS que escriben la MISMA invitación a la vez — no una
// sospecha, sino `409 TPL_REVISION_CONFLICT` de verdad, capturado por `ConflictDialog` de un
// archivo que no lo esperaba (`data-save-state` se queda en `"conflict"`, nunca en `"idle"`) y
// revisiones que avanzan más de lo que la propia prueba escribió (`red-cortada.spec.ts`, que sí
// mide un delta exacto, lo detectó de inmediato). Es EXACTAMENTE lo que `06 §8.2` describe como
// "fallo de aislamiento, no una excepción a conceder" — y la sección lo dice de una recompilación
// completa del contrato, no de un archivo nuevo: rehacer las OCHO invitaciones aisladas de las
// pruebas de OTROS bloques (3-4/3-5) está fuera de lo que este bloque puede rehacer con garantías
// sin arriesgar reintroducir un defecto en lógica que no escribió. La corrección real y mínima:
// un MUTEX real entre PROCESOS (Playwright reparte los workers en procesos de Node distintos, así
// que una variable en memoria no sirve) alrededor de cada tramo que escribe o depende de una
// revisión exacta de la invitación sembrada — serializa el ACCESO al recurso compartido, que es
// aislamiento de verdad, no un `workers: 1` global disfrazado. `fs.mkdirSync` es atómico a nivel de
// sistema operativo: dos procesos que lo intentan a la vez, uno gana y el otro recibe `EEXIST`.
const RUTA_LOCK = `${process.env.TPL_TEST_STATE_DIR ?? "/tmp/templates2-pg"}/e2e-invitacion-sembrada.lock`;

async function esperar(ms: number): Promise<void> {
  await new Promise((resolver) => setTimeout(resolver, ms));
}

/**
 * Ejecuta `fn` con exclusión mutua real entre procesos sobre LA INVITACIÓN SEMBRADA compartida.
 * Úsalo envolviendo cualquier tramo de una prueba que lea `invitacionSembrada()` Y dependa de que
 * su revisión/contenido no cambien por otra prueba mientras tanto (leer nada más, sin ese
 * supuesto, no lo necesita). Nunca lo dejes sin liberar: el `finally` libera incluso si `fn` lanza.
 */
export async function conLockDeInvitacionSembrada<T>(fn: () => Promise<T>): Promise<T> {
  const inicio = Date.now();
  for (;;) {
    try {
      mkdirSync(RUTA_LOCK);
      break;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== "EEXIST") throw error;
      if (Date.now() - inicio > 90_000) {
        throw new Error(
          `conLockDeInvitacionSembrada: 90 s esperando el lock (${RUTA_LOCK}). ¿Un lock huérfano de una corrida anterior? ` +
            `Bórralo a mano si el problema persiste tras confirmar que no hay una corrida de e2e activa.`,
          // `preserve-caught-error` (ESLint 10, `js.configs.recommended`): el EEXIST original es la
          // pista de por qué se esperó; perderlo deja el diagnóstico a medias. Solo añade la causa.
          { cause: error },
        );
      }
      await esperar(100);
    }
  }
  try {
    return await fn();
  } finally {
    rmSync(RUTA_LOCK, { recursive: true, force: true });
  }
}

/**
 * Filas de `invitation_template` del catálogo sembrado (`V1__initial_schema.sql`,
 * `V24__…`), verificadas por SQL en este árbol. `template_id` decide DOS cosas que el asistente de
 * `/editor` lee: el tipo de evento (`event_type`) y el nivel de plan (`invitation_plan.is_premium`,
 * 1 o 2). Por eso hacen falta tres: el camino feliz, el filtro por tipo y el bloqueo por plan.
 */
export const TEMPLATE_BODA_BASICO = 4;
export const TEMPLATE_BODA_PREMIUM = 5;
export const TEMPLATE_QUINCE_PREMIUM = 6;

/**
 * Invitación NUEVA con `uses_templates2=true` y **sin documento**: el estado inicial real del
 * producto, en el que `GET .../document` responde `404 TPL_DOCUMENT_NOT_STARTED` y el editor tiene
 * que llamar antes a `:choose-template` (contratos §4, ADR-1R-X-03).
 *
 * Las nueve columnas booleanas y `total_amount` se rellenan a la fuerza: son NULLABLE en la tabla
 * pero `InvitationEntity` las mapea a primitivos de Kotlin y un NULL convierte cualquier ruta del
 * editor en `500 TPL_INTERNAL` (defecto preexistente y ajeno, `handoffs/3-0a.md` §3).
 */
export function invitacionSinDocumento(templateId = TEMPLATE_BODA_PREMIUM, customerId?: number): number {
  const cliente = customerId ?? customerIdDemo();
  const id = sql(`INSERT INTO invitation (customer_id, template_id, is_enabled, is_paid, is_finished,
      all_events_same_location, uses_templates2, date, time, hashtag, cover_photo_url,
      children_allowed, young_allowed, has_music, has_gallery, has_extra_modules, total_amount,
      created_at, updated_at)
    VALUES (${cliente}, ${templateId}, true, true, false, false, true, '2027-04-18', '17:00', '#PruebaE2E', '',
      false, true, true, true, true, 0, now(), now()) RETURNING id;`);
  return Number(id);
}

/** Deja la invitación de la prueba fuera del camino de las siguientes corridas. */
export function borrarInvitacion(id: number): void {
  try {
    sql(`DELETE FROM tpl_document WHERE invitation_id = ${id};`);
  } catch {
    /* puede no existir; y `invitation` lo borra en cascada (V32-V37) */
  }
  try {
    sql(`DELETE FROM invitation WHERE id = ${id};`);
  } catch (error) {
    // No es fatal para la prueba (la puede referenciar un release), pero callarlo del todo dejaba
    // basura invisible: en local se acumula corrida tras corrida (I-CI-01, objeción 10).
    console.warn(`borrarInvitacion(${id}): no pude borrar la invitación —`, error);
  }
}

/**
 * Cuenta NUEVA de cliente, por la ruta real (`POST /auth/signup` + `POST /auth/token`). La usan las
 * pruebas que necesitan una cartera de invitaciones ENTERA y conocida —«todas mis invitaciones ya
 * tienen diseño» (3C-UX G-02)—, algo imposible sobre la cuenta de demostración compartida: otra
 * prueba en paralelo puede tener una invitación suya sin plantilla en ese mismo instante.
 *
 * Cada llamada crea un correo distinto, así que dos pruebas concurrentes nunca hacen login sobre la
 * MISMA cuenta (el 500 de `RefreshTokenService.kt:20`, `contratos.md` §6, es por cuenta).
 */
export async function cuentaNueva(): Promise<{ email: string; token: string; customerId: number }> {
  const email = `uxa.${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}@example.com`;
  const alta = await fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Prueba", lastName: "UX", email, password: DEMO_PASS }),
  });
  if (!alta.ok) throw new Error(`POST /auth/signup → ${alta.status}: ${await alta.text()}`);
  const sesion = await fetch(`${API_BASE}/auth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: DEMO_PASS }),
  });
  if (!sesion.ok) throw new Error(`POST /auth/token → ${sesion.status}`);
  const { accessToken } = (await sesion.json()) as { accessToken: string };
  return { email, token: accessToken, customerId: Number(sql(`SELECT id FROM customer WHERE email = '${email}';`)) };
}

/**
 * Invitación que YA tiene plantilla aplicada: se crea la fila (SQL, no hay ruta) y se le aplica el
 * documento por la RUTA REAL `:choose-template`, que es la única que lo crea (ADR-1R-X-03).
 */
export async function invitacionConDocumento(
  token: string,
  customerId: number,
  templateId = TEMPLATE_BODA_PREMIUM,
  templateSlug = "boda-clasica",
): Promise<number> {
  const id = invitacionSinDocumento(templateId, customerId);
  // La fila ya existe: si `:choose-template` falla, hay que borrarla AQUÍ. El llamador no puede —
  // no llegó a recibir el id— y su `finally` no la limpiaría: quedaría una invitación huérfana por
  // cada fallo, sin señal (I-CI-01, objeción 5 de la revisión).
  try {
    const r = await fetch(`${API_BASE}/editor/invitations/${id}/document:choose-template`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ templateSlug, templateVersion: "1.0.0" }),
    });
    if (!r.ok) throw new Error(`:choose-template → ${r.status}: ${await r.text()}`);
    return id;
  } catch (error) {
    borrarInvitacion(id);
    throw error;
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
