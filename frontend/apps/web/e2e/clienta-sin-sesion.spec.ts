// e2e/clienta-sin-sesion.spec.ts — EL RECORRIDO COMO UNA PERSONA (bloque 3-8).
//
// Por qué existe. La suite e2e estaba EN VERDE mientras el producto estaba roto para una clienta:
// E-01 (`flujo-principal.spec.ts`) entra con la sesión ya inyectada en `sessionStorage`, teclea
// `/editor/{id}` con un id que solo conoce un script de siembra, y pulsa por `data-testid`. Con esa
// llave maestra, los dos muros que hicieron abandonar a la revisión de uso —U-1, no hay forma de
// iniciar sesión; U-2, «Elegir esta plantilla» no hace nada— eran invisibles para las pruebas.
//
// Esta prueba renuncia a las tres llaves:
//   1. **Sin sesión**: no llama a `sesionDemo()`; empieza con `sessionStorage` vacío, como quien
//      abre el sitio por primera vez.
//   2. **Sin URLs internas**: la única dirección que teclea es `/editor`. A `/acceso` y a
//      `/editor/{id}` llega NAVEGANDO, pulsando lo que ve.
//   3. **Sin `data-testid`**: todo se localiza por su nombre accesible visible
//      (`getByRole`/`getByLabel`), que es lo único que una persona puede leer.
//
// Con el código anterior al bloque 3-8 falla en el PRIMER paso (no existe ningún control que lleve a
// iniciar sesión) y, si se le regalara la sesión, volvería a fallar al pulsar «Elegir esta
// plantilla» (botón sin manejador, cero peticiones).
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { DEMO_EMAIL, DEMO_PASS, borrarInvitacion, invitacionSinDocumento } from "./preparar.ts";

const FOTO_PORTADA = fileURLToPath(new URL("./fixtures/foto-vertical.png", import.meta.url));

const EVIDENCIA = new URL("../../../../docs/rediseno-plantillas/evidencia/fase-3/ux-corregido/", import.meta.url).pathname;
if (!existsSync(EVIDENCIA)) mkdirSync(EVIDENCIA, { recursive: true });

// 1440×900 es la ventana con la que se hizo la revisión de uso original.
test.use({ viewport: { width: 1440, height: 900 } });

// Un solo `POST /auth/token` en toda la prueba: dos autenticaciones simultáneas de la misma cuenta
// hacen 500 en `RefreshTokenService.kt:20` (defecto ajeno, `preguntas-abiertas.md` § P-3-3b-8). Por
// eso este archivo va en serie y nunca vuelve a entrar.
test.describe.configure({ mode: "serial" });

async function esperarGuardado(page: Page): Promise<void> {
  await expect(page.locator("[data-save-state]")).toHaveAttribute("data-save-state", "idle", { timeout: 20_000 });
}

test("una persona sin sesión entra, elige plantilla, escribe, publica y su enlace abre y está al día", async ({
  page,
  browser,
}) => {
  test.slow();
  const invitationId = invitacionSinDocumento();
  const primerNombre = `Ana & Luis ${Date.now().toString(36)}`;
  const segundoNombre = `${primerNombre} (corregido)`;

  try {
    // ── 1. Llega al sitio SIN sesión ────────────────────────────────────────────────────────
    await page.goto("/editor");
    await expect(page.getByRole("heading", { name: "Elige una plantilla" })).toBeVisible({ timeout: 20_000 });

    // U-1: el aviso ya no es un callejón sin salida. Ni un enlace de la página va a «#».
    const muertos = await page.locator('a[href="#"]').count();
    expect(muertos, "un enlace que no lleva a nada es peor que no tenerlo (U-1)").toBe(0);
    await page.screenshot({ path: `${EVIDENCIA}01-sin-sesion-hay-salida.png` });

    // ── 2. Entra a su cuenta pulsando lo que ve ─────────────────────────────────────────────
    await page.getByRole("link", { name: "Iniciar sesión" }).first().click();
    await expect(page.getByRole("heading", { name: "Entra a tu cuenta" })).toBeVisible();
    await page.getByLabel("Correo electrónico").fill(DEMO_EMAIL);
    await page.getByLabel("Contraseña").fill(DEMO_PASS);
    await page.screenshot({ path: `${EVIDENCIA}02-pantalla-de-acceso.png` });
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    // ── 3. Vuelve al catálogo, ya identificada, y ve SUS invitaciones ───────────────────────
    await expect(page.getByRole("heading", { name: "Mis invitaciones" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Plantillas disponibles" })).toBeVisible();
    // La captura se toma con la lista YA resuelta, no con el «Cargando…» en pantalla.
    await expect(page.getByRole("link", { name: /Seguir editando|Elegir plantilla/ }).first()).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: `${EVIDENCIA}03-mis-invitaciones.png`, fullPage: true });

    // Si tiene varias invitaciones por empezar, dice a cuál. Con una sola, el selector no existe:
    // la página no pregunta lo que ya sabe.
    const selector = page.getByLabel("¿En cuál invitación?");
    if ((await selector.count()) > 0) {
      await selector.selectOption(String(invitationId));
    }

    // ── 4. Elige plantilla desde el CATÁLOGO (U-2: aquí es donde no pasaba nada) ────────────
    const tarjeta = page.getByRole("listitem").filter({ hasText: "Boda clásica" });
    await tarjeta.getByRole("button", { name: "Elegir esta plantilla" }).click();

    await expect(page).toHaveURL(new RegExp(`/editor/${invitationId}$`), { timeout: 30_000 });
    await expect(page.getByRole("radiogroup", { name: "Ver la invitación en" })).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: `${EVIDENCIA}04-editor-con-plantilla.png` });

    // ── 5. Cambia los nombres, el subtítulo y pone su foto ──────────────────────────────────
    //     Son, literalmente, los verbos del criterio de terminado del dueño; y además son los
    //     bloques `required` que el preflight exige para poder publicar.
    // `exact: true`: en la fila conviven «Reordenar Portada», «Portada» y «Más opciones de Portada».
    await page.getByRole("button", { name: "Portada", exact: true }).click();
    const campoTitulo = page.getByRole("textbox", { name: "Nombres en portada" });
    await expect(campoTitulo).toBeVisible({ timeout: 15_000 });
    await campoTitulo.fill(primerNombre);
    await esperarGuardado(page);
    await page.getByRole("textbox", { name: "Subtítulo" }).fill("Nos casamos");
    await esperarGuardado(page);

    // U-7: el pie con formatos y peso máximo está a la vista ANTES de elegir foto (antes solo lo
    // decía la galería; «Cambiar foto» no decía nada y por eso el fallo sorprendía).
    await expect(page.getByText("JPG, PNG o WebP · hasta 8 MB").first()).toBeVisible();

    const subida = page.waitForResponse(
      (r) => r.url().includes(`/editor/invitations/${invitationId}/document/operations`) && r.request().method() === "POST",
    );
    await page.getByLabel("Elegir archivo para Foto de portada").setInputFiles(FOTO_PORTADA);
    const usarEstaFoto = page.getByRole("button", { name: "Usar esta foto" });
    await expect(usarEstaFoto).toBeVisible({ timeout: 15_000 });
    await usarEstaFoto.click();
    await subida;
    await esperarGuardado(page);

    // U-3, RESUELTO DEL TODO (I-06): la fecha ya no sale con candado — se cambia AQUÍ, y la
    // clienta la ve cambiada. Hasta la fase 3-B esta prueba afirmaba lo contrario (un enlace
    // «Dónde se cambia» hacia `/ayuda#fecha`), porque no existía ninguna ruta de cliente que
    // escribiera `invitation.date` y `ADR-3-8-06` se negó, con razón, a prometer una edición
    // imposible. Ahora existe `PUT …/event` (`03 §3.20`) y lo que se afirma es el VERBO.
    await expect(page.getByText("18 de abril de 2027")).toBeVisible();
    await page.getByRole("button", { name: "Cambiar la fecha" }).click();
    await page.getByLabel("Nueva fecha del evento").fill("2027-06-05");
    const fechaGuardada = page.waitForResponse(
      (r) => r.url().endsWith(`/editor/invitations/${invitationId}/event`) && r.request().method() === "PUT",
    );
    await page.getByRole("button", { name: "Guardar la fecha" }).click();
    expect((await fechaGuardada).status()).toBe(200);
    await expect(page.getByText("5 de junio de 2027")).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${EVIDENCIA}05-fecha-cambiada.png` });

    // Los nombres de los novios también son obligatorios y siguen con el texto de ejemplo.
    await page.getByRole("button", { name: "Volver a secciones" }).click();
    await page.getByRole("button", { name: "Los novios", exact: true }).click();
    await page.getByRole("textbox", { name: "Novio", exact: true }).fill("Luis Hernández");
    await esperarGuardado(page);
    await page.getByRole("textbox", { name: "Novia", exact: true }).fill("Ana Torres");
    await esperarGuardado(page);

    // ── 6. Publica ──────────────────────────────────────────────────────────────────────────
    await page.getByRole("button", { name: "Publicar" }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByRole("button", { name: "Publicar" })).toBeEnabled({ timeout: 15_000 });
    await dialogo.getByRole("button", { name: "Publicar" }).click();

    // U-6: el enlace que se le entrega NO es `http://localhost/i/…`.
    const enlace = dialogo.getByText(/\/i\/pub_/).first();
    await expect(enlace).toBeVisible({ timeout: 20_000 });
    const urlPublica = (await enlace.textContent())?.trim() ?? "";
    expect(urlPublica, "el enlace debe construirse con el origen público del sitio (U-6)").not.toMatch(/^https?:\/\/localhost\b/);
    expect(urlPublica).toMatch(/^https?:\/\/[^/]+\/i\/pub_/);

    // U-5: no se afirma «ya se puede ver» hasta que la invalidación responde.
    await expect(dialogo.getByText(/ya se puede ver en internet/i)).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: `${EVIDENCIA}06-publicado.png` });

    // ── 7. Abre su enlace como lo abriría un invitado ───────────────────────────────────────
    const invitado = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      const paginaInvitado = await invitado.newPage();
      await paginaInvitado.goto(urlPublica);
      await expect(paginaInvitado.locator("h1")).toContainText(primerNombre, { timeout: 20_000 });
      await paginaInvitado.screenshot({ path: `${EVIDENCIA}07-invitado-ve-la-primera.png` });

      // ── 8. Corrige un nombre y VUELVE a publicar: el invitado tiene que ver la CORRECCIÓN ──
      //     Este es el defecto U-5 exacto: la primera visita cachea la página y, sin invalidación,
      //     el enlace servía la versión anterior durante ~5 minutos (`s-maxage=300`).
      await page.getByRole("button", { name: "Cerrar" }).click();
      await page.getByRole("button", { name: "Volver a secciones" }).click();
      await page.getByRole("button", { name: "Portada", exact: true }).click();
      await campoTitulo.fill(segundoNombre);
      await esperarGuardado(page);
      await page.getByRole("button", { name: "Publicar" }).click();
      await expect(dialogo.getByRole("button", { name: "Publicar" })).toBeEnabled({ timeout: 15_000 });
      await dialogo.getByRole("button", { name: "Publicar" }).click();
      await expect(dialogo.getByText(/ya se puede ver en internet/i)).toBeVisible({ timeout: 20_000 });

      await paginaInvitado.reload();
      await expect(
        paginaInvitado.locator("h1"),
        "tras publicar, el invitado NO puede seguir viendo la versión anterior (U-5)",
      ).toContainText(segundoNombre, { timeout: 20_000 });
      await paginaInvitado.screenshot({ path: `${EVIDENCIA}08-invitado-ve-la-corregida.png` });
    } finally {
      await invitado.close();
    }
  } finally {
    borrarInvitacion(invitationId);
  }
});
