// packages/template-kit/src/preview.ts — `plantilla preview <dir>`: el paquete, pintado, en el
// navegador, sin backend y sin desplegar nada.
//
// POR QUÉ EXISTE (encargo 4-1B): hasta aquí el autor escribía tres `.json` y no veía NADA hasta
// registrar el paquete y publicar una invitación. `preview` levanta un servidor de desarrollo de
// Vite dentro del propio kit que monta `SectionsRoot` de `@invitaciones/sections` sobre el
// `ComposedDocument` que produce `componer.ts`, y lo recompone al vuelo cada vez que se guarda uno
// de los tres ficheros.
//
// Decisiones que conviene no volver a discutir:
//   · **Vite se carga con `import()` perezoso**, dentro de la función. `src/index.ts` reexporta este
//     módulo y `check`/`nueva`/`registrar` no pueden pagar el arranque de Vite, React y sus
//     dependencias sólo por importarse (el núcleo del kit sigue siendo «sólo Node»).
//   · **El lienzo va en un `<iframe>` por cada ancho**, no en un `<div>` con `width: 390px`: las
//     secciones usan consultas de medios (`@media`) y unidades de ventana (`100svh`), que miran la
//     VENTANA, no al contenedor. Con divs, el «móvil» saldría con el diseño de escritorio encogido
//     — que es exactamente la mentira que este comando existe para evitar.
//   · **La recarga es por `node:fs.watch` + SSE**, no por el HMR de Vite: los tres `.json` no son
//     módulos del grafo de Vite (viven fuera de `root`), así que Vite no tiene nada que invalidar —
//     y `server.watcher.add()` sobre rutas de fuera NO dispara nada en Vite 8 (medido). El servidor
//     los vigila él mismo, recompone en Node y empuja un evento; cada marco vuelve a pedir
//     `/__preview/estado.json` y se repinta. Sin recarga de página: no se pierde el desplazamiento.
//   · **Nunca `playwright install`** y nunca se escribe dentro del paquete: `preview` es de sólo
//     lectura sobre `<dir>` (`check({escribir: false})`).
import { existsSync, readFileSync, statSync, watch, type FSWatcher } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import { componerPaquete, type EstadoPreview } from "./componer.ts";
import { hojaDeFuentes, marcadorSvg } from "./recursos.ts";

/** Carpeta de la aplicación de previsualización (raíz del servidor de Vite). */
export const APP_DIR = resolve(fileURLToPath(new URL(".", import.meta.url)), "../preview-app");
/** Raíz del paquete `@invitaciones/template-kit`. */
export const KIT_DIR = resolve(APP_DIR, "..");
/** Raíz del monorepo `frontend/`. */
export const FRONTEND_DIR = resolve(KIT_DIR, "../..");

/** Puerto de partida. Si está ocupado, Vite toma el siguiente libre y el comando lo DICE. */
export const PUERTO_POR_DEFECTO = 5310;

/** Los tres ficheros del paquete que se vigilan (`01 §2.1`). */
export const FICHEROS_VIGILADOS = ["template.json", "theme.json", "defaults.json"] as const;

export interface OpcionesPreview {
  readonly dir: string;
  /** Puerto de partida; si está ocupado se usa el siguiente libre. */
  readonly puerto?: number;
  readonly host?: string;
  /** `false` para ver los huecos de imagen vacíos, como los verá un invitado (R5). */
  readonly marcadores?: boolean;
  /** Paleta y conjunto de fuentes de `theme.json`; por omisión, los `default*Id`. */
  readonly paleta?: string;
  readonly fuentes?: string;
}

export interface ServidorPreview {
  readonly url: string;
  readonly puerto: number;
  /** `true` si el paquete pasa `check`. Si es `false` el navegador enseña los ERRORES, no una página en blanco. */
  readonly ok: boolean;
  /** Lo que el CLI imprime al arrancar: una línea con la URL y cómo salir, más las notas. */
  readonly salida: string;
  /** Estado actual (se recalcula al guardar). */
  estado(): EstadoPreview;
  /** Fuerza una recomposición, como si se hubiera guardado un fichero. Devuelve el estado nuevo. */
  recomponer(): EstadoPreview;
  cerrar(): Promise<void>;
}

const TIPOS: Readonly<Record<string, string>> = {
  ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".woff2": "font/woff2", ".woff": "font/woff",
  ".ttf": "font/ttf", ".css": "text/css", ".json": "application/json",
};

export function tipoDe(ruta: string): string {
  return TIPOS[extname(ruta).toLowerCase()] ?? "application/octet-stream";
}

/** Sirve un archivo del disco, o `404`. Rechaza cualquier ruta que se salga de `raiz` (`..`). */
export function servirArchivo(res: ServerResponse, raiz: string, relativa: string): void {
  const ruta = resolve(raiz, relativa);
  // `resolve("/")` es `"/"`, y `"/" + "/"` sería `"//"`: sin este caso, servir desde la raíz del
  // sistema de ficheros rechazaba TODO (medido: los `.woff2` de las tipografías daban 404).
  const prefijo = resolve(raiz) === "/" ? "/" : resolve(raiz) + "/";
  if (!ruta.startsWith(prefijo) || !existsSync(ruta) || !statSync(ruta).isFile()) {
    res.statusCode = 404;
    res.end("no encontrado");
    return;
  }
  res.setHeader("Content-Type", tipoDe(ruta));
  res.setHeader("Cache-Control", "no-store");
  res.end(readFileSync(ruta));
}

/** El estado que se enseña cuando ni siquiera se pueden leer los `.json` (editor a medio guardar). */
export function estadoIlegible(dir: string, mensaje: string): EstadoPreview {
  return {
    ok: false, dir, hallazgos: [], fuentes: [], notas: [], paletas: [], conjuntosDeFuentes: [],
    diagnostico:
      `plantilla check ${dir}\n\nERROR TPL_PACKAGE_INVALID_JSON  ${dir}#$\n` +
      `  No he podido leer el paquete: ${mensaje}\n` +
      `  Sugerencia: guarda otra vez el fichero; si el editor lo dejó a medias, revisa las comas y las llaves.\n\n` +
      `1 error(es) · 0 aviso(s) · 0 corregido(s)`,
    version_estado: Date.now(),
  };
}

/**
 * Levanta el previsualizador. Devuelve cuando el servidor ya escucha: `salida` trae la línea que el
 * CLI imprime (URL y cómo salir) y `cerrar()` lo apaga (lo usan las pruebas y `capturas`).
 */
export async function preview(opts: OpcionesPreview): Promise<ServidorPreview> {
  const dir = resolve(opts.dir);
  if (!existsSync(dir)) {
    throw new Error(
      `No existe el directorio "${opts.dir}".\n` +
      `  Sugerencia: \`pnpm plantilla preview frontend/templates/<slug>/<version>\`; ` +
      `si acabas de crear la plantilla, la ruta la imprimió \`pnpm plantilla nueva\`.`,
    );
  }

  const { createServer } = await import("vite");
  const react = (await import("@vitejs/plugin-react")).default;

  const host = opts.host ?? "127.0.0.1";
  const puertoPedido = opts.puerto ?? PUERTO_POR_DEFECTO;

  // El estado se calcula con la base definitiva (hace falta el puerto REAL para las URLs de los
  // assets), así que arranca con la provisional y se recalcula en cuanto el servidor escucha.
  let base = `http://${host}:${puertoPedido}`;
  const comunes = {
    dir,
    placeholders: opts.marcadores !== false,
    ...(opts.paleta !== undefined ? { paleta: opts.paleta } : {}),
    ...(opts.fuentes !== undefined ? { fuentes: opts.fuentes } : {}),
  };
  let estado: EstadoPreview = componerPaquete({ ...comunes, base });
  const oyentes = new Set<ServerResponse>();

  const recomponer = (): EstadoPreview => {
    try {
      estado = componerPaquete({ ...comunes, base });
    } catch (e) {
      // Un `.json` a medio guardar (el editor escribe en dos pasadas) no debe tumbar el servidor:
      // se enseña el error en la consola y el siguiente guardado lo arregla.
      estado = estadoIlegible(dir, (e as Error).message);
    }
    return estado;
  };

  const avisar = (): void => {
    const dato = `event: cambio\ndata: ${estado.version_estado}\n\n`;
    for (const r of oyentes) r.write(dato);
  };

  const raicesModulos = [
    join(KIT_DIR, "node_modules"),
    join(FRONTEND_DIR, "apps/web/node_modules"),
    join(FRONTEND_DIR, "node_modules"),
  ];

  interface ServidorVite {
    middlewares: { use: (f: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void };
  }

  /**
   * El vigilante es `node:fs.watch` sobre el directorio del paquete, NO el `watcher` de Vite.
   * Medido: `server.watcher.add()` sobre rutas fuera de la raíz del servidor no dispara nada en
   * Vite 8 (la prueba «al guardar, el estado cambia solo» se quedaba esperando 60 s). Y aunque
   * funcionara, sería atarse a una API interna que cambia entre versiones mayores para vigilar tres
   * ficheros que ni siquiera son módulos suyos.
   *
   * Se agrupa por 60 ms porque un editor guarda en dos pasadas (escribe temporal + renombra) y sin
   * eso cada guardado recompone dos o tres veces.
   */
  let vigilante: FSWatcher | undefined;
  let pendiente: NodeJS.Timeout | undefined;
  const alCambiar = (): void => {
    if (pendiente !== undefined) clearTimeout(pendiente);
    pendiente = setTimeout(() => { recomponer(); avisar(); }, 60);
  };

  const atender = (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    const crudo = req.url ?? "/";
    if (!crudo.startsWith("/__preview/")) { next(); return; }
    const u = new URL(crudo, base);
    const ruta = u.pathname;

    if (ruta === "/__preview/estado.json") {
      // La consola puede pedir OTRA paleta o conjunto de fuentes sin reiniciar nada: se recompone
      // al vuelo con ese `theme` y no se guarda como estado global (los demás marcos no cambian
      // solos). Es el mismo camino que recorre el editor con `doc.theme` (R8).
      const paleta = u.searchParams.get("paleta");
      const fuentes = u.searchParams.get("fuentes");
      let cuerpo = estado;
      if (paleta !== null || fuentes !== null) {
        try {
          cuerpo = componerPaquete({
            ...comunes, base,
            ...(paleta !== null ? { paleta } : {}),
            ...(fuentes !== null ? { fuentes } : {}),
          });
        } catch (e) { cuerpo = estadoIlegible(dir, (e as Error).message); }
      }
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(JSON.stringify(cuerpo));
      return;
    }
    if (ruta === "/__preview/eventos") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive",
      });
      res.write(`event: hola\ndata: ${estado.version_estado}\n\n`);
      oyentes.add(res);
      req.on("close", () => { oyentes.delete(res); });
      return;
    }
    if (ruta === "/__preview/marcador.svg") {
      const tokens = estado.composed?.theme.tokens ?? {};
      res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(marcadorSvg({
        etiqueta: (u.searchParams.get("b") ?? "").replace(/^kit:ph:/, ""),
        ...(tokens["ink"] !== undefined ? { tinta: tokens["ink"] } : {}),
        ...(tokens["surface"] !== undefined ? { papel: tokens["surface"] } : {}),
      }));
      return;
    }
    if (ruta === "/__preview/fuentes.css") {
      const hoja = hojaDeFuentes(
        estado.fuentes.map(f => ({ family: f.family, weights: f.weights })),
        raicesModulos,
        abs => `/__preview/fs${abs}`,
      );
      res.setHeader("Content-Type", "text/css; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(
        `/* Tipografías del paquete, autoalojadas por npm (@fontsource). ` +
        `Resueltas: ${hoja.resueltas.join(", ") || "(ninguna)"}. ` +
        `Sin autoalojar: ${hoja.faltantes.join(", ") || "(ninguna)"}. */\n${hoja.css}`,
      );
      return;
    }
    if (ruta.startsWith("/__preview/fs/")) {
      servirArchivo(res, "/", decodeURIComponent(ruta.slice("/__preview/fs/".length)));
      return;
    }
    if (ruta.startsWith("/__preview/asset/")) {
      servirArchivo(res, join(dir, "assets"), decodeURIComponent(ruta.slice("/__preview/asset/".length)));
      return;
    }
    next();
  };

  const server = await createServer({
    configFile: false,
    root: APP_DIR,
    publicDir: false,
    plugins: [
      react(),
      {
        name: "kit-previsualizador",
        configureServer(s: ServidorVite) {
          s.middlewares.use(atender);
        },
      },
    ],
    server: {
      host,
      port: puertoPedido,
      strictPort: false,
      fs: { allow: [FRONTEND_DIR, dir] },
    },
    optimizeDeps: { include: ["react", "react-dom/client"] },
    logLevel: "warn",
    clearScreen: false,
  });

  await server.listen();
  try {
    vigilante = watch(dir, { recursive: true }, (_ev, fichero) => {
      const nombre = String(fichero ?? "");
      const esDelPaquete = (FICHEROS_VIGILADOS as readonly string[]).some(f => nombre.endsWith(f)) ||
        nombre.startsWith("assets");
      if (esDelPaquete) alCambiar();
    });
  } catch {
    // Sin `recursive` (algunos sistemas de ficheros): se vigilan los tres `.json` uno a uno.
    for (const f of FICHEROS_VIGILADOS) {
      if (existsSync(join(dir, f))) watch(join(dir, f), alCambiar);
    }
  }
  const puerto = (server.config.server.port ?? puertoPedido) as number;
  const urlReal = server.resolvedUrls?.local?.[0];
  const url = (urlReal ?? `http://${host}:${puerto}/`).replace(/\/$/, "");
  base = url;
  recomponer();          // ahora sí, con la base definitiva: las URLs de los assets ya son correctas

  const lineas: string[] = [];
  lineas.push(
    `Previsualizador de ${estado.slug ?? "(paquete)"}${estado.version !== undefined ? `@${estado.version}` : ""} ` +
    `en ${url} — Ctrl+C para salir.`,
  );
  if (puerto !== puertoPedido) {
    lineas.push(`  El puerto ${puertoPedido} estaba ocupado; se usa el ${puerto}.`);
  }
  if (!estado.ok) {
    lineas.push("");
    lineas.push("El paquete NO pasa check: el navegador enseña estos errores en vez de una página en blanco.");
    lineas.push("");
    lineas.push(estado.diagnostico);
  } else {
    for (const n of estado.notas) lineas.push(`  ${n}`);
  }

  return {
    url, puerto, ok: estado.ok, salida: lineas.join("\n"),
    estado: () => estado,
    recomponer: () => { const e = recomponer(); avisar(); return e; },
    cerrar: async () => {
      if (pendiente !== undefined) clearTimeout(pendiente);
      vigilante?.close();
      for (const r of oyentes) { try { r.end(); } catch { /* el cliente ya se fue */ } }
      oyentes.clear();
      await server.close();
    },
  };
}
