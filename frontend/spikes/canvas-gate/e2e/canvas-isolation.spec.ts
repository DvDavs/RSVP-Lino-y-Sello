/**
 * e2e/canvas-isolation.spec.ts — LA COMPUERTA de la fase 3 (`04 §8.5`, ADR-1R-F-02).
 *
 * Automatiza los ocho criterios A1-A8 con su criterio de aprobación literal y guarda una captura
 * PNG a 1440×900 por criterio en `docs/rediseno-plantillas/evidencia/fase-3/compuerta/`.
 * Los criterios no visuales (A4, A7, A8) se capturan sobre el panel de resultados del padre, que
 * muestra nombre, valor medido y veredicto.
 *
 * Se mide, no se opina: cada aserción es `expect.soft`, así que un fallo NO impide medir el resto.
 */
import { expect, test, type Frame, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const EVID = resolve(AQUI, "../../../../docs/rediseno-plantillas/evidencia/fase-3/compuerta");
const CDN = process.env.NEXT_PUBLIC_CDN_ORIGIN ?? "http://127.0.0.1:6003";

type Gate = {
  estado: () => {
    readyMs: number; readyBuildId: string; incompatible: boolean;
    ultimoRefClic: { sectionKey: string; blockId: string } | null;
    ultimoAlto: number; ultimoComando: string; ultimaSeccion: string; pong: string;
    rechazados: string[]; diagOrigenVistoPorElPadre: string; diagOrigenSegunElHijo: string;
    encolados: number;
  };
  reportar: (id: string, valor: string, pasa: boolean) => void;
  enfocar: (id: string | null) => void;
  seleccionar: (ref: unknown) => void;
  ping: (id: string) => void;
  inyectarV2: () => void;
};

const tabla: { id: string; valor: string; pasa: boolean }[] = [];

async function anotar(page: Page, id: string, valor: string, pasa: boolean) {
  tabla.push({ id, valor, pasa });
  await page.evaluate(
    ([i, v, p]) => {
      const g = (window as unknown as { __gate: Gate }).__gate;
      g.reportar(i as string, v as string, p as boolean);
      g.enfocar(i as string);
    },
    [id, valor, pasa] as const,
  );
  await page.waitForTimeout(120); // que React pinte la fila antes de la captura
  mkdirSync(EVID, { recursive: true });
  await page.screenshot({ path: `${EVID}/${id}.png` });
}

const lienzo = (page: Page): Frame => {
  const f = page.frames().find((x) => x.url().includes("/canvas"));
  if (!f) throw new Error("no se encontró el marco del lienzo");
  return f;
};

test("compuerta A1-A8 · lienzo en iframe de origen opaco", async ({ page }) => {
  // ── Trazado de red por marco (A8) y de consola ─────────────────────────────────────────────
  const peticiones: { url: string; tipo: string; marco: string }[] = [];
  page.on("request", (r) => {
    let marco = "";
    try { marco = r.frame()?.url() ?? ""; } catch { marco = "(marco separado)"; }
    peticiones.push({ url: r.url(), tipo: r.resourceType(), marco });
  });
  const errores: string[] = [];
  page.on("response", (r) => {
    if (r.status() < 400) return;
    let marco = "";
    try { marco = r.frame()?.url() ?? ""; } catch { marco = "(marco separado)"; }
    errores.push(`${r.status()} ${r.url()} · marco ${marco || "(desconocido)"}`);
  });
  const consola: string[] = [];
  page.on("console", (m) => consola.push(`[${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => consola.push(`[pageerror] ${e.message}`));

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/", { waitUntil: "load" });

  // ── A1 · el iframe carga y envía READY en < 2 s ────────────────────────────────────────────
  await page.waitForFunction(
    () => ((window as unknown as { __gate?: Gate }).__gate?.estado().readyMs ?? -1) >= 0,
    undefined,
    { timeout: 10_000 },
  );
  let st = await page.evaluate(() => (window as unknown as { __gate: Gate }).__gate.estado());
  const a1 = st.readyMs >= 0 && st.readyMs < 2000;
  expect.soft(st.readyMs, "A1: READY en menos de 2 s").toBeLessThan(2000);
  expect.soft(st.readyMs, "A1: READY llegó").toBeGreaterThanOrEqual(0);

  // Diagnóstico que convierte en [V] lo que `04 §8.1`/`§8.2` daban por [I]:
  // el origen del lienzo es opaco y el padre lo ve como "null".
  const origenOpaco = st.diagOrigenVistoPorElPadre === "null" && st.diagOrigenSegunElHijo === "null";
  expect.soft(st.diagOrigenVistoPorElPadre, "el padre ve event.origin === 'null'").toBe("null");

  await page.waitForFunction(
    () => !!document.querySelector("iframe")?.contentWindow, undefined, { timeout: 5000 },
  );
  const marco = lienzo(page);
  await marco.waitForSelector('[data-block-id="cover.title"]', { timeout: 10_000 });
  await anotar(page, "A1", `READY en ${st.readyMs} ms (< 2000) · buildId "${st.readyBuildId}" · origen opaco: ${origenOpaco}`, a1);

  // ── A2 · la fuente de la plantilla se aplica DENTRO del iframe ─────────────────────────────
  const fuente = await marco.evaluate(async () => {
    await document.fonts.ready;
    const h1 = document.querySelector("h1.portada") as HTMLElement | null;
    const declarada = document.documentElement.dataset.fontFamily ?? "";
    const calculada = h1 ? getComputedStyle(h1).fontFamily : "";
    const primera = calculada.split(",")[0]!.trim().replace(/^["']|["']$/g, "");
    return {
      declarada,
      calculada,
      primera,
      check: document.fonts.check(`16px "${primera}"`),
      controlSinCors: document.fonts.check('16px "ControlSinCors"'),
      caras: Array.from(document.fonts).map((f) => `${f.family}=${f.status}`),
    };
  });
  const familiaEsperada = "plantillaSerif";
  const a2 =
    fuente.calculada.includes(familiaEsperada) &&
    fuente.check === true &&
    fuente.caras.includes(`${familiaEsperada}=loaded`);
  expect.soft(fuente.calculada, "A2: getComputedStyle(h1).fontFamily contiene la familia").toContain(familiaEsperada);
  expect.soft(fuente.check, "A2: document.fonts.check() es true").toBe(true);
  expect.soft(fuente.caras.join(" "), "A2: la cara autoalojada está 'loaded'").toContain(`${familiaEsperada}=loaded`);
  // Control negativo de C1: la MISMA fuente servida SIN Access-Control-Allow-Origin no carga.
  expect.soft(fuente.controlSinCors, "control C1: sin CORS la fuente NO carga en origen opaco").toBe(false);
  await marco.evaluate(() => window.scrollTo(0, 0));
  await anotar(
    page, "A2",
    `fontFamily="${fuente.calculada.slice(0, 40)}…" · fonts.check("${fuente.primera}")=${fuente.check} · caras=[${fuente.caras.join(", ")}] · control sin CORS=${fuente.controlSinCors}`,
    a2,
  );

  // ── A3 · las imágenes del CDN (otro origen) se pintan ──────────────────────────────────────
  await marco.waitForFunction(() => {
    const i = document.querySelector("img.portada") as HTMLImageElement | null;
    return !!i && i.complete;
  }, undefined, { timeout: 10_000 });
  const img = await marco.evaluate(() => {
    const i = document.querySelector("img.portada") as HTMLImageElement;
    return { src: i.src, w: i.naturalWidth, h: i.naturalHeight };
  });
  const a3 = img.w > 0 && img.src.startsWith(CDN);
  expect.soft(img.w, "A3: naturalWidth > 0 en la portada").toBeGreaterThan(0);
  expect.soft(img.src, "A3: la portada viene del CDN, otro origen").toContain(CDN);
  await anotar(page, "A3", `naturalWidth=${img.w}, naturalHeight=${img.h} · origen ${new URL(img.src).origin}`, a3);

  // ── A4 · cero eventos securitypolicyviolation durante el arranque ──────────────────────────
  const violaciones = await marco.evaluate(
    () => (window as unknown as { __cspViolations: unknown[] }).__cspViolations ?? [],
  );
  const violacionesConsola = consola.filter((l) => /Content Security Policy/i.test(l));
  const a4 = violaciones.length === 0 && violacionesConsola.length === 0;
  expect.soft(violaciones, "A4: cero securitypolicyviolation en el lienzo").toEqual([]);
  expect.soft(violacionesConsola, "A4: cero avisos de CSP en consola").toEqual([]);
  await anotar(
    page, "A4",
    `securitypolicyviolation=${violaciones.length}; avisos de CSP en consola=${violacionesConsola.length}${violaciones.length ? " · " + JSON.stringify(violaciones).slice(0, 200) : ""}`,
    a4,
  );

  // ── A5 · ciclo completo RENDER → BLOCK_CLICKED con el ref correcto ─────────────────────────
  await marco.click('[data-block-id="cover.title"]');
  await page.waitForFunction(
    () => (window as unknown as { __gate: Gate }).__gate.estado().ultimoRefClic !== null,
    undefined, { timeout: 5000 },
  );
  st = await page.evaluate(() => (window as unknown as { __gate: Gate }).__gate.estado());
  const a5 = st.ultimoRefClic?.sectionKey === "cover" && st.ultimoRefClic?.blockId === "cover.title";
  expect.soft(st.ultimoRefClic, "A5: el padre recibe el ref correcto").toEqual({ sectionKey: "cover", blockId: "cover.title" });
  await anotar(page, "A5", `BLOCK_CLICKED ref=${JSON.stringify(st.ultimoRefClic)} (RENDER encolado antes del READY: ${st.encolados} msg)`, a5);

  // ── A6 · CANVAS_RESIZED reporta un alto > 0 ────────────────────────────────────────────────
  await page.waitForFunction(
    () => (window as unknown as { __gate: Gate }).__gate.estado().ultimoAlto > 0,
    undefined, { timeout: 5000 },
  );
  st = await page.evaluate(() => (window as unknown as { __gate: Gate }).__gate.estado());
  const a6 = st.ultimoAlto > 0;
  expect.soft(st.ultimoAlto, "A6: CANVAS_RESIZED con alto > 0").toBeGreaterThan(0);
  await anotar(page, "A6", `CANVAS_RESIZED height=${st.ultimoAlto} px (el padre no puede medirlo, §8.3)`, a6);

  // ── A7 · Ctrl+Z con el foco DENTRO del lienzo llega al padre ───────────────────────────────
  const focoDentro = await marco.evaluate(() => document.activeElement?.getAttribute("data-block-id") ?? "");
  await page.keyboard.press("Control+z");
  await page.waitForFunction(
    () => (window as unknown as { __gate: Gate }).__gate.estado().ultimoComando !== "",
    undefined, { timeout: 5000 },
  );
  st = await page.evaluate(() => (window as unknown as { __gate: Gate }).__gate.estado());
  const a7 = st.ultimoComando === "undo";
  expect.soft(st.ultimoComando, "A7: KEY_COMMAND undo recibido").toBe("undo");
  await anotar(page, "A7", `KEY_COMMAND="${st.ultimoComando}" con el foco en "${focoDentro}" dentro del iframe`, a7);

  // ── A8 · ningún fetch sale del lienzo ──────────────────────────────────────────────────────
  await page.evaluate(() => (window as unknown as { __gate: Gate }).__gate.ping("ping-1"));
  await page.waitForTimeout(300);
  const delLienzo = peticiones.filter((p) => p.marco.includes("/canvas"));
  const datos = delLienzo.filter((p) => ["fetch", "xhr", "websocket", "eventsource"].includes(p.tipo));
  const violacionesFinales = await marco.evaluate(
    () => (window as unknown as { __cspViolations: unknown[] }).__cspViolations ?? [],
  );
  const a8 = datos.length === 0 && violacionesFinales.length === 0;
  expect.soft(datos, "A8: cero peticiones de datos desde el marco del lienzo").toEqual([]);
  expect.soft(violacionesFinales, "A8: connect-src 'none' sin violaciones").toEqual([]);
  const porTipo = delLienzo.reduce<Record<string, number>>((a, p) => ({ ...a, [p.tipo]: (a[p.tipo] ?? 0) + 1 }), {});
  await anotar(
    page, "A8",
    `fetch/xhr/ws desde el lienzo=${datos.length} · peticiones del marco por tipo=${JSON.stringify(porTipo)} · violaciones CSP=${violacionesFinales.length}`,
    a8,
  );

  // ── Evidencia adicional (no es un criterio de la tabla, pero sostiene el veredicto) ─────────
  st = await page.evaluate(() => (window as unknown as { __gate: Gate }).__gate.estado());
  const detalle = [
    "",
    "════════ COMPUERTA A1-A8 · lienzo en <iframe sandbox=\"allow-scripts\"> (origen opaco) ════════",
    ...tabla.map((t) => `${t.id}  ${t.pasa ? "PASA " : "FALLA"}  ${t.valor}`),
    "─────────────────────────────────────────────────────────────────────────────────────────",
    `TOTAL: ${tabla.filter((t) => t.pasa).length}/8 criterios en verde`,
    "",
    "Mediciones de apoyo:",
    `  · event.origin del lienzo visto por el padre .... "${st.diagOrigenVistoPorElPadre}"  (04 §8.2: por eso el padre NO valida por origen)`,
    `  · window.origin dentro del lienzo .............. "${st.diagOrigenSegunElHijo}"`,
    `  · PONG recibido (petición-respuesta) ........... "${st.pong}"`,
    `  · SECTION_IN_VIEW más reciente ................. "${st.ultimaSeccion}"`,
    `  · mensajes rechazados y registrados (P1) ....... ${JSON.stringify(st.rechazados)}`,
    `  · peticiones del marco del lienzo (todas):`,
    ...delLienzo.map((p) => `      ${p.tipo.padEnd(10)} ${p.url}`),
    `  · respuestas HTTP >= 400 (${errores.length}):`,
    ...errores.map((e) => `      ${e}`),
    `  · consola del navegador (${consola.length} líneas):`,
    ...consola.slice(0, 30).map((l) => `      ${l}`),
    "",
  ].join("\n");
  console.log(detalle);
  mkdirSync(EVID, { recursive: true });
  writeFileSync(`${EVID}/tabla.txt`, detalle);

  expect(tabla.filter((t) => !t.pasa).map((t) => t.id), "criterios que FALLAN").toEqual([]);
});

// ── Controles negativos: sin ellos, un "cero violaciones" no prueba nada ─────────────────────

test("control · la CSP del lienzo SÍ bloquea (atributo style en línea servido en el HTML)", async ({ page }) => {
  await page.goto("/canvas?probe=inline-style");
  await page.waitForTimeout(600);
  const v = await page.evaluate(() => (window as unknown as { __cspViolations: { directive: string }[] }).__cspViolations ?? []);
  // El oyente de A4 funciona: cuando algo se bloquea, lo registra.
  expect(v.length, "un atributo style= en el HTML debe producir una violación de style-src").toBeGreaterThan(0);
  expect(v.map((x) => x.directive).join(",")).toContain("style-src");
});

test("control · connect-src 'none' bloquea un fetch lanzado desde el lienzo", async ({ page }) => {
  await page.goto("/canvas?probe=fetch");
  await page.waitForFunction(
    () => (window as unknown as { __probeFetch?: string }).__probeFetch?.startsWith("bloqueado"),
    undefined, { timeout: 5000 },
  );
  const r = await page.evaluate(() => (window as unknown as { __probeFetch?: string }).__probeFetch);
  expect(r, "el fetch debe fallar").toContain("bloqueado");
  const v = await page.evaluate(() => (window as unknown as { __cspViolations: { directive: string }[] }).__cspViolations ?? []);
  expect(v.map((x) => x.directive).join(","), "y la violación debe ser de connect-src").toContain("connect-src");
});

test("control · U-15 en vivo: un mensaje v:2 deja el puente en «incompatible»", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(
    () => ((window as unknown as { __gate?: Gate }).__gate?.estado().readyMs ?? -1) >= 0,
    undefined, { timeout: 10_000 },
  );
  await page.evaluate(() => (window as unknown as { __gate: Gate }).__gate.inyectarV2());
  const st = await page.evaluate(() => (window as unknown as { __gate: Gate }).__gate.estado());
  expect(st.incompatible, "el puente pasa a estado incompatible").toBe(true);
  expect(st.rechazados.join(","), "y lo registra, no lo descarta en silencio (P1)").toContain("v=2");
});
