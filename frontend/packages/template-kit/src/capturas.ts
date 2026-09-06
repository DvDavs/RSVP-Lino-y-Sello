// packages/template-kit/src/capturas.ts — `plantilla capturas <dir>`: la plantilla fotografiada en
// tres anchos, con Chromium, sin backend y sin desplegar nada.
//
// Reutiliza el previsualizador entero: levanta `preview` en un puerto efímero, apunta Chromium a
// `/?marco=<ancho>` (el lienzo desnudo, sin el chrome del kit) y lo apaga al terminar. Así no hay
// dos maneras de pintar la misma plantilla — lo que sale en la foto es exactamente lo que el autor
// tiene delante.
//
// Tres reglas duras del entorno, cada una pagada con una medición (`4-0a.md`, `4-1a.md`, `CLAUDE.md`):
//   1. **NUNCA `playwright install`.** Chromium viene preinstalado y el proxy bloquea la descarga.
//      Se lanza el navegador del paquete `playwright`; si su revisión no está en disco, se cae al
//      ejecutable de `PLAYWRIGHT_BROWSERS_PATH` (por omisión `/opt/pw-browsers`) con
//      `executablePath`, en vez de fallar pidiendo una descarga imposible.
//   2. **Las capturas van FUERA del directorio de la versión.** Un archivo no declarado dentro de
//      `<slug>/<version>/` hace fallar el registro con `TPL_PACKAGE_UNEXPECTED_FILE` (`01 §2.1`) y
//      pone rojo el `check`. El destino por omisión es `<slug>/capturas/`, hermano de la versión.
//      `capturas` se NIEGA a escribir dentro del paquete aunque se lo pidan por `--destino`.
//   3. **Nombres estables y predecibles**: `<slug>@<version>-<ancho>.png`. Los cita la guía y los
//      manda el orquestador; un nombre con fecha o con hash obligaría a volver a mirarlos cada vez.
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { preview, type ServidorPreview } from "./preview.ts";

/** Los tres anchos del encargo. El alto es sólo la ventana: la foto es de la página entera. */
export const ANCHOS_POR_DEFECTO = [
  { id: "movil", ancho: 390, alto: 844 },
  { id: "tableta", ancho: 768, alto: 1024 },
  { id: "escritorio", ancho: 1280, alto: 900 },
] as const;

/** Ruta habitual de Chromium en este entorno (`CLAUDE.md`: preinstalado, nunca `playwright install`). */
export const CHROMIUM_DEL_ENTORNO = "/opt/pw-browsers/chromium";

/** Puerto de partida propio, para no pelearse con un `plantilla preview` que ya esté abierto. */
export const PUERTO_CAPTURAS = 5400;

export interface OpcionesCapturas {
  readonly dir: string;
  /** Directorio de salida; por omisión `<slug>/capturas/`, FUERA del directorio de la versión. */
  readonly destino?: string;
  /** Anchos a capturar; por omisión 390, 768 y 1280. */
  readonly anchos?: readonly number[];
  readonly paleta?: string;
  readonly fuentes?: string;
  /** Clave de sección del manifiesto: recorta a esa sección en vez de la página entera. */
  readonly seccion?: string;
  /** Milisegundos de espera a que las tipografías y las imágenes estén listas. */
  readonly plazo?: number;
  /** Densidad de píxel del PNG (por omisión 2: el dueño mira las capturas en pantalla densa). */
  readonly escala?: number;
}

export interface ResultadoCapturas {
  readonly ok: boolean;
  readonly salida: string;
  readonly ficheros: readonly string[];
}

/** `<slug>@<version>-<ancho>.png`, o `<slug>@<version>-<seccion>-<ancho>.png`. Estable, sin fechas. */
export function nombreDeCaptura(slug: string, version: string, ancho: number, seccion?: string): string {
  const medio = seccion === undefined ? "" : `-${seccion.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  return `${slug}@${version}${medio}-${ancho}.png`;
}

/**
 * Destino por omisión: `<padre del paquete>/capturas/`. Para
 * `frontend/templates/bautizo-elegante/1.0.0` sale `frontend/templates/bautizo-elegante/capturas`,
 * que es hermano de la versión y por tanto NO entra en el `package_hash` ni en el árbol que valida
 * el registro.
 */
export function destinoPorDefecto(dirPaquete: string): string {
  return join(dirname(resolve(dirPaquete)), "capturas");
}

/** `true` si `destino` cae dentro del directorio de la versión (y por tanto rompería el registro). */
export function caeDentroDelPaquete(dirPaquete: string, destino: string): boolean {
  const p = resolve(dirPaquete);
  const d = resolve(destino);
  return d === p || d.startsWith(p + "/");
}

interface LanzadorChromium {
  launch(opts: Record<string, unknown>): Promise<{
    newContext(opts: Record<string, unknown>): Promise<{
      newPage(): Promise<PaginaMinima>;
    }>;
    close(): Promise<void>;
  }>;
}

interface PaginaMinima {
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  evaluate(fn: string): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  screenshot(opts: Record<string, unknown>): Promise<Buffer>;
  locator(selector: string): { screenshot(opts: Record<string, unknown>): Promise<Buffer>; count(): Promise<number> };
  close(): Promise<void>;
}

/**
 * Abre Chromium sin descargar NADA. Primero el que trae `playwright`; si su revisión no está en
 * disco (el mensaje de Playwright pide `playwright install`, que aquí está prohibido), se reintenta
 * con el ejecutable preinstalado del entorno.
 */
export async function abrirChromium(
  chromium: LanzadorChromium,
  existe: (p: string) => boolean = existsSync,
  entorno: Readonly<Record<string, string | undefined>> = process.env,
): Promise<{ navegador: Awaited<ReturnType<LanzadorChromium["launch"]>>; via: string }> {
  const opciones = { args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"] };
  try {
    return { navegador: await chromium.launch(opciones), via: "playwright" };
  } catch (e) {
    const raiz = entorno["PLAYWRIGHT_BROWSERS_PATH"] ?? dirname(CHROMIUM_DEL_ENTORNO);
    const ejecutable = join(raiz, "chromium");
    if (!existe(ejecutable)) {
      throw new Error(
        `Chromium no arranca y tampoco está en ${ejecutable}.\n` +
        `  ${(e as Error).message.split("\n")[0] ?? ""}\n` +
        `  Sugerencia: exporta PLAYWRIGHT_BROWSERS_PATH al directorio donde esté Chromium. ` +
        `NUNCA ejecutes \`playwright install\`: el proxy del entorno bloquea la descarga (CLAUDE.md).`,
      );
    }
    return { navegador: await chromium.launch({ ...opciones, executablePath: ejecutable }), via: ejecutable };
  }
}

/**
 * Deja la página lista para la foto y devuelve qué se esperó. Se ejecuta UNA vez (`evaluate`), no en
 * un bucle de sondeo, porque tiene efectos: **pone `loading="eager"` en todas las imágenes**.
 *
 * Ese detalle costó una medición. `ImageBlock` marca sus imágenes `loading="lazy"` salvo la de la
 * primera pantalla (`ImageBlock.tsx:20-27`), y en una captura `fullPage` el navegador NO las carga:
 * están fuera de la ventana. Esperar a que `img.complete` sea cierto en todas se quedaba colgado
 * hasta el plazo y la captura fallaba entera. Con `eager` se cargan todas y la foto sale completa.
 *
 * Cada espera lleva su propio tope: una imagen rota (asset que falta) no puede bloquear la foto.
 */
const LISTA = `(async () => {
  const tope = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
  const imgs = Array.from(document.images);
  for (const i of imgs) { i.loading = "eager"; if (i.decoding === "async") i.decoding = "sync"; }
  if (document.fonts) { try { await tope(document.fonts.ready, 5000); } catch (e) {} }
  await tope(Promise.all(imgs.map(i => i.complete ? null : new Promise(r => {
    i.addEventListener("load", r, { once: true });
    i.addEventListener("error", r, { once: true });
  }))), 8000);
  return { imagenes: imgs.length, fuentes: document.fonts ? document.fonts.status : "n/d" };
})()`;

export async function capturas(opts: OpcionesCapturas): Promise<ResultadoCapturas> {
  const dir = resolve(opts.dir);
  const anchos = (opts.anchos !== undefined && opts.anchos.length > 0
    ? opts.anchos
    : ANCHOS_POR_DEFECTO.map(a => a.ancho));
  const destino = opts.destino !== undefined ? resolve(opts.destino) : destinoPorDefecto(dir);

  if (caeDentroDelPaquete(dir, destino)) {
    return {
      ok: false, ficheros: [],
      salida:
        `ERROR TPL_PACKAGE_UNEXPECTED_FILE  ${destino}#$\n` +
        `  El destino cae DENTRO del directorio de la versión: un archivo no declarado ahí hace ` +
        `fallar el registro con TPL_PACKAGE_UNEXPECTED_FILE y pone rojo \`plantilla check\`.\n` +
        `  Sugerencia: \`--destino ${destinoPorDefecto(dir)}\` (hermano de la versión), o cualquier ` +
        `directorio fuera de ${dir}.`,
    };
  }

  let servidor: ServidorPreview | undefined;
  try {
    servidor = await preview({
      dir, puerto: PUERTO_CAPTURAS, marcadores: true,
      ...(opts.paleta !== undefined ? { paleta: opts.paleta } : {}),
      ...(opts.fuentes !== undefined ? { fuentes: opts.fuentes } : {}),
    });
    const estado = servidor.estado();
    if (!estado.ok) {
      return {
        ok: false, ficheros: [],
        salida:
          `No hay nada que fotografiar: el paquete no pasa \`check\`.\n\n${estado.diagnostico}\n\n` +
          `Sugerencia: arregla los errores de arriba (\`pnpm plantilla check ${dir}\`) y vuelve a intentarlo.`,
      };
    }
    const slug = estado.slug ?? "paquete";
    const version = estado.version ?? "0.0.0";

    const { chromium } = await import("playwright");
    const { navegador, via } = await abrirChromium(chromium as unknown as LanzadorChromium);
    mkdirSync(destino, { recursive: true });

    const ficheros: string[] = [];
    const plazo = opts.plazo ?? 15_000;
    try {
      for (const ancho of anchos) {
        const perfil = ANCHOS_POR_DEFECTO.find(a => a.ancho === ancho);
        const alto = perfil?.alto ?? 900;
        const contexto = await navegador.newContext({
          viewport: { width: ancho, height: alto },
          deviceScaleFactor: opts.escala ?? 2,   // el dueño mira las capturas en una pantalla densa
          locale: "es-MX",
          reducedMotion: "reduce",        // nada a medio animar en la foto (determinismo)
        });
        const pagina = await contexto.newPage();
        const url = enlaceDelLienzo(servidor.url, ancho, opts.paleta, opts.fuentes);
        await pagina.goto(url, { waitUntil: "load", timeout: plazo });
        await pagina.evaluate(LISTA);
        await pagina.waitForTimeout(200);

        const fichero = join(destino, nombreDeCaptura(slug, version, ancho, opts.seccion));
        if (opts.seccion !== undefined) {
          const zona = pagina.locator(`section[aria-labelledby="s-${opts.seccion}"]`);
          if (await zona.count() === 0) {
            throw new Error(
              `la sección "${opts.seccion}" no está en la página; las claves del manifiesto son: ` +
              `${estado.composed?.sections.map(s => s.key).join(", ") ?? "(ninguna)"}`,
            );
          }
          await zona.screenshot({ path: fichero, animations: "disabled" });
        } else {
          await pagina.screenshot({ path: fichero, fullPage: true, animations: "disabled" });
        }
        ficheros.push(fichero);
        await pagina.close();
      }
    } finally {
      await navegador.close();
    }

    const escala = opts.escala ?? 2;
    const lineas = [
      `${ficheros.length} captura(s) de ${slug}@${version} a ${anchos.join(", ")} px ` +
      `(x${escala}; Chromium: ${via}).`,
      ...ficheros.map(f => `  ${f}  ${(statSync(f).size / 1024).toFixed(1)} KB`),
      "",
      `Están FUERA de ${dir}: dentro serían un TPL_PACKAGE_UNEXPECTED_FILE al registrar.`,
    ];
    for (const n of estado.notas) lineas.push(`  ${n}`);
    return { ok: true, ficheros, salida: lineas.join("\n") };
  } finally {
    await servidor?.cerrar();
  }
}

/** La MISMA URL que abre la consola en su `<iframe>`: la foto y la pantalla no pueden divergir. */
export function enlaceDelLienzo(base: string, ancho: number, paleta?: string, fuentes?: string): string {
  const p = new URLSearchParams({ marco: String(ancho) });
  if (paleta !== undefined) p.set("paleta", paleta);
  if (fuentes !== undefined) p.set("fuentes", fuentes);
  return `${base}/?${p.toString()}`;
}
