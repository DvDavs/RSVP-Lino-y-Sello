// e2e/flujo-principal.spec.ts — E-01 de `04 §20.2`, el criterio de terminado LITERAL de la fase 3
// (`brief-comun.md`, prompt del bloque 3-6):
//
//   elegir plantilla → editar textos y fotos → cambiar paleta → ocultar una sección → publicar →
//   abrirla como invitado, con deshacer y autoguardado por medio.
//
// Contra el BACKEND REAL de punta a punta (04 §20.3: cero mocks de la API). Cada paso se verifica
// por HTTP contra el documento del servidor, nunca solo contra el DOM — un botón que "se ve bien"
// pero no llegó a mandar la operación no debe pasar esta prueba por accidente (mismo criterio que
// `secciones.spec.ts`). Usa una invitación NUEVA y propia (no la de demostración compartida): el
// primer paso del criterio de terminado es literalmente "elegir plantilla", que sobre la
// invitación de demostración ya sembrada no se puede volver a ejercer.
//
// Además de demostrar el flujo, esta prueba toma las OCHO capturas de
// `docs/rediseno-plantillas/evidencia/fase-3/flujo/` que el dueño usa para juzgar si el flujo se
// entiende — se toman DURANTE esta misma corrida, no por separado, a 1440×900.
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { API_BASE, borrarInvitacion, invitacionSinDocumento, jwtDemo, sesionDemo } from "./preparar.ts";

const EVIDENCIA = new URL("../../../../docs/rediseno-plantillas/evidencia/fase-3/flujo/", import.meta.url).pathname;
if (!existsSync(EVIDENCIA)) mkdirSync(EVIDENCIA, { recursive: true });

const FOTO_PORTADA = fileURLToPath(new URL("./fixtures/foto-vertical.png", import.meta.url));

test.use({ viewport: { width: 1440, height: 900 } });

interface DocumentoServidor {
  revision: number;
  document: { content: Record<string, unknown> };
  composed: {
    theme: { paletteId: string; tokens: { bg: string } };
    sections: Array<{ key: string; visible: boolean }>;
  };
  publicToken: string;
}

async function leerDocumento(invitationId: number, token: string): Promise<DocumentoServidor> {
  const r = await fetch(`${API_BASE}/editor/invitations/${invitationId}/document`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`GET .../document → ${r.status}`);
  return (await r.json()) as DocumentoServidor;
}

async function esperarGuardado(page: Page): Promise<void> {
  await expect(page.locator("[data-save-state]")).toHaveAttribute("data-save-state", "idle", { timeout: 20_000 });
}

test("E-01 · elegir plantilla → editar textos y fotos → cambiar paleta → ocultar sección → publicar → abrir como invitado", async ({
  page,
  browser,
}) => {
  test.slow(); // ocho pasos reales contra el backend, con capturas: más lenta que una prueba de un solo gesto.
  const token = await jwtDemo();
  const invitationId = invitacionSinDocumento();
  const titulo = `Ana & Luis · E-01 ${Date.now().toString(36)}`;
  const subtitulo = "Nos casamos — flujo E-01";

  try {
    // ── Paso 1: elegir plantilla ──────────────────────────────────────────────────────────────
    await sesionDemo(page, token);
    await page.goto(`/editor/${invitationId}`);
    await expect(page.getByRole("heading", { name: "Elige una plantilla" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("elegir-boda-clasica")).toBeVisible();
    await page.screenshot({ path: `${EVIDENCIA}01-elegir-plantilla.png` });

    await page.getByTestId("elegir-boda-clasica").click();
    await expect(page.getByRole("radiogroup", { name: "Ver la invitación en" })).toBeVisible({ timeout: 20_000 });
    expect(
      (await leerDocumento(invitationId, token)).revision,
      "`:choose-template` deja la invitación en revision 0 (handoffs/3-0a.md §4)",
    ).toBe(0);

    // ── Paso 2: editar DOS textos ─────────────────────────────────────────────────────────────
    await page.getByTestId("section-row-cover").click();
    await expect(page.getByRole("heading", { name: /portada/i })).toBeVisible();

    const campoTitulo = page.getByRole("textbox", { name: "Nombres en portada" });
    await campoTitulo.fill(titulo);
    await esperarGuardado(page);

    const campoSubtitulo = page.getByRole("textbox", { name: "Subtítulo" });
    await campoSubtitulo.fill(subtitulo);
    await esperarGuardado(page);

    const trasTextos = await leerDocumento(invitationId, token);
    expect(trasTextos.document.content["cover.title"]).toEqual({ kind: "text", value: titulo });
    expect(trasTextos.document.content["cover.subtitle"]).toEqual({ kind: "text", value: subtitulo });
    await page.screenshot({ path: `${EVIDENCIA}02-editar-texto.png` });

    // ── Paso 3: subir y recortar una foto ─────────────────────────────────────────────────────
    const campoFoto = page.locator('[id="campo-cover.image"]');
    const inputArchivo = page.getByLabel("Elegir archivo para Foto de portada");
    await inputArchivo.setInputFiles(FOTO_PORTADA);
    const usarEstaFoto = page.getByRole("button", { name: "Usar esta foto" });
    await expect(usarEstaFoto).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${EVIDENCIA}03-recortar-foto.png` }); // el recuadro de recorte, ANTES de confirmar

    // Se espera la respuesta REAL de red del lote que sube este cambio — no `data-save-state`:
    // ese atributo puede seguir leyendo "idle" del guardado ANTERIOR (título/subtítulo) durante la
    // ventana, corta pero real, en que `confirmarRecorte` recorta y sube el archivo ANTES de
    // encolar la operación; sondear "idle" ahí resolvería de inmediato sin haber esperado nada
    // (estado observable equivocado, no un `waitForTimeout`, pero igual de engañoso).
    const subeCoverImage = page.waitForResponse(
      (r) => r.url().includes(`/editor/invitations/${invitationId}/document/operations`) && r.request().method() === "POST",
    );
    await usarEstaFoto.click();
    await subeCoverImage;
    // NO se afirma aquí `campoFoto.getByRole("button", { name: "Cambiar foto" })` a propósito.
    // DEFECTO DE PRODUCCIÓN encontrado en este bloque (documentado con precisión, no corregido —
    // `frontend/apps/web/lib/store.ts` es área prohibida para 3-6): `aplicarOperacion` (`store.ts`
    // ~536-576, y los mismos cuatro puntos en `undoOnce`/`redoOnce`/rebase de conflicto, líneas
    // ~754/1025/1057) parchea `s.composed` con `applyOperationOptimistic` pero JAMÁS escribe en
    // `s.document.content` — ese árbol solo se asigna en `load()` (línea 627),
    // `restoreFromHistory`/`restoreRevision` (673) y al resolver un conflicto (814). El servidor
    // tampoco lo re-envía (`POST .../document/operations` responde `{revision, applied, composed,
    // report, idMap}`, SIN `document` — verificado por HTTP en esta sesión). Consecuencia medida:
    // para un bloque `image` que empieza SIN valor (como `cover.image` en una invitación nueva),
    // `ScalarBlockField.tsx:74` deriva `assetId` de `rawValue` (= `document.content[blockId]`, que
    // se quedó `undefined`), así que `ImageField` sigue recibiendo `value: null` DESPUÉS de un
    // `setBlock` que sí se guardó (confirmado: `composed` y el servidor YA tienen la foto). El
    // botón se queda diciendo "Elegir foto" toda la sesión, y peor: `alCambiarAlt`/`alMoverFocal`
    // (`ImageField.tsx`, guardan con `if (!value) return`) dejan de hacer NADA — cambiar el texto
    // alternativo o el punto focal de una foto recién subida no hace ni una petición hasta recargar
    // la página. Ver `bitacora/3-6.md` § "defectos encontrados" y `preguntas-abiertas.md` para el
    // parche propuesto. Aquí se verifica lo que SÍ es correcto y observable sin recargar: el propio
    // recuadro de recorte se cierra (la subida no falló) y el lienzo, que lee de `composed` — no de
    // `document.content` —, ya pinta la foto nueva.
    await expect(usarEstaFoto).toBeHidden({ timeout: 20_000 });
    await esperarGuardado(page);

    const trasFoto = await leerDocumento(invitationId, token);
    const fotoGuardada = trasFoto.document.content["cover.image"] as { kind: string; assetId?: string } | undefined;
    expect(fotoGuardada?.kind, "el SERVIDOR sí guardó la foto, pese al defecto de UI documentado arriba").toBe("image");
    expect(fotoGuardada?.assetId).toMatch(/^as_[0-9A-HJKMNP-TV-Z]{26}$/);

    // Antes de subir, `cover.image` no tenía valor (R2: un bloque sin valor no pinta nodo) — tras
    // la subida el lienzo, que lee `composed` (SÍ actualizado, a diferencia de `document.content`),
    // debe pintar la foto real.
    const marco0 = page.frameLocator('iframe[title="Vista previa de la invitación"]');
    await expect(marco0.locator('[data-block-id="cover.image"] img')).toBeVisible({ timeout: 10_000 });
    await expect(marco0.locator('[data-block-id="cover.image"] img')).toHaveAttribute("src", /.+/);

    // ── Requisito para poder publicar, no uno de los "dos textos" de la narrativa: `couple.groom`
    // y `couple.bride` también son bloques `required` (04 §7.1 paso 11 exige que el preflight
    // bloquee texto de ejemplo, y estos dos siguen siendo "Diego Márquez Cruz"/"Ana Sofía Robles
    // Herrera" en cualquier invitación nueva — misma plantilla real, `demo-content.mjs`). Sin
    // esto, `POST .../release` respondería `422 TPL_PUBLISH_BLOCKED_DEFAULT_CONTENT` y el paso 6
    // (publicar) nunca demostraría nada real. Un usuario real los llenaría igual antes de publicar.
    await page.getByRole("button", { name: "Volver a secciones" }).click();
    await page.getByTestId("section-row-couple").click();
    await expect(page.getByRole("heading", { name: /los novios/i })).toBeVisible();
    await page.getByRole("textbox", { name: "Novio", exact: true }).fill("Luis Hernández");
    await esperarGuardado(page);
    await page.getByRole("textbox", { name: "Novia", exact: true }).fill("Ana Torres");
    await esperarGuardado(page);

    // ── Paso 4: cambiar la paleta ──────────────────────────────────────────────────────────────
    await page.getByRole("button", { name: "Volver a secciones" }).click();
    await expect(page.getByText("Apariencia")).toBeVisible();
    const paletaAntes = (await leerDocumento(invitationId, token)).composed.theme.paletteId;
    const paletaNueva = paletaAntes === "olive" ? "navy" : "olive";

    await page.getByTestId(`paleta-${paletaNueva}`).click();
    await esperarGuardado(page);
    await expect(page.getByTestId(`paleta-${paletaNueva}`)).toHaveAttribute("aria-checked", "true");
    await page.screenshot({ path: `${EVIDENCIA}04-cambiar-paleta.png` });

    const trasPaleta = await leerDocumento(invitationId, token);
    expect(trasPaleta.composed.theme.paletteId, "la paleta elegida es la que quedó en el documento del servidor").toBe(paletaNueva);
    // El lienzo también la refleja: no solo el panel dice que cambió, el DOCUMENTO COMPUESTO que
    // recibe SectionsRoot trae los tokens de la paleta nueva (04 §7.1 paso 8, ciclo completo).
    const marco = page.frameLocator('iframe[title="Vista previa de la invitación"]');
    await expect(marco.locator(`[data-theme-palette="${paletaNueva}"]`)).toHaveCount(1, { timeout: 10_000 });
    // `data-theme-palette` es solo un IDENTIFICADOR (04 §5.4) — la comprobación que de verdad
    // importa es que el color PINTADO cambió. La vista previa en vivo al pasar el ratón tiene un
    // defecto documentado (`preguntas-abiertas.md` § "Fase 3 · 3-5": el mensaje `PREVIEW_THEME`
    // solo lleva el id, y `LienzoCliente.tsx` no volvía a resolver `theme.tokens` para él), pero
    // ESTO es el camino CONFIRMADO (`setTheme`, viaje real de ida y vuelta al servidor con
    // `composed.theme.tokens` ya resueltos) — se comprueba que sí pintan de verdad, sin dar nada
    // por bueno por la sola presencia del atributo.
    const colorDeFondo = await marco.locator(`[data-theme-palette="${paletaNueva}"]`).evaluate((el) => getComputedStyle(el).getPropertyValue("--inv-color-bg").trim());
    expect(colorDeFondo.toUpperCase()).toBe(trasPaleta.composed.theme.tokens.bg.toUpperCase());

    // ── Paso 5: ocultar una sección opcional ──────────────────────────────────────────────────
    const antesDeOcultar = await leerDocumento(invitationId, token);
    const seccionesVisibles = antesDeOcultar.composed.sections.filter((s) => s.visible).length;
    await expect(page.getByTestId("section-visible-suggestions")).toBeVisible();
    await page.getByTestId("section-visible-suggestions").click();
    await esperarGuardado(page);
    await expect(marco.locator("section[data-section-key='suggestions']")).toHaveCount(0, { timeout: 10_000 });
    await page.screenshot({ path: `${EVIDENCIA}05-ocultar-seccion.png` });

    const trasOcultar = await leerDocumento(invitationId, token);
    const seccionSuggestions = trasOcultar.composed.sections.find((s) => s.key === "suggestions");
    expect(seccionSuggestions?.visible).toBe(false);
    expect(trasOcultar.composed.sections.filter((s) => s.visible).length).toBe(seccionesVisibles - 1);

    // ── Paso 6: publicar ───────────────────────────────────────────────────────────────────────
    await expect(page.getByTestId("abrir-publicar")).toBeEnabled({ timeout: 10_000 });
    await page.getByTestId("abrir-publicar").click();
    await expect(page.getByTestId("publish-dialog")).toBeVisible();
    // 3C-UX-B (G-04/G-05, `publicar.spec.ts` "G-04 + G-05"): esta invitación solo tuvo cuatro
    // bloques editados (título, subtítulo, foto, novios) — el resto de las secciones sigue con
    // contenido de ejemplo, así que la revisión YA NO dice «Todo listo para publicar»: enumera los
    // avisos (no bloqueantes) y el botón sigue habilitado porque ninguno de ellos bloquea (`03 §6`).
    await expect(page.getByText(/todo listo para publicar/i)).toHaveCount(0);
    await expect(page.getByTestId("lista-ejemplos")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("resumen-avisos")).toContainText(/sin terminar/i);
    await page.screenshot({ path: `${EVIDENCIA}06-publicar.png` });

    await expect(page.getByTestId("confirmar-publicar")).toBeEnabled();
    await expect(page.getByTestId("confirmar-publicar")).toHaveText(/de todos modos/i);
    await page.getByTestId("confirmar-publicar").click();
    await expect(page.getByTestId("enlace-publicado")).toBeVisible({ timeout: 15_000 });
    const enlace = await page.getByTestId("enlace-publicado").textContent();
    expect(enlace).toMatch(/^https?:\/\/.+\/i\//);
    await page.screenshot({ path: `${EVIDENCIA}07-enlace-publicado.png` });

    // ── Paso 7: abrirla COMO INVITADO — contexto de navegador nuevo, sin sesión ni token ──────
    const publicToken = (await leerDocumento(invitationId, token)).publicToken;
    const contextoInvitado = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      const paginaInvitado = await contextoInvitado.newPage();
      const errores: string[] = [];
      paginaInvitado.on("pageerror", (e) => errores.push(e.message));
      await paginaInvitado.goto(`/i/${publicToken}`);

      // Criterio de aceptación LITERAL de E-01 (04 §20.2): el texto editado aparece en la página
      // pública y la sección oculta NO.
      await expect(paginaInvitado.locator("h1")).toContainText(titulo);
      // El `<h1>` de página (04 §17.3) es visualmente oculto y concatena título+subtítulo: se
      // busca el subtítulo dentro de la PORTADA visible, no con `getByText` a secas (que también
      // resolvería ese `<h1>` invisible y sería ambiguo).
      await expect(paginaInvitado.locator("section[data-section-type='cover']").getByText(subtitulo)).toBeVisible();
      await expect(paginaInvitado.locator("section[data-section-type='suggestions']")).toHaveCount(0);
      // El resto de la invitación sigue ahí: no se perdió nada al ocultar una sola sección.
      await expect(paginaInvitado.locator("section")).toHaveCount(seccionesVisibles - 1);
      expect(errores, errores.join(" | ")).toEqual([]);

      await paginaInvitado.screenshot({ path: `${EVIDENCIA}08-invitacion-publicada.png`, fullPage: true });
    } finally {
      await contextoInvitado.close();
    }
  } finally {
    borrarInvitacion(invitationId);
  }
});
