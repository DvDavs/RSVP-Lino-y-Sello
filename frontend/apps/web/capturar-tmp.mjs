// scratchpad/capturar.mjs — recaptura las cuatro invitaciones publicadas de 3-CV en los tres
// viewports, con el MISMO Chromium y las mismas anchuras que usó la revisión.
//
//   node capturar.mjs <directorio-destino> [--secciones] [--solo prefijo]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const ORIGEN = process.env.ORIGEN ?? "http://127.0.0.1:3000";

const INVITACIONES = [
  { prefijo: "boda-blush", token: "pub_1JDA1KAXGK6QRD19W8DSQPAW2Q" },
  { prefijo: "boda-olive", token: "pub_Z7AK8VYM4PMGXRGVB5CY155KH3" },
  { prefijo: "boda-navy", token: "pub_N4N35Y6D8BE31X25E9RC65R8D9" },
  { prefijo: "xv-garden", token: "pub_Q1MCKK6YGM7JZ00YMQBWM7Z2PS" },
];

const VIEWPORTS = [
  { nombre: "movil", width: 390, height: 844 },
  { nombre: "tablet", width: 820, height: 1180 },
  { nombre: "escritorio", width: 1440, height: 900 },
];

const destino = process.argv[2];
if (!destino) throw new Error("uso: node capturar.mjs <directorio-destino> [--secciones] [--solo prefijo]");
const conSecciones = process.argv.includes("--secciones");
const soloIdx = process.argv.indexOf("--solo");
const solo = soloIdx >= 0 ? process.argv[soloIdx + 1] : null;
mkdirSync(destino, { recursive: true });
if (conSecciones) mkdirSync(path.join(destino, "secciones"), { recursive: true });

const navegador = await chromium.launch({ executablePath: CHROMIUM });

/** `networkidle` no termina nunca contra esta build (bitacora/3-cv.md §6): recorrido + fuentes. */
async function asentar(page) {
  await page.evaluate(async () => {
    const paso = Math.round(window.innerHeight * 0.8);
    for (let y = 0; y < document.body.scrollHeight; y += paso) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 120));
  });
  await page.evaluate(() => document.fonts.ready);
  try {
    await page.waitForFunction(() => Array.from(document.images).every((i) => i.complete), null, { timeout: 40000 });
  } catch {
    const faltan = await page.evaluate(() =>
      Array.from(document.images).filter((i) => !i.complete).map((i) => i.currentSrc || i.src));
    console.error(`  AVISO: ${faltan.length} imagen(es) sin terminar: ${faltan.join(' ')}`);
  }
  await page.waitForTimeout(600);
}

const informe = [];

for (const inv of INVITACIONES) {
  if (solo && inv.prefijo !== solo) continue;
  for (const vp of VIEWPORTS) {
    const ctx = await navegador.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(`${ORIGEN}/i/${inv.token}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await asentar(page);
    const archivo = path.join(destino, `${inv.prefijo}-${vp.nombre}.png`);
    await page.screenshot({ path: archivo, fullPage: true });

    // Medidas del DOM que sostienen el juicio, en la misma corrida.
    const medidas = await page.evaluate(() => {
      const desbordamiento = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      const fuentes = [];
      document.fonts.forEach((f) => fuentes.push(`${f.family} ${f.weight} ${f.status}`));
      const secciones = Array.from(document.querySelectorAll("section[data-section-type]")).map((s) => {
        const h2 = s.querySelector("h2");
        const interior = h2?.querySelector("span, time, p") ?? null;
        const cs = h2 ? getComputedStyle(h2) : null;
        const ci = interior ? getComputedStyle(interior) : null;
        const r = s.getBoundingClientRect();
        return {
          tipo: s.getAttribute("data-section-type"),
          variante: s.getAttribute("data-variant"),
          alto: Math.round(r.height),
          x: Math.round(r.left),
          ancho: Math.round(r.width),
          h2Texto: h2?.textContent ?? null,
          h2Visible: h2 ? getComputedStyle(h2).position !== "absolute" : null,
          h2Familia: cs?.fontFamily ?? null,
          h2Color: cs?.color ?? null,
          textoFamilia: ci?.fontFamily ?? null,
          textoColor: ci?.color ?? null,
          fondo: cs ? getComputedStyle(s).backgroundColor : null,
        };
      });
      const portada = document.querySelector('section[data-section-type="cover"]');
      const stage = portada?.querySelector("div");
      const img = portada?.querySelector("img");
      return {
        desbordamiento,
        fuentes,
        secciones,
        portada: portada
          ? {
              alturaSeccion: Math.round(portada.getBoundingClientRect().height),
              stage: stage ? { w: Math.round(stage.getBoundingClientRect().width), h: Math.round(stage.getBoundingClientRect().height), x: Math.round(stage.getBoundingClientRect().left), y: Math.round(stage.getBoundingClientRect().top) } : null,
              img: img ? { fit: getComputedStyle(img).objectFit, pos: getComputedStyle(img).objectPosition, w: Math.round(img.getBoundingClientRect().width), h: Math.round(img.getBoundingClientRect().height), src: img.getAttribute("src") } : null,
            }
          : null,
      };
    });
    informe.push({ invitacion: inv.prefijo, viewport: vp.nombre, ...medidas });

    if (conSecciones && vp.nombre === "movil") {
      for (const s of await page.$$("section[data-section-type]")) {
        const tipo = await s.getAttribute("data-section-type");
        await s.screenshot({ path: path.join(destino, "secciones", `${inv.prefijo}-movil-${tipo}.png`) });
      }
    }
    if (conSecciones && vp.nombre === "escritorio") {
      for (const s of await page.$$("section[data-section-type]")) {
        const tipo = await s.getAttribute("data-section-type");
        await s.screenshot({ path: path.join(destino, "secciones", `${inv.prefijo}-escritorio-${tipo}.png`) });
      }
    }
    await ctx.close();
    console.log(`  ${archivo}`);
  }
}

await navegador.close();
console.log(JSON.stringify(informe, null, 1));
