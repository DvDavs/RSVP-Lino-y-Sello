import { expect, test } from "@playwright/test";
import { aplicarOperacion, leerDocumento, obtenerDemo, publicar, revalidar } from "./util/demo";

// e2e/render-publico.spec.ts — E2E-01 de `06 §8.1` y E-01/E-02 de `04 §20.2`, sobre el BACKEND REAL
// (06 §20.3: cero mocks). Todo lo que se afirma aquí se compara contra el JSON que devuelve
// `GET /public/i/{token}/render`, no contra literales copiados: si el sembrador cambia el contenido,
// la prueba sigue siendo válida y sigue midiendo lo mismo.

// Las pruebas de este archivo comparten UN recurso mutable: la invitación de demostración. La
// última oculta una sección, publica y la restaura, así que no puede correr a la vez que las que
// cuentan secciones (`fullyParallel: true` en `playwright.config.ts`). `mode: "serial"` las mantiene
// en un solo worker y en orden, sin tocar la configuración global que comparte el bloque del editor.
// `a11y-publico.spec.ts` sí puede correr en paralelo: solo mira violaciones de axe, y que falte una
// sección durante unos segundos no crea ninguna.
test.describe.configure({ mode: "serial" });

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:6003";

// La ruta pública es ISR con `revalidate: 300` (04 §15.1): si alguien publicó un release nuevo sin
// llamar al webhook —una resiembra, una reparación a mano, o el propio backend con el webhook sin
// configurar—, `apps/web` puede seguir sirviendo HTML de hasta cinco minutos antes. Estas pruebas
// comparan el DOM con el JSON del backend, así que arrancan purgando la etiqueta por el mismo camino
// que usará `RevalidationNotifier` en producción. No es una concesión: es exactamente el mecanismo
// que el diseño define para que las dos verdades coincidan.
test.beforeAll(async ({ browserName }, testInfo) => {
  void browserName; // Playwright exige el primer parámetro de fixtures; no se usa ninguno aquí.
  const demo = await obtenerDemo();
  const base = (testInfo.project.use.baseURL as string | undefined) ?? "http://127.0.0.1:3000";
  const r = await revalidar(base, demo.publicToken);
  expect(r.status, "el webhook de revalidación debe estar configurado para las e2e").toBe(200);
});

type Render = {
  composed: {
    locale: string;
    theme: { tokens: { bg: string } };
    sections: Array<{
      key: string;
      type: string;
      visible: boolean;
      blocks: Array<{ role: string; value: unknown }>;
    }>;
  };
};

async function renderDelBackend(publicToken: string): Promise<Render> {
  const r = await fetch(`${API}/public/i/${publicToken}/render`);
  expect(r.status, "el backend debe servir el render de la invitación sembrada").toBe(200);
  return (await r.json()) as Render;
}

/** Todas las URL de imagen del documento compuesto, en orden de aparición. */
function urlsDeImagen(render: Render): string[] {
  const urls: string[] = [];
  const recorrer = (nodo: unknown): void => {
    if (nodo === null || typeof nodo !== "object") return;
    const o = nodo as Record<string, unknown>;
    if (o.kind === "image" && typeof o.url === "string") urls.push(o.url);
    for (const v of Object.values(o)) recorrer(v);
  };
  recorrer(render);
  return urls;
}

test("la invitación publicada se abre y muestra el texto y las imágenes sembradas", async ({ page }) => {
  const demo = await obtenerDemo();
  const render = await renderDelBackend(demo.publicToken);

  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));

  await page.goto(`/i/${demo.publicToken}`);

  // 1. Una <section> por sección VISIBLE, ni una más (04 §5.2: SectionsRoot filtra por `visible`).
  const visibles = render.composed.sections.filter((s) => s.visible);
  await expect(page.locator("section")).toHaveCount(visibles.length);

  // 2. El texto sembrado está de verdad en la página. Se toma del propio render, no de un literal.
  const titulo = render.composed.sections
    .flatMap((s) => (s.visible ? s.blocks : []))
    .find((b) => b.role === "coverTitle")?.value as { kind: string; value: string } | undefined;
  expect(titulo?.kind, "la portada sembrada trae un coverTitle de texto").toBe("text");
  await expect(page.locator("section[data-section-type='cover']")).toContainText(titulo!.value);

  // El <h1> de página (04 §17.3) existe, es único y lleva el título de portada.
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).toContainText(titulo!.value);

  // 3. Las imágenes: tantas como resuelve el backend, TODAS cargadas de verdad (`naturalWidth > 0`,
  //    no basta con que exista el `<img>`) y todas con `alt` presente (vacío solo si es decorativa).
  const urls = urlsDeImagen(render);
  expect(urls.length, "la demostración siembra imágenes resueltas").toBeGreaterThan(0);
  await expect(page.locator("img")).toHaveCount(urls.length);
  await page.evaluate(() => {
    for (const img of document.querySelectorAll("img")) img.loading = "eager";
  });
  await page.waitForFunction(
    () => [...document.querySelectorAll("img")].every((i) => i.complete && i.naturalWidth > 0),
    null,
    { timeout: 30_000 },
  );
  const sinAlt = await page.locator("img:not([alt])").count();
  expect(sinAlt, "04 §17.4: toda imagen lleva alt (vacío si es decorativa)").toBe(0);

  // 4. El idioma y el fondo salen del documento, no de `apps/web` (P3).
  await expect(page.locator("html")).toHaveAttribute("lang", "es-MX");
  const fondo = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const esperado = render.composed.theme.tokens.bg
    .slice(1)
    .match(/.{2}/g)!
    .map((h) => parseInt(h, 16));
  expect(fondo).toBe(`rgb(${esperado.join(", ")})`);

  // 5. Ni un error de JavaScript, y ni un scroll horizontal (una invitación con scroll lateral se
  //    percibe como rota en el móvil desde el que se abre).
  expect(errores, errores.join(" | ")).toEqual([]);
  const desborde = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(desborde, "la página no debe desplazarse en horizontal").toBe(false);
});

test("noindex: la invitación nunca se indexa (etiqueta y cabecera)", async ({ page }) => {
  const demo = await obtenerDemo();
  // `04 §15.4` / objeción O-15: sin esto, nombre, dirección y fecha del cliente acaban en un
  // buscador. Se comprueban las DOS capas independientes, no solo el código.
  const respuesta = await page.goto(`/i/${demo.publicToken}`);
  expect(respuesta?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  // Next emite más de una `<meta name="robots">` (la del layout y la que añade su propio
  // manejador de "no encontrado"); TODAS tienen que decir noindex, así que se comprueban todas.
  const robots = await page.locator("meta[name='robots']").evaluateAll((ms) =>
    ms.map((m) => m.getAttribute("content") ?? ""),
  );
  expect(robots.length).toBeGreaterThan(0);
  for (const r of robots) expect(r).toContain("noindex");
  expect(robots.some((r) => r.includes("nofollow"))).toBe(true);
});

test("un publicToken inexistente cae en el estado de no disponible, sin filtrar nada", async ({ page }) => {
  // `handoffs/2-5.md`: UN SOLO `404 TPL_RELEASE_NOT_FOUND` para token inexistente, rotado, sin
  // release, despublicado y `uses_templates2=false`. El backend no los distingue a propósito.
  const inexistente = `pub_${"Z".repeat(26)}`;
  const api = await fetch(`${API}/public/i/${inexistente}/render`);
  expect(api.status).toBe(404);
  expect(((await api.json()) as { code: string }).code).toBe("TPL_RELEASE_NOT_FOUND");

  await page.goto(`/i/${inexistente}`);
  await expect(page.getByRole("heading", { name: "Esta invitación ya no está disponible" })).toBeVisible();
  // La página del 404 tampoco se indexa (hereda el `metadata` del layout público).
  const robots = await page.locator("meta[name='robots']").evaluateAll((ms) =>
    ms.map((m) => m.getAttribute("content") ?? ""),
  );
  expect(robots.length).toBeGreaterThan(0);
  for (const r of robots) expect(r).toContain("noindex");
});

test("una sección oculta desaparece de la invitación publicada tras revalidar", async ({ page, baseURL }) => {
  // Recorre el ciclo COMPLETO y real: ocultar por operación → publicar release → golpear el webhook
  // `/api/revalidate` (ADR-1R-F-09) → recargar. Al final deja la invitación como estaba, para que la
  // demostración que juzga el dueño no se quede mutilada.
  const demo = await obtenerDemo();
  const antes = await leerDocumento(demo);
  // La sección a ocultar se elige entre las que están VISIBLES ahora mismo, no entre todas: si una
  // corrida anterior dejó alguna oculta, ocultar esa otra vez no probaría nada. Se prefiere
  // `suggestions` por ser prescindible, y si no está visible se toma la última visible que no sea
  // la portada (ocultar la portada dejaría la invitación irreconocible en la captura).
  const visiblesAntes = antes.secciones.filter((s) => s.visible).map((s) => s.key);
  const candidatas = visiblesAntes.filter((k) => k !== "cover");
  const clave = candidatas.includes("suggestions") ? "suggestions" : candidatas[candidatas.length - 1];
  expect(clave, "la demostración debe tener alguna sección visible que ocultar").toBeTruthy();

  await page.goto(`/i/${demo.publicToken}`);
  await expect(page.locator("section")).toHaveCount(visiblesAntes.length);
  await expect(page.locator(`section:has(h2#s-${clave})`)).toHaveCount(1);

  let revision = antes.revision;
  try {
    revision = await aplicarOperacion(demo, revision, { op: "setSectionVisible", sectionKey: clave, visible: false });
    await publicar(demo, revision);
    const rev = await revalidar(baseURL!, demo.publicToken);
    expect(rev.status, "el webhook de revalidación debe aceptar el cuerpo del backend").toBe(200);

    await page.goto(`/i/${demo.publicToken}`);
    await expect(page.locator(`section:has(h2#s-${clave})`)).toHaveCount(0);
    await expect(page.locator("section")).toHaveCount(visiblesAntes.length - 1);
  } finally {
    revision = await aplicarOperacion(demo, revision, { op: "setSectionVisible", sectionKey: clave, visible: true });
    await publicar(demo, revision);
    await revalidar(baseURL!, demo.publicToken);
  }

  await page.goto(`/i/${demo.publicToken}`);
  await expect(page.locator("section")).toHaveCount(visiblesAntes.length);
});

test("el HTML se sirve desde caché ISR y no desde un render por visita", async ({ request, baseURL }) => {
  // `04 §15.1`: "La primera visita genera y cachea; las siguientes se sirven del caché". Sin
  // `generateStaticParams` (aunque devuelva []), `next@16.3.4` responde
  // `Cache-Control: private, no-cache, no-store` y ningún CDN puede cachear la invitación
  // (medido; ver el comentario de `page.tsx` y ADR-3-3-04).
  const demo = await obtenerDemo();
  await request.get(`${baseURL}/i/${demo.publicToken}`); // calienta
  const r = await request.get(`${baseURL}/i/${demo.publicToken}`);
  expect(r.status()).toBe(200);
  const cc = r.headers()["cache-control"] ?? "";
  expect(cc, `Cache-Control real: "${cc}"`).toContain("s-maxage=300");
  expect(r.headers()["x-nextjs-cache"]).toBe("HIT");
});
