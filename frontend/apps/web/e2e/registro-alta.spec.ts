// e2e/registro-alta.spec.ts — el cierre de G-01 contra el BACKEND REAL: una clienta nueva, sin
// ninguna invitación, no tenía por dónde empezar (`AsistenteDeCreacion.tsx`, comentario histórico
// «este asistente NO crea invitaciones»). Desde `docs/rediseno-plantillas/memoria/handoffs/
// 5-1b-contrato-alta.md` (`POST /product/invitations`, rol USER) sí puede: este spec recorre el
// verbo entero por la URL real, como lo haría la clienta — nunca llamando funciones internas de
// React (`pruebas-producto §4`, `ui-flujo-asistente §7`).
//
// ADR-5-E1-03 (regla dura de la fase 5): cada spec crea su PROPIO usuario y su PROPIA invitación,
// nunca la sembrada compartida. `cuentaNueva()` da una cuenta con CERO invitaciones — es justo el
// estado que este spec necesita, así que no hace falta ningún ayudante de siembra adicional.
//
// Aviso del entorno (brief de este agente): el catálogo de una base recién migrada trae MUY POCAS
// plantillas — las de la fase 4 no están en esta rama. Este spec no da por supuesto ningún `slug`:
// consulta el catálogo real por HTTP antes de tocar la interfaz y usa la primera plantilla de PLAN
// 1 que encuentre (toda invitación nace en plan 1, contrato §7) — si no hay ninguna, el propio spec
// se salta con un motivo explícito en vez de fallar por un dato que no depende de este cambio.
import { expect, test } from "@playwright/test";
import { API_BASE, borrarInvitacion, cuentaNueva, sesionDemo } from "./preparar.ts";

interface ItemDeCatalogo {
  readonly slug: string;
  readonly version: string;
  readonly eventKinds: readonly string[];
  readonly minPlanTier: number;
}

async function primeraPlantillaDePlan1(token: string): Promise<ItemDeCatalogo | null> {
  const r = await fetch(`${API_BASE}/editor/templates2/catalog`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`GET /editor/templates2/catalog → ${r.status}: ${await r.text()}`);
  const { items } = (await r.json()) as { items: ItemDeCatalogo[] };
  return items.find((item) => item.minPlanTier === 1 && item.eventKinds.length > 0) ?? null;
}

test("clienta nueva sin ninguna invitación crea la suya, elige plantilla y entra al editor", async ({ page }) => {
  test.slow();
  const { token } = await cuentaNueva();
  const plantilla = await primeraPlantillaDePlan1(token);
  test.skip(plantilla === null, "Ninguna plantilla de plan 1 en el catálogo de este entorno: nada que elegir.");
  const eventKind = plantilla!.eventKinds[0];

  let invitationId: number | null = null;
  try {
    await sesionDemo(page, token);
    await page.goto("/editor");

    // ── 1. Sin invitación, ya NO es un callejón sin salida (G-01) ────────────────────────────
    await expect(page.getByRole("heading", { name: "Todavía no tienes invitaciones" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver planes" })).toHaveCount(0);
    const empezar = page.getByRole("button", { name: "Empezar mi invitación" });
    await expect(empezar).toBeVisible();
    await empezar.click();
    const tituloCrear = page.getByRole("heading", { name: "Crea tu invitación" });
    await expect(tituloCrear).toBeFocused();

    // ── 2. El alta: `POST /product/invitations`, las tres preguntas que exige junto (§2) ─────
    const fechaFutura = new Date();
    fechaFutura.setUTCFullYear(fechaFutura.getUTCFullYear() + 1);
    const fechaIso = fechaFutura.toISOString().slice(0, 10);

    await page.locator(`[data-tipo="${eventKind}"]`).click();
    await page.getByLabel("Fecha del evento").fill(fechaIso);
    await page.getByLabel("Hora de inicio").fill("17:30");

    const alta = page.waitForResponse(
      (r) => r.url().endsWith("/product/invitations") && r.request().method() === "POST",
    );
    await page.getByTestId("asistente-crear-invitacion").click();
    const respuestaAlta = await alta;
    expect(respuestaAlta.status(), "POST /product/invitations tiene que responder 201").toBe(201);
    const cuerpoAlta = (await respuestaAlta.json()) as { invitationId: number };
    invitationId = cuerpoAlta.invitationId;

    // ── 3. Avanza SOLA al paso 2, con ESA invitación (el alta no aplica plantilla, contrato §5) ─
    await expect(page).toHaveURL(/paso=plantilla/);
    await expect(page).toHaveURL(new RegExp(`inv=${invitationId}\\b`));

    // ── 4. Elige plantilla: `:choose-template`, la ruta que YA existía ───────────────────────
    await page.getByTestId(`asistente-usar-${plantilla!.slug}`).click();
    await expect(page).toHaveURL(/paso=datos/);

    // ── 5. Datos básicos es opcional de verdad — «Lo lleno después» ──────────────────────────
    await page.getByTestId("asistente-omitir").click();
    await expect(page).toHaveURL(/paso=listo/);

    // ── 6. El paso final SIEMPRE lleva a algo accionable: abre SU editor ─────────────────────
    await page.getByTestId("asistente-abrir-editor").click();
    await expect(page).toHaveURL(new RegExp(`/editor/${invitationId}$`));
  } finally {
    if (invitationId !== null) borrarInvitacion(invitationId);
  }
});

test("el tope de 3 borradores tiene una salida real: eliminar uno libera el cupo", async ({ page }) => {
  test.slow();
  const { token } = await cuentaNueva();
  const plantilla = await primeraPlantillaDePlan1(token);
  test.skip(plantilla === null, "Ninguna plantilla de plan 1 en el catálogo de este entorno: nada que elegir.");
  const eventKind = plantilla!.eventKinds[0];

  const fechaFutura = new Date();
  fechaFutura.setUTCFullYear(fechaFutura.getUTCFullYear() + 1);
  const fechaIso = fechaFutura.toISOString().slice(0, 10);

  // Los tres, CON plantilla ya aplicada: el tope de borradores no distingue «sin plantilla» de
  // «con plantilla» (contrato §4: «borrador» = suya, viva, sin release — no importa si ya eligió
  // diseño), pero el ASISTENTE solo se queda sin salida cuando NINGUNA está disponible para
  // aplicarle una plantilla — así que las tres necesitan ya tener la suya para que la pantalla de
  // «Crea tu invitación» (cierre de G-01) sea la que aparece, y no el paso 1 normal con una libre.
  async function crearBorradorConPlantilla(hashtag: string): Promise<number> {
    const alta = await fetch(`${API_BASE}/product/invitations`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ eventKind, eventDate: fechaIso, eventTime: "17:30", hashtag }),
    });
    if (!alta.ok) throw new Error(`POST /product/invitations → ${alta.status}: ${await alta.text()}`);
    const { invitationId } = (await alta.json()) as { invitationId: number };
    const elegir = await fetch(`${API_BASE}/editor/invitations/${invitationId}/document:choose-template`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ templateSlug: plantilla!.slug, templateVersion: plantilla!.version }),
    });
    if (!elegir.ok) throw new Error(`:choose-template → ${elegir.status}: ${await elegir.text()}`);
    return invitationId;
  }

  // Tres borradores por HTTP directo (más rápido y más claro que repetir la interfaz tres veces:
  // lo que este spec mide es la SALIDA del tope, no el alta feliz, que ya cubre la prueba de arriba).
  const tresIds = [
    await crearBorradorConPlantilla("#uno"),
    await crearBorradorConPlantilla("#dos"),
    await crearBorradorConPlantilla("#tres"),
  ];

  try {
    await sesionDemo(page, token);
    await page.goto("/editor");

    // Las tres YA tienen plantilla: el paso 1 no tiene nada libre que preguntar (misma pantalla que
    // prueba `e2e/asistente.spec.ts`, de otra sesión — por eso este spec no repite el formulario de
    // alta aquí: se limita al caso SIN NINGUNA invitación, ver la prueba de arriba). Lo que SÍ es de
    // este agente: cada fila ahora ofrece «Eliminar» de verdad — la salida real que el `409` del
    // tope siempre prometió (contrato §1 bis, §4).
    await expect(page.getByRole("heading", { name: "Todas tus invitaciones ya tienen diseño", level: 1 })).toBeVisible();
    const filaUno = page.getByTestId(`asistente-eliminar-${tresIds[0]}`);
    await expect(filaUno).toBeVisible();

    page.once("dialog", (dialogo) => void dialogo.accept());
    const borrado = page.waitForResponse(
      (r) => r.url().endsWith(`/product/invitations/${tresIds[0]}`) && r.request().method() === "DELETE",
    );
    await filaUno.click();
    expect((await borrado).status(), "DELETE /product/invitations/{id} tiene que responder 204").toBe(204);
    await expect(filaUno).toHaveCount(0); // la fila desaparece: el cupo quedó libre de verdad

    // Y con el cupo libre, la ruta real vuelve a aceptar un alta (no por la interfaz — sin ninguna
    // «sin plantilla» disponible, este spec no tiene un formulario que reabrir aquí, ver arriba —
    // sino la misma ruta que el resto de este archivo verifica desde la UI).
    const cuarta = await fetch(`${API_BASE}/product/invitations`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ eventKind, eventDate: fechaIso, eventTime: "17:30", hashtag: "#cuatro" }),
    });
    expect(cuarta.status).toBe(201);
    const { invitationId: cuartaId } = (await cuarta.json()) as { invitationId: number };
    borrarInvitacion(cuartaId);
  } finally {
    for (const id of tresIds.slice(1)) borrarInvitacion(id);
    // `tresIds[0]` ya se borró desde la interfaz; un segundo intento (por si el paso falló antes de
    // llegar ahí) no es un error para la limpieza.
    borrarInvitacion(tresIds[0]);
  }
});
