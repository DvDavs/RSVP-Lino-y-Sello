// test/preview-capturas.test.ts — las pruebas que SÍ levantan un servidor y un navegador.
//
// PLAZOS GENEROSOS A PROPÓSITO (instrucción del encargo 4-1B): arrancar Vite y Chromium tarda entre
// dos y veinte segundos según lo ocupada que esté la máquina. Una prueba que falla porque otro
// agente está compilando no es una compuerta, es ruido — así que el plazo se dimensiona para el peor
// caso medido y lo que se comprueba son HECHOS (hay tres ficheros, tienen estas dimensiones, el
// texto cambió), nunca tiempos.
//
// Todo lo que puede probarse sin navegador está en `componer-recursos.test.ts` y NO se repite aquí.
import { afterAll, describe, expect, it } from "vitest";
import { cpSync, existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { preview, type ServidorPreview } from "../src/preview.ts";
import { abrirChromium, capturas } from "../src/capturas.ts";
import { PAQUETES } from "./ayuda.ts";

const PLAZO = 240_000;
const BAUTIZO = join(PAQUETES, "bautizo-elegante/1.0.0");
const abiertos: ServidorPreview[] = [];

async function abrir(dir: string, puerto: number): Promise<ServidorPreview> {
  const s = await preview({ dir, puerto });
  abiertos.push(s);
  return s;
}

afterAll(async () => {
  for (const s of abiertos) await s.cerrar();
});

/** Ancho y alto de un PNG, leídos de su cabecera IHDR (bytes 16..24). Sin dependencias. */
function dimensionesPng(ruta: string): { ancho: number; alto: number } {
  const b = readFileSync(ruta);
  expect(b.subarray(1, 4).toString("latin1")).toBe("PNG");
  return { ancho: b.readUInt32BE(16), alto: b.readUInt32BE(20) };
}

function copiaTemporal(origen: string): string {
  const dir = join(mkdtempSync(join(tmpdir(), "kit-preview-")), "paquete");
  cpSync(origen, dir, { recursive: true });
  return dir;
}

describe("plantilla preview", () => {
  it("arranca, dice su URL y cómo salir, y sirve el documento compuesto", { timeout: PLAZO }, async () => {
    const s = await abrir(BAUTIZO, 5361);
    expect(s.ok).toBe(true);
    expect(s.salida).toContain("Previsualizador de bautizo-elegante@1.0.0 en http://127.0.0.1:");
    expect(s.salida).toContain("Ctrl+C para salir.");

    const estado = await (await fetch(`${s.url}/__preview/estado.json`)).json() as { ok: boolean; composed?: unknown };
    expect(estado.ok).toBe(true);
    expect(estado.composed).toBeDefined();

    const pagina = await fetch(`${s.url}/?marco=390`);
    expect(pagina.status).toBe(200);
    expect(pagina.headers.get("content-type")).toContain("text/html");
  });

  it("si el puerto está ocupado toma otro y LO DICE (nunca falla en silencio)", { timeout: PLAZO }, async () => {
    const primero = await abrir(BAUTIZO, 5362);
    const segundo = await abrir(BAUTIZO, 5362);
    expect(segundo.puerto).not.toBe(primero.puerto);
    expect(segundo.salida).toContain("El puerto 5362 estaba ocupado; se usa el ");
    expect(segundo.salida).toContain(String(segundo.puerto));
  });

  it("sirve los assets del paquete desde el disco y el marcador de las imágenes que faltan", { timeout: PLAZO }, async () => {
    const s = await abrir(join(PAQUETES, "boda-clasica/1.0.0"), 5363);
    const asset = await fetch(`${s.url}/__preview/asset/preview.webp`);
    expect(asset.status).toBe(200);
    expect(asset.headers.get("content-type")).toBe("image/webp");
    expect((await asset.arrayBuffer()).byteLength).toBeGreaterThan(0);

    // Ni un byte fuera del paquete: `../` no saca nada de `assets/`.
    expect((await fetch(`${s.url}/__preview/asset/..%2Ftemplate.json`)).status).toBe(404);

    const marcador = await fetch(`${s.url}/__preview/marcador.svg?b=kit:ph:cover.image`);
    expect(marcador.status).toBe(200);
    expect(await marcador.text()).toContain("cover.image");
  });

  it("un paquete ROTO enseña los errores de `check`, no una página en blanco", { timeout: PLAZO }, async () => {
    const dir = mkdtempSync(join(tmpdir(), "kit-preview-roto-"));
    writeFileSync(join(dir, "template.json"), "{}", "utf8");
    const s = await abrir(dir, 5364);
    expect(s.ok).toBe(false);
    expect(s.salida).toContain("El paquete NO pasa check");
    expect(s.salida).toContain("ERROR TPL_PACKAGE_MISSING_FILE");

    const estado = await (await fetch(`${s.url}/__preview/estado.json`)).json() as {
      ok: boolean; composed?: unknown; hallazgos: readonly { codigo: string }[]; diagnostico: string;
    };
    expect(estado.ok).toBe(false);
    expect(estado.composed).toBeUndefined();
    expect(estado.hallazgos.map(h => h.codigo)).toContain("TPL_PACKAGE_MISSING_FILE");
    // El formato es el MISMO de la línea de órdenes (contrato de `formato.ts`).
    expect(estado.diagnostico).toMatch(/\n\d+ error\(es\) · \d+ aviso\(s\) · \d+ corregido\(s\)$/);
  });

  it("al GUARDAR uno de los tres .json, el estado que sirve el servidor cambia solo", { timeout: PLAZO }, async () => {
    const dir = copiaTemporal(BAUTIZO);
    const s = await abrir(dir, 5365);
    const ruta = join(dir, "defaults.json");

    const antes = await (await fetch(`${s.url}/__preview/estado.json`)).json() as { version_estado: number };
    const doc = JSON.parse(readFileSync(ruta, "utf8")) as { content: Record<string, unknown> };
    doc.content["amenities.title"] = { kind: "text", value: "TEXTO NUEVO DEL AUTOR" };
    writeFileSync(ruta, JSON.stringify(doc, null, 2) + "\n", "utf8");

    // El vigilante es asíncrono; se espera al HECHO (el texto aparece), no a un tiempo fijo.
    const encontrado = await hasta(async () => {
      const cuerpo = await (await fetch(`${s.url}/__preview/estado.json`)).text();
      return cuerpo.includes("TEXTO NUEVO DEL AUTOR") ? cuerpo : null;
    }, PLAZO / 4);
    expect(encontrado).not.toBeNull();
    const despues = JSON.parse(encontrado!) as { version_estado: number; ok: boolean };
    expect(despues.ok).toBe(true);
    expect(despues.version_estado).toBeGreaterThan(antes.version_estado);
  });

  it("el NAVEGADOR refleja el texto guardado SIN recargar la página", { timeout: PLAZO }, async () => {
    const dir = copiaTemporal(BAUTIZO);
    const s = await abrir(dir, 5367);
    const { chromium } = await import("playwright");
    const { navegador } = await abrirChromium(chromium as never);
    try {
      const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 } });
      const pagina = await contexto.newPage() as unknown as {
        goto(u: string, o?: unknown): Promise<unknown>;
        evaluate(f: string): Promise<unknown>;
        content(): Promise<string>;
        waitForFunction(f: string, a?: unknown, o?: unknown): Promise<unknown>;
      };
      await pagina.goto(`${s.url}/?marco=390`, { waitUntil: "load", timeout: PLAZO / 4 });
      await pagina.waitForFunction(`document.body.innerText.includes("Amenidades")`, undefined, { timeout: PLAZO / 4 });

      // Marca en la ventana: si la página se RECARGARA, esta variable desaparecería. Es lo que
      // convierte «se ve el texto nuevo» en «se ve el texto nuevo SIN recargar».
      await pagina.evaluate(`window.__marcaDeLaPrueba = 41;`);

      const doc = JSON.parse(readFileSync(join(dir, "defaults.json"), "utf8")) as { content: Record<string, unknown> };
      doc.content["amenities.title"] = { kind: "text", value: "TEXTO NUEVO DEL AUTOR" };
      writeFileSync(join(dir, "defaults.json"), JSON.stringify(doc, null, 2) + "\n", "utf8");

      await pagina.waitForFunction(
        `document.body.innerText.includes("TEXTO NUEVO DEL AUTOR")`, undefined, { timeout: PLAZO / 4 },
      );
      expect(await pagina.evaluate(`window.__marcaDeLaPrueba`)).toBe(41);   // no hubo recarga
      expect(await pagina.content()).not.toContain("Amenidades");
    } finally {
      await navegador.close();
    }
  });

  it("un .json guardado a medias no tumba el servidor: lo dice y el siguiente guardado lo arregla", { timeout: PLAZO }, async () => {
    const dir = copiaTemporal(BAUTIZO);
    const s = await abrir(dir, 5366);
    const ruta = join(dir, "theme.json");
    const bueno = readFileSync(ruta, "utf8");

    writeFileSync(ruta, '{ "palettes": [', "utf8");
    expect(s.recomponer().ok).toBe(false);
    // Lo atrapa `check` (mismo código que en la terminal), no el paracaídas `estadoIlegible`.
    expect(s.estado().diagnostico).toContain("ERROR TPL_PACKAGE_JSON_INVALID  theme.json#$");
    expect((await fetch(`${s.url}/__preview/estado.json`)).status).toBe(200);

    writeFileSync(ruta, bueno, "utf8");
    expect(s.recomponer().ok).toBe(true);
  });
});

describe("plantilla capturas", () => {
  it("produce TRES ficheros no vacíos con las dimensiones de los tres anchos", { timeout: PLAZO }, async () => {
    const destino = mkdtempSync(join(tmpdir(), "kit-capturas-"));
    const r = await capturas({ dir: BAUTIZO, destino, escala: 1 });
    expect(r.ok).toBe(true);
    expect(r.ficheros).toHaveLength(3);
    expect(r.ficheros.map(f => f.split("/").pop())).toEqual([
      "bautizo-elegante@1.0.0-390.png",
      "bautizo-elegante@1.0.0-768.png",
      "bautizo-elegante@1.0.0-1280.png",
    ]);
    for (const [i, ancho] of [390, 768, 1280].entries()) {
      const f = r.ficheros[i]!;
      expect(existsSync(f)).toBe(true);
      expect(statSync(f).size).toBeGreaterThan(1024);      // no vacío, y no un PNG de 1x1
      const d = dimensionesPng(f);
      expect(d.ancho).toBe(ancho);                          // escala 1 ⇒ píxeles = píxeles CSS
      expect(d.alto).toBeGreaterThan(1000);                 // `fullPage`: la invitación entera
    }
    expect(r.salida).toContain("Están FUERA de");
    for (const f of r.ficheros) expect(r.salida).toContain(f);
  });

  it("con `--escala 2` el PNG sale al doble de píxeles (pantalla densa)", { timeout: PLAZO }, async () => {
    const destino = mkdtempSync(join(tmpdir(), "kit-capturas-2x-"));
    const r = await capturas({ dir: BAUTIZO, destino, anchos: [390], escala: 2 });
    expect(r.ok).toBe(true);
    expect(dimensionesPng(r.ficheros[0]!).ancho).toBe(780);
  });

  it("se NIEGA a escribir dentro del directorio de la versión (TPL_PACKAGE_UNEXPECTED_FILE)", { timeout: PLAZO }, async () => {
    const r = await capturas({ dir: BAUTIZO, destino: join(BAUTIZO, "assets") });
    expect(r.ok).toBe(false);
    expect(r.ficheros).toHaveLength(0);
    expect(r.salida).toContain("ERROR TPL_PACKAGE_UNEXPECTED_FILE");
    expect(r.salida).toContain("Sugerencia: `--destino ");
    expect(existsSync(join(BAUTIZO, "assets"))).toBe(false);   // no ha creado nada
  });

  it("sobre un paquete que no pasa `check` no abre el navegador: enseña el diagnóstico", { timeout: PLAZO }, async () => {
    const dir = mkdtempSync(join(tmpdir(), "kit-capturas-roto-"));
    writeFileSync(join(dir, "template.json"), "{}", "utf8");
    const destino = mkdtempSync(join(tmpdir(), "kit-capturas-salida-"));
    const r = await capturas({ dir, destino });
    expect(r.ok).toBe(false);
    expect(r.ficheros).toHaveLength(0);
    expect(r.salida).toContain("No hay nada que fotografiar");
    expect(r.salida).toContain("ERROR TPL_PACKAGE_MISSING_FILE");
  });

  it("`--seccion` recorta a una sección, y una clave inventada explica cuáles hay", { timeout: PLAZO }, async () => {
    const destino = mkdtempSync(join(tmpdir(), "kit-capturas-sec-"));
    const r = await capturas({ dir: BAUTIZO, destino, anchos: [768], seccion: "rsvp", escala: 1 });
    expect(r.ok).toBe(true);
    expect(r.ficheros[0]!.endsWith("bautizo-elegante@1.0.0-rsvp-768.png")).toBe(true);
    expect(dimensionesPng(r.ficheros[0]!).ancho).toBeLessThanOrEqual(768);

    await expect(capturas({ dir: BAUTIZO, destino, anchos: [768], seccion: "no-existe" }))
      .rejects.toThrow(/la sección "no-existe" no está en la página/);
  });
});

/** Reintenta `f` hasta que devuelva algo distinto de `null` o se agote el plazo. */
async function hasta<T>(f: () => Promise<T | null>, plazo: number): Promise<T | null> {
  const fin = Date.now() + plazo;
  for (;;) {
    const r = await f();
    if (r !== null) return r;
    if (Date.now() > fin) return null;
    await new Promise(res => setTimeout(res, 120));
  }
}
