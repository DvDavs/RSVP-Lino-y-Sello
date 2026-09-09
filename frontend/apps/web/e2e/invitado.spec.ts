// e2e/invitado.spec.ts — el enlace personal del invitado (`/r/[token]`), SIN sesión: la ruta que
// más gente abre del producto entero, casi siempre desde WhatsApp (contrato `5-2-contrato-
// invitados.md` §2, skill `pruebas-producto` §4 — REGLA DURA: cada spec crea su propia invitación y
// sus propios invitados, nunca la sembrada compartida).
//
// El token de un invitado se obtiene por la ÚNICA ruta que lo revela —
// `GET /product/invitations/{id}/guests/{guestId}/link`, con el token de LA CLIENTA — nunca por SQL
// (`enlaceDelInvitado` más abajo): así el spec ejerce de paso el camino real, igual que
// `scripts/seed/invitados.sh` ya documenta para quien escriba este mismo spec.
//
// Dos cosas que el encargo avisó que muerden, y por eso quedan resueltas aquí en vez de en la
// primera prueba que tropiece con ellas:
//   1. `crearInvitacionPublicable` (de `preparar-panel.ts`) deja la invitación PUBLICABLE
//      (`canPublish: true`), NO publicada. Sin `publicarInvitacion` (helper local, `POST …/release`)
//      `/r/[token]` respondería el mismo 404 que un token inventado — es el caso 5, no un fallo del
//      camino feliz.
//   2. `GuestAttendanceService.isAtLeastOneDayBefore` rechaza confirmar si la fecha del evento ya
//      pasó. `invitacionSinDocumento` (que `crearInvitacionPublicable` usa por debajo) ya siembra
//      `date = '2027-04-18'`, así que esto no muerde aquí — se deja constancia por si cambia.
import { expect, test, type Page } from "@playwright/test";
import { API_BASE, borrarInvitacion, jwtDemo, revisionActual, sesionDemo, sql } from "./preparar.ts";
import { crearInvitacionPublicable } from "./preparar-panel.ts";

test.use({ viewport: { width: 1280, height: 900 } });

interface InvitadoAlta {
  readonly fullName: string;
  readonly adults: number;
  readonly children?: number;
  readonly young?: number;
}

/**
 * Publica la invitación por la ruta real (`POST .../release`), leyendo antes la revisión vigente —
 * mismo patrón que `aplicarOperaciones` de `preparar.ts`. `crearInvitacionPublicable` NO publica
 * (ver cabecera del fichero): sin este paso todos los casos del camino feliz fallarían por el motivo
 * equivocado.
 */
async function publicarInvitacion(invitationId: number, token: string): Promise<void> {
  const baseRevision = await revisionActual(invitationId, token);
  const r = await fetch(`${API_BASE}/editor/invitations/${invitationId}/release`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ baseRevision }),
  });
  if (!r.ok) throw new Error(`POST .../release respondió ${r.status}: ${await r.text()}`);
}

/** Alta por la ruta real del panel (contrato §1), con el token de la propia clienta. */
async function altaInvitado(invitationId: number, token: string, datos: InvitadoAlta): Promise<number> {
  const r = await fetch(`${API_BASE}/product/invitations/${invitationId}/guests`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!r.ok) throw new Error(`POST .../guests respondió ${r.status}: ${await r.text()}`);
  const cuerpo = (await r.json()) as { id: number };
  return cuerpo.id;
}

/** La ÚNICA ruta que revela el token de un invitado (contrato §1, hallazgo S-13). */
async function enlaceDelInvitado(invitationId: number, token: string, guestId: number): Promise<string> {
  const r = await fetch(`${API_BASE}/product/invitations/${invitationId}/guests/${guestId}/link`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`GET .../link respondió ${r.status}: ${await r.text()}`);
  const cuerpo = (await r.json()) as { url: string };
  const tokenInvitado = cuerpo.url.split("/r/").pop();
  if (!tokenInvitado) throw new Error(`No pude extraer el token de «${cuerpo.url}»`);
  return tokenInvitado;
}

/**
 * Invitación NUEVA, elegida y rellenada por `crearInvitacionPublicable`, y publicada de verdad con
 * `publicarInvitacion`. Lista para dar de alta invitados de prueba.
 */
async function invitacionPublicada(): Promise<{ invitationId: number; token: string }> {
  const token = await jwtDemo();
  const invitationId = await crearInvitacionPublicable(token);
  await publicarInvitacion(invitationId, token);
  return { invitationId, token };
}

/** 22 caracteres del mismo alfabeto que `JwtUtil.generateInvitationSecureToken()` — un token que
 *  parece real pero no lo es, para el caso 5. */
function tokenInventado(): string {
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let salida = "";
  for (let i = 0; i < 22; i += 1) salida += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return salida;
}

/** `invitation_guest` NO tiene `ON DELETE CASCADE` hacia `invitation`
 *  (`V8__create_invitation_guest_table.sql:27-29`): sin este paso, `borrarInvitacion` (que traga el
 *  error de FK) dejaría la invitación huérfana con sus invitados dentro. */
function borrarInvitacionConInvitados(invitationId: number): void {
  try {
    sql(`DELETE FROM invitation_guest WHERE invitation_id = ${invitationId};`);
  } catch {
    /* nada que borrar */
  }
  borrarInvitacion(invitationId);
}

/** El estado "este enlace ya no funciona" (`RSVP_LINK_NOT_FOUND`, contrato §0.5): un único cuerpo
 *  para los seis motivos de fallo. */
async function esperarNoResuelve(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Este enlace ya no funciona" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Pídele a quien te invitó que te mande el suyo otra vez.")).toBeVisible();
}

test("token válido y publicado: ve su nombre y sus lugares, confirma y pasa al resumen", async ({ page }) => {
  const { invitationId, token } = await invitacionPublicada();
  try {
    const guestId = await altaInvitado(invitationId, token, { fullName: "Renata Camino Feliz", adults: 2 });
    const guestToken = await enlaceDelInvitado(invitationId, token, guestId);

    await page.goto(`/r/${guestToken}`);
    await expect(page.getByRole("heading", { name: "Renata Camino Feliz" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Te apartamos 2 lugares de adulto.")).toBeVisible();

    const tarjeta = page.locator("#r-tarjeta-decision");
    await tarjeta.getByRole("button", { name: "Confirmar mi asistencia" }).click();

    await expect(page.getByText("Quedaste confirmada")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Apartamos 2 adultos a tu nombre.")).toBeVisible();
  } finally {
    borrarInvitacionConInvitados(invitationId);
  }
});

test("cambia de opinión: confirmar, declinar y volver a confirmar", async ({ page }) => {
  const { invitationId, token } = await invitacionPublicada();
  try {
    const guestId = await altaInvitado(invitationId, token, { fullName: "Diego Cambia De Opinión", adults: 1 });
    const guestToken = await enlaceDelInvitado(invitationId, token, guestId);

    await page.goto(`/r/${guestToken}`);
    const tarjeta = page.locator("#r-tarjeta-decision");
    await expect(tarjeta.getByRole("heading", { name: "¿Nos acompañas?" })).toBeVisible({ timeout: 15_000 });

    // 1) Confirma.
    await tarjeta.getByRole("button", { name: "Confirmar mi asistencia" }).click();
    await expect(page.getByText("Quedaste confirmada")).toBeVisible({ timeout: 10_000 });

    // 2) Cambia de opinión y declina.
    await page.getByRole("button", { name: "Cambiar mi respuesta" }).click();
    await tarjeta.getByRole("radio", { name: "No podré ir" }).check();
    await tarjeta.getByRole("button", { name: "Avisar que no podré ir" }).click();
    await expect(page.getByText("Avisamos que no podrás ir")).toBeVisible({ timeout: 10_000 });

    // 3) Cambia de opinión otra vez y vuelve a confirmar — el mismo `confirmationToken`, los dos
    //    sentidos (contrato §0.4).
    await page.getByRole("button", { name: "Cambiar mi respuesta" }).click();
    await tarjeta.getByRole("radio", { name: "Sí, ahí estaré" }).check();
    await tarjeta.getByRole("button", { name: "Confirmar mi asistencia" }).click();
    await expect(page.getByText("Quedaste confirmada")).toBeVisible({ timeout: 10_000 });
  } finally {
    borrarInvitacionConInvitados(invitationId);
  }
});

test("no puede confirmar más lugares de los que tiene asignados", async ({ page }) => {
  const { invitationId, token } = await invitacionPublicada();
  try {
    const guestId = await altaInvitado(invitationId, token, { fullName: "Paola Un Solo Lugar", adults: 1 });
    const guestToken = await enlaceDelInvitado(invitationId, token, guestId);

    await page.goto(`/r/${guestToken}`);
    const tarjeta = page.locator("#r-tarjeta-decision");
    await expect(tarjeta.getByRole("heading", { name: "¿Nos acompañas?" })).toBeVisible({ timeout: 15_000 });

    // El producto ya lo impide en la interfaz: con un solo lugar asignado, el botón "+" nace
    // deshabilitado (`Contador.tsx`, `puedeSumar = valor < maximo`).
    await expect(tarjeta.getByRole("button", { name: "Uno más: Adultos" })).toBeDisabled();

    // Defensa en profundidad: aunque alguien se salte la interfaz, el backend rechaza igual
    // (contrato §2: "Cupos por encima de lo asignado → 422 GUEST_QUOTA_EXCEEDED").
    const respuesta = await page.request.put(`${API_BASE}/public/r/${guestToken}`, {
      data: { attending: true, adults: 5, children: 0, young: 0 },
    });
    expect(respuesta.status()).toBe(422);
    expect(await respuesta.json()).toEqual({
      code: "GUEST_QUOTA_EXCEEDED",
      message: "No puedes confirmar más lugares de los que te asignaron",
    });

    // El rechazo no dejó rastro: la invitada sigue exactamente como estaba.
    const estado = await page.request.get(`${API_BASE}/public/r/${guestToken}`);
    expect((await estado.json()).guest.status).toBe("PENDING");
  } finally {
    borrarInvitacionConInvitados(invitationId);
  }
});

test("la clienta ve la confirmación en su panel", async ({ page }) => {
  const { invitationId, token } = await invitacionPublicada();
  try {
    const guestId = await altaInvitado(invitationId, token, { fullName: "Ximena Ve Su Panel", adults: 3 });
    const guestToken = await enlaceDelInvitado(invitationId, token, guestId);

    await page.goto(`/r/${guestToken}`);
    const tarjeta = page.locator("#r-tarjeta-decision");
    await expect(tarjeta.getByRole("heading", { name: "¿Nos acompañas?" })).toBeVisible({ timeout: 15_000 });
    // Recorta un lugar (3 → 2) para que el panel muestre un recuento distinto del invitado, y así
    // demuestre que lee la respuesta real y no solo "confirmó sí/no".
    await tarjeta.getByRole("button", { name: "Uno menos: Adultos" }).click();
    await tarjeta.getByRole("button", { name: "Confirmar mi asistencia" }).click();
    await expect(page.getByText("Quedaste confirmada")).toBeVisible({ timeout: 10_000 });

    // El punto donde las dos mitades del producto se tocan: la clienta, en OTRA página y con SU
    // propia sesión, ve la respuesta que la invitada acaba de dar.
    const paginaClienta = await page.context().newPage();
    await sesionDemo(paginaClienta, token);
    await paginaClienta.goto(`/editor/${invitationId}/invitados`);
    await paginaClienta.getByPlaceholder("Nombre del invitado").fill("Ximena Ve Su Panel");

    const fila = paginaClienta.getByRole("row", { name: /Ximena Ve Su Panel/ });
    await expect(fila).toBeVisible({ timeout: 15_000 });
    await expect(fila.getByText("Confirmada")).toBeVisible();
    await expect(fila.getByText("usa 2A 0N 0J")).toBeVisible();
    await paginaClienta.close();
  } finally {
    borrarInvitacionConInvitados(invitationId);
  }
});

test("un token inventado y uno de una invitación sin publicar son indistinguibles", async ({ page }) => {
  const token = await jwtDemo();
  // A propósito SIN `publicarInvitacion`: es el caso 5 del encargo.
  const invitationId = await crearInvitacionPublicable(token);
  try {
    const guestId = await altaInvitado(invitationId, token, { fullName: "Invitado Sin Publicar", adults: 1 });
    const tokenSinPublicar = await enlaceDelInvitado(invitationId, token, guestId);
    const tokenInvent = tokenInventado();

    // Mismo estado HTTP, mismo cuerpo, byte a byte.
    const respuestaInventado = await page.request.get(`${API_BASE}/public/r/${tokenInvent}`);
    const respuestaSinPublicar = await page.request.get(`${API_BASE}/public/r/${tokenSinPublicar}`);
    expect(respuestaInventado.status()).toBe(404);
    expect(respuestaSinPublicar.status()).toBe(404);
    const cuerpoInventado = await respuestaInventado.json();
    expect(cuerpoInventado).toEqual({ code: "RSVP_LINK_NOT_FOUND", message: "Este enlace ya no funciona" });
    expect(await respuestaSinPublicar.json()).toEqual(cuerpoInventado);

    // Y en la pantalla que ve la invitada: mismo texto para los dos, ninguna pista de cuál "existía".
    await page.goto(`/r/${tokenInvent}`);
    await esperarNoResuelve(page);
    const textoInventado = await page.locator("main").innerText();

    await page.goto(`/r/${tokenSinPublicar}`);
    await esperarNoResuelve(page);
    const textoSinPublicar = await page.locator("main").innerText();

    expect(textoSinPublicar).toBe(textoInventado);
  } finally {
    borrarInvitacionConInvitados(invitationId);
  }
});

test("la página no expone datos de otros invitados", async ({ page }) => {
  const { invitationId, token } = await invitacionPublicada();
  try {
    const idUno = await altaInvitado(invitationId, token, { fullName: "Fernanda Datos Propios Uno", adults: 1 });
    await altaInvitado(invitationId, token, { fullName: "Roberto Datos Ajenos Oculto", adults: 1 });
    const tokenUno = await enlaceDelInvitado(invitationId, token, idUno);

    await page.goto(`/r/${tokenUno}`);
    await expect(page.getByRole("heading", { name: "Fernanda Datos Propios Uno" })).toBeVisible({ timeout: 15_000 });

    const html = await page.content();
    expect(html).not.toContain("Roberto Datos Ajenos Oculto");
  } finally {
    borrarInvitacionConInvitados(invitationId);
  }
});
