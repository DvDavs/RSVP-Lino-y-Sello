// e2e/invitados.spec.ts — el recorrido de la clienta en `/editor/[invitationId]/invitados`
// (sesión E2-F1, contrato `handoffs/5-2-contrato-invitados.md` §1). Contra el BACKEND REAL, sin
// mocks (04 §20.3): cada prueba crea su PROPIA invitación —y usa la cuenta de demostración cacheada,
// nunca escribe sobre la invitación sembrada compartida— y la borra en un `finally` (`06 §8.2`
// punto 4 / I-CI-01). `fullyParallel` con 4 workers tiene que pasar.
import { expect, test } from "@playwright/test";
import { API_BASE, jwtDemo, sesionDemo } from "./preparar.ts";
import { crearInvitacionPublicable } from "./preparar-panel.ts";
import { borrarInvitacionConInvitados, crearInvitadoDirecto } from "./preparar-invitados.ts";

test.use({ viewport: { width: 1440, height: 900 } });

/** Sufijo único por prueba: nombres/correos que no chocan entre workers ni entre corridas. */
function sufijo(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** El bloque de contadores es un `<dl>`: cada par `<dt>`/`<dd>` vive en el mismo `<div>`. Localiza
 *  el `<dd>` por el texto EXACTO de su `<dt>` hermano, sin depender de que el valor sea único en la
 *  página (evita casar con cualquier otro «1» o «0» sueltos). */
function valorContador(page: import("@playwright/test").Page, etiqueta: string) {
  return page.locator("dl > div").filter({ has: page.getByText(etiqueta, { exact: true }) }).locator("dd");
}

/** Enlace personal de UN invitado, por la ruta real, para comparar contra lo que la interfaz pide. */
async function enlaceDirecto(invitationId: number, guestId: number, token: string): Promise<string> {
  const r = await fetch(`${API_BASE}/product/invitations/${invitationId}/guests/${guestId}/link`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`GET .../link respondió ${r.status}`);
  const cuerpo = (await r.json()) as { url: string };
  return cuerpo.url;
}

test("1-3. dar de alta un invitado, verlo en la lista con sus cupos, y los contadores en vivo lo reflejan", async ({ page }) => {
  const token = await jwtDemo();
  const invitationId = await crearInvitacionPublicable(token);
  try {
    await sesionDemo(page, token);
    await page.goto(`/editor/${invitationId}/invitados`);
    // `exact: true`: sin invitados, «Todavía no tienes invitados» del `EmptyState` TAMBIÉN casa como
    // subcadena de «Invitados» (medido con `--workers=4 --repeat-each=2`: la invitación recién creada
    // pasa por ese estado vacío antes de que la prueba dé de alta a nadie).
    await expect(page.getByRole("heading", { name: "Invitados", exact: true })).toBeVisible({ timeout: 20_000 });

    // Contadores en cero antes de dar de alta a nadie.
    await expect(valorContador(page, "Pendientes")).toHaveText("0");
    await expect(valorContador(page, "Lugares")).toHaveText("0 de 0");

    const nombre = `Elena Prueba ${sufijo()}`;
    await page.getByRole("button", { name: "Agregar invitado" }).first().click();
    await page.getByLabel("Nombre completo").fill(nombre);
    await page.getByLabel("Correo electrónico").fill(`elena.${sufijo()}@example.com`);
    await page.getByLabel("Adultos").fill("2");
    // `children_allowed=false` en `crearInvitacionPublicable` (vía `invitacionSinDocumento`): el
    // campo «Niños» no se ofrece. `young_allowed=true`, así que «Jóvenes» sí.
    await expect(page.getByLabel("Niños")).toHaveCount(0);
    await page.getByLabel("Jóvenes").fill("1");

    const alta = page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().endsWith(`/product/invitations/${invitationId}/guests`),
    );
    await page.getByRole("button", { name: "Guardar invitado" }).click();
    expect((await alta).status(), "POST …/guests tiene que responder 201").toBe(201);

    // ── Caso 1: aparece en la lista con sus cupos (2 adultos, 0 niños, 1 joven) ──────────────
    const fila = page.locator("tr", { hasText: nombre });
    await expect(fila).toBeVisible();
    await expect(fila.getByText("2A 0N 1J")).toBeVisible();

    // ── Caso 3: los contadores en vivo reflejan el alta, sin recargar la página ───────────────
    await expect(valorContador(page, "Pendientes")).toHaveText("1");
    await expect(valorContador(page, "Lugares")).toHaveText("0 de 3");
  } finally {
    borrarInvitacionConInvitados(invitationId);
  }
});

test("2. pegar una lista con un renglón bueno y uno malo: la previsualización cuenta, sugiere y solo da de alta lo bueno", async ({ page }) => {
  const token = await jwtDemo();
  const invitationId = await crearInvitacionPublicable(token);
  try {
    await sesionDemo(page, token);
    await page.goto(`/editor/${invitationId}/invitados`);
    // `exact: true`: sin invitados, «Todavía no tienes invitados» del `EmptyState` TAMBIÉN casa como
    // subcadena de «Invitados» (medido con `--workers=4 --repeat-each=2`: la invitación recién creada
    // pasa por ese estado vacío antes de que la prueba dé de alta a nadie).
    await expect(page.getByRole("heading", { name: "Invitados", exact: true })).toBeVisible({ timeout: 20_000 });

    const nombreBueno = `Renglon Bueno ${sufijo()}`;
    // Buen renglón: nombre, adultos, niños, jóvenes. Mal renglón: sin nombre (empieza en coma), el
    // caso EXACTO que `GuestPasteReaderTest.kt` fija: «Falta el nombre.» / «Escríbelo antes de la
    // primera coma.» — nunca un «formato inválido» genérico (contrato §1).
    const texto = `${nombreBueno}, 1, 0, 0\n, 2, 0, 0`;

    await page.getByRole("button", { name: "Pegar una lista" }).first().click();
    await page.getByPlaceholder(/María Fernanda Cruz, 2, 1, 0/).fill(texto);

    const previa = page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().endsWith(`/product/invitations/${invitationId}/guests:preview`),
    );
    await page.getByRole("button", { name: "Revisar lista" }).click();
    expect((await previa).status()).toBe(200);

    // La previsualización dice cuántos están listos y cuántos tienen problema.
    await expect(page.getByText("Vista previa: 1 invitado listo, 1 con problema")).toBeVisible();
    // El error del renglón malo sugiere la corrección — nunca un genérico.
    await expect(page.getByText("Renglón 2:")).toBeVisible();
    await expect(page.getByText("Falta el nombre.")).toBeVisible();
    await expect(page.getByText("Escríbelo antes de la primera coma.")).toBeVisible();
    await expect(page.getByText(/formato inválido/i)).toHaveCount(0);

    const importar = page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().endsWith(`/product/invitations/${invitationId}/guests:import`),
    );
    await page.getByRole("button", { name: "Agregar el 1 que está bien" }).click();
    expect((await importar).status()).toBe(200);

    // Al aceptar se dan de alta SOLO los buenos.
    await expect(page.locator("tr", { hasText: nombreBueno })).toBeVisible();
    await expect(valorContador(page, "Pendientes")).toHaveText("1");
  } finally {
    borrarInvitacionConInvitados(invitationId);
  }
});

test("4. búsqueda por nombre y filtro por estado acotan la lista de verdad", async ({ page }) => {
  const token = await jwtDemo();
  const invitationId = await crearInvitacionPublicable(token);
  try {
    const suf = sufijo();
    const nombreUno = `Buscable Uno ${suf}`;
    const nombreDos = `Distinto Dos ${suf}`;
    await crearInvitadoDirecto(invitationId, token, { fullName: nombreUno, adults: 1 });
    await crearInvitadoDirecto(invitationId, token, { fullName: nombreDos, adults: 1 });

    await sesionDemo(page, token);
    await page.goto(`/editor/${invitationId}/invitados`);
    // `exact: true`: sin invitados, «Todavía no tienes invitados» del `EmptyState` TAMBIÉN casa como
    // subcadena de «Invitados» (medido con `--workers=4 --repeat-each=2`: la invitación recién creada
    // pasa por ese estado vacío antes de que la prueba dé de alta a nadie).
    await expect(page.getByRole("heading", { name: "Invitados", exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("tr", { hasText: nombreUno })).toBeVisible();
    await expect(page.locator("tr", { hasText: nombreDos })).toBeVisible();

    // ── Búsqueda: acota a quien casa, deja fuera al resto ─────────────────────────────────────
    await page.getByLabel("Buscar por nombre").fill("Buscable Uno");
    await expect(page.locator("tr", { hasText: nombreUno })).toBeVisible();
    await expect(page.locator("tr", { hasText: nombreDos })).toHaveCount(0);
    await page.getByLabel("Buscar por nombre").fill("");
    await expect(page.locator("tr", { hasText: nombreDos })).toBeVisible();

    // ── Filtro por estado: los dos son PENDING recién creados, así que «No asisten» los deja a
    //    los dos fuera de verdad (no es decorativo: la lista pasa a estar vacía). ────────────────
    await page.getByRole("combobox", { name: "Filtrar por estado" }).click();
    await page.getByRole("option", { name: "No asisten" }).click();
    await expect(page.getByText("Todavía no tienes invitados")).toBeVisible();
    await expect(page.locator("tr", { hasText: nombreUno })).toHaveCount(0);

    // Y «Pendientes» los vuelve a traer a los dos.
    await page.getByRole("combobox", { name: "Filtrar por estado" }).click();
    await page.getByRole("option", { name: "Pendientes" }).click();
    await expect(page.locator("tr", { hasText: nombreUno })).toBeVisible();
    await expect(page.locator("tr", { hasText: nombreDos })).toBeVisible();
  } finally {
    borrarInvitacionConInvitados(invitationId);
  }
});

test("5. editar un invitado y borrarlo con su confirmación", async ({ page }) => {
  const token = await jwtDemo();
  const invitationId = await crearInvitacionPublicable(token);
  try {
    const suf = sufijo();
    const nombreOriginal = `Editar Original ${suf}`;
    const nombreNuevo = `Editar Cambiado ${suf}`;
    await crearInvitadoDirecto(invitationId, token, { fullName: nombreOriginal, adults: 1 });

    await sesionDemo(page, token);
    await page.goto(`/editor/${invitationId}/invitados`);
    // `exact: true`: sin invitados, «Todavía no tienes invitados» del `EmptyState` TAMBIÉN casa como
    // subcadena de «Invitados» (medido con `--workers=4 --repeat-each=2`: la invitación recién creada
    // pasa por ese estado vacío antes de que la prueba dé de alta a nadie).
    await expect(page.getByRole("heading", { name: "Invitados", exact: true })).toBeVisible({ timeout: 20_000 });

    // ── Editar ──────────────────────────────────────────────────────────────────────────────
    await page.getByRole("button", { name: `Editar a ${nombreOriginal}` }).click();
    await expect(page.getByRole("heading", { name: "Editar invitado" })).toBeVisible();
    const campoNombre = page.getByLabel("Nombre completo");
    await campoNombre.fill("");
    await campoNombre.fill(nombreNuevo);

    const edicion = page.waitForResponse(
      (r) => r.request().method() === "PUT" && /\/product\/invitations\/\d+\/guests\/\d+$/.test(new URL(r.url()).pathname),
    );
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    expect((await edicion).status()).toBe(200);
    await expect(page.locator("tr", { hasText: nombreNuevo })).toBeVisible();
    await expect(page.locator("tr", { hasText: nombreOriginal })).toHaveCount(0);

    // ── Borrar, con su paso de confirmación ────────────────────────────────────────────────────
    await page.getByRole("button", { name: `Editar a ${nombreNuevo}` }).click();
    await expect(page.getByRole("heading", { name: "Editar invitado" })).toBeVisible();
    await page.getByRole("button", { name: "Eliminar invitado" }).click();
    // El paso de confirmación es una pantalla distinta del mismo diálogo, con el nombre de por medio.
    await expect(page.getByRole("heading", { name: `¿Eliminar a ${nombreNuevo}?` })).toBeVisible();

    const borrado = page.waitForResponse(
      (r) => r.request().method() === "DELETE" && /\/product\/invitations\/\d+\/guests\/\d+$/.test(new URL(r.url()).pathname),
    );
    await page.getByRole("button", { name: "Eliminar invitado" }).click();
    expect((await borrado).status()).toBe(204);
    await expect(page.locator("tr", { hasText: nombreNuevo })).toHaveCount(0);
  } finally {
    borrarInvitacionConInvitados(invitationId);
  }
});

test("6. pedir el enlace personal desde la acción de compartir: la URL apunta a /r/<token>", async ({ page, context }) => {
  const token = await jwtDemo();
  const invitationId = await crearInvitacionPublicable(token);
  try {
    const nombre = `Enlace Personal ${sufijo()}`;
    const guestId = await crearInvitadoDirecto(invitationId, token, { fullName: nombre, adults: 1 });
    const enlaceReal = await enlaceDirecto(invitationId, guestId, token);
    expect(enlaceReal).toMatch(/\/r\/[^/]+$/);

    await sesionDemo(page, token);
    await page.goto(`/editor/${invitationId}/invitados`);
    // `exact: true`: sin invitados, «Todavía no tienes invitados» del `EmptyState` TAMBIÉN casa como
    // subcadena de «Invitados» (medido con `--workers=4 --repeat-each=2`: la invitación recién creada
    // pasa por ese estado vacío antes de que la prueba dé de alta a nadie).
    await expect(page.getByRole("heading", { name: "Invitados", exact: true })).toBeVisible({ timeout: 20_000 });

    // «Ver el enlace» pide `GET …/link` EN EL MOMENTO (nunca antes, contrato §0.3) y abre lo que
    // devuelve con `window.open`. Se comprueba lo que la acción de compartir pide de verdad — el
    // cuerpo de esa respuesta — en vez de esperar a que la pestaña emergente cargue: `url` la
    // construye el backend con `app.frontend.url` (`FRONTEND_URL`), que en ESTE entorno de e2e
    // (`scripts/dev-backend.sh`, fuera de mi área) no apunta al servidor de Playwright, así que la
    // navegación real de la pestaña emergente falla con `chrome-error://chromewebdata/` — verificado
    // por separado, no es un defecto de `modules/product/guests` — y no es lo que este caso mide.
    const [respuestaEnlace, popup] = await Promise.all([
      page.waitForResponse(
        (r) => r.request().method() === "GET" && /\/product\/invitations\/\d+\/guests\/\d+\/link$/.test(new URL(r.url()).pathname),
      ),
      context.waitForEvent("page"),
      page.getByRole("button", { name: `Ver el enlace de ${nombre}` }).click(),
    ]);
    expect(respuestaEnlace.status()).toBe(200);
    const cuerpoEnlace = (await respuestaEnlace.json()) as { url: string };
    expect(new URL(cuerpoEnlace.url).pathname).toMatch(/^\/r\/[^/]+$/);

    // La pestaña que `window.open` abrió (aunque su navegación real falle en este entorno, por lo
    // de arriba) se cierra para no dejarla colgando entre pruebas.
    await popup.close();
  } finally {
    borrarInvitacionConInvitados(invitationId);
  }
});

test("7. exportar el CSV: la descarga llega y no contiene ningún token", async ({ page }) => {
  const token = await jwtDemo();
  const invitationId = await crearInvitacionPublicable(token);
  try {
    const nombre = `Exportar CSV ${sufijo()}`;
    const guestId = await crearInvitadoDirecto(invitationId, token, { fullName: nombre, adults: 1 });
    const enlaceReal = await enlaceDirecto(invitationId, guestId, token);
    // El token es el último tramo de la URL personal — lo que NO debe aparecer en el CSV (S-13).
    const tokenInvitado = enlaceReal.split("/").pop();
    expect(tokenInvitado, "hace falta un token real contra el que comparar").toBeTruthy();

    await sesionDemo(page, token);
    await page.goto(`/editor/${invitationId}/invitados`);
    // `exact: true`: sin invitados, «Todavía no tienes invitados» del `EmptyState` TAMBIÉN casa como
    // subcadena de «Invitados» (medido con `--workers=4 --repeat-each=2`: la invitación recién creada
    // pasa por ese estado vacío antes de que la prueba dé de alta a nadie).
    await expect(page.getByRole("heading", { name: "Invitados", exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("tr", { hasText: nombre })).toBeVisible();

    const [descarga] = await Promise.all([
      page.waitForEvent("download"),
      // `exact: true`: el nombre del invitado de prueba lleva «Exportar CSV» dentro, así que sus
      // botones de fila («Editar a…», «Copiar enlace de…») también CONTIENEN la palabra «Exportar» y
      // Playwright los cuela con una coincidencia de subcadena normal.
      page.getByRole("button", { name: "Exportar", exact: true }).click(),
    ]);
    const ruta = await descarga.path();
    expect(ruta, "la descarga tiene que llegar a un archivo real").toBeTruthy();
    const contenido = await (await import("node:fs")).promises.readFile(ruta as string, "utf8");

    // Encabezados es-MX del contrato §1, sin tokens.
    expect(contenido).toContain("Nombre,Correo,Teléfono,Mesa,Adultos");
    expect(contenido).toContain(nombre);
    expect(contenido).not.toContain(tokenInvitado as string);
  } finally {
    borrarInvitacionConInvitados(invitationId);
  }
});
