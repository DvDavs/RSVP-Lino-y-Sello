// packages/template-kit/src/cli.ts — `pnpm plantilla <comando>`.
//
// Sin dependencias de terceros para parsear argumentos: son cinco comandos y un puñado de opciones,
// y una librería más es una superficie más que mantener. Todo lo que imprime sale de los módulos de
// `src/`, que son los que las pruebas ejercitan; aquí sólo hay parseo y despacho.
import { isAbsolute, resolve } from "node:path";
import { check } from "./check.ts";
import { diagnosticar, entornoReal, formatearDoctor } from "./doctor.ts";
import { formatearHallazgos, resumen } from "./formato.ts";
import { SECCIONES_POR_DEFECTO, TIPOS_DE_EVENTO, TIPOS_DE_SECCION, escribirPaquete, sectionCatalog } from "./nueva.ts";
import { registrar } from "./registrar.ts";
import { PUERTO_POR_DEFECTO, preview, type ServidorPreview } from "./preview.ts";
import { ANCHOS_POR_DEFECTO, capturas } from "./capturas.ts";

/** Raíz del repositorio, deducida de la ubicación de este fichero. */
export const RAIZ = resolve(new URL("../../../..", import.meta.url).pathname);
const TEMPLATES = resolve(RAIZ, "frontend/templates");

/**
 * Directorio desde el que el usuario ESCRIBIÓ el comando. `pnpm run` cambia el `cwd` al del paquete,
 * así que sin esto `pnpm plantilla check templates/x/1.0.0` buscaría dentro de
 * `packages/template-kit/`. `INIT_CWD` lo pone pnpm/npm en cada `run` (medido en este entorno con
 * pnpm 10.33.0); fuera de un `run`, `process.cwd()`.
 */
export function resolverDir(ruta: string, entorno: Readonly<Record<string, string | undefined>> = process.env): string {
  if (isAbsolute(ruta)) return ruta;
  return resolve(entorno["INIT_CWD"] ?? process.cwd(), ruta);
}

export interface Opciones {
  readonly posicionales: readonly string[];
  readonly banderas: Readonly<Record<string, string | boolean>>;
}

/** `--clave valor`, `--clave=valor` y `--bandera`. Todo lo demás es posicional. */
export function parsear(argv: readonly string[]): Opciones {
  const posicionales: string[] = [];
  const banderas: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    // `--` a secas es el separador que mete `pnpm run <script> -- <args>`: se ignora.
    if (a === "--") continue;
    if (!a.startsWith("--")) { posicionales.push(a); continue; }
    const igual = a.indexOf("=");
    if (igual > 0) { banderas[a.slice(2, igual)] = a.slice(igual + 1); continue; }
    const clave = a.slice(2);
    const siguiente = argv[i + 1];
    if (siguiente !== undefined && !siguiente.startsWith("--")) { banderas[clave] = siguiente; i++; }
    else banderas[clave] = true;
  }
  return { posicionales, banderas };
}

export const AYUDA = `plantilla — kit de autor de plantillas (fase 4)

  pnpm plantilla nueva <slug> --evento <tipo> [--secciones <lista>] [--destino <dir>] [--version <semver>] [--nombre <texto>]
      Crea frontend/templates/<slug>/<version>/ con template.json, theme.json y defaults.json
      válidos a la primera: bloques derivados del catálogo de secciones, paleta que ya pasa AA.
      --evento     uno de: ${TIPOS_DE_EVENTO.join(", ")}
      --secciones  lista separada por comas (por omisión ${SECCIONES_POR_DEFECTO.join(",")});
                   tipos: ${TIPOS_DE_SECCION.join(", ")}

  pnpm plantilla check <dir> [--no-escribir] [--estricto] [--silencioso]
      Valida el paquete y explica cada fallo con su puntero, el problema y la sugerencia.
      Mide el sha256 y los bytes de cada asset y los ESCRIBE en el manifiesto (P5).
      --no-escribir  no toca el paquete: un digesto desviado pasa a ser ERROR.
      --estricto     los avisos cuentan como errores (integración continua).

  pnpm plantilla registrar <dir> [--raiz <dir>] [--sin-check]
      Ejecuta check y, si pasa, registra el paquete por HTTP con token MASTER
      (POST /master/templates2/versions). Explica 201, 200 noop_same_hash, 409 y los 422.

  pnpm plantilla doctor
      Comprueba el entorno (Node, pnpm, dependencias, backend, token MASTER, Chromium) y dice
      cómo arreglar cada cosa que falte.

  pnpm plantilla secciones [<tipo>]
      Imprime el catálogo de secciones: variantes, huecos, roles y cuáles escribe el andamio.

  pnpm plantilla preview <dir> [--puerto <n>] [--paleta <id>] [--fuentes <id>] [--sin-marcadores]
      Levanta el previsualizador local (Vite + packages/sections) y lo deja escuchando: la
      plantilla, con sus defaults, en móvil y escritorio a la vez, y se repinta al guardar
      cualquiera de los tres .json. Sin backend. Ctrl+C para salir.
      --puerto          puerto de partida (por omisión ${PUERTO_POR_DEFECTO}); si está ocupado usa el siguiente.
      --sin-marcadores  los huecos de imagen sin valor se ven vacíos, como los verá un invitado.

  pnpm plantilla capturas <dir> [--destino <dir>] [--anchos 390,768,1280] [--paleta <id>] [--seccion <clave>]
      Fotografía la plantilla con Chromium en tres anchos y escribe los PNG FUERA del
      directorio de la versión (dentro sería TPL_PACKAGE_UNEXPECTED_FILE). Imprime las rutas.
      --destino  por omisión <slug>/capturas/ junto al paquete.
      --seccion  recorta a una sección del manifiesto en vez de la página entera.
`;

export interface ResultadoCli { readonly codigo: number; readonly salida: string }

/** Lo que devuelve `ejecutarAsync`: `ResultadoCli` más lo que sólo tiene sentido en `preview`. */
export interface ResultadoAsync extends ResultadoCli {
  /** `true` si el comando ha dejado algo escuchando y el proceso NO debe terminar. */
  readonly permanece?: boolean;
  /** El servidor de `preview`, para poder cerrarlo desde una prueba. */
  readonly servidor?: ServidorPreview;
}

export function ejecutar(argv: readonly string[]): ResultadoCli {
  const { posicionales, banderas } = parsear(argv);
  const comando = posicionales[0] ?? "ayuda";
  switch (comando) {
    case "nueva": return cmdNueva(posicionales.slice(1), banderas);
    case "check": return cmdCheck(posicionales.slice(1), banderas);
    case "registrar": return cmdRegistrar(posicionales.slice(1), banderas);
    case "doctor": {
      const informe = formatearDoctor(diagnosticar(entornoReal(RAIZ)));
      return { codigo: informe.includes("FALTA") ? 1 : 0, salida: informe };
    }
    case "secciones": return cmdSecciones(posicionales[1]);
    case "preview": case "capturas":
      // Los dos son asíncronos (levantan un servidor y, `capturas`, un navegador). `ejecutar` es
      // síncrona y lo seguirá siendo: las pruebas de los otros cinco comandos comparan cadenas sin
      // `await`. `ejecutarAsync` es la puerta de entrada real del CLI y despacha estos dos.
      return {
        codigo: 2,
        salida: `\`plantilla ${comando}\` es asíncrono: usa \`ejecutarAsync\` (lo hace el propio CLI).`,
      };
    case "ayuda": case "--help": case "-h": return { codigo: 0, salida: AYUDA };
    default:
      return { codigo: 2, salida: `No conozco el comando "${comando}".\n\n${AYUDA}` };
  }
}

function cmdNueva(pos: readonly string[], banderas: Opciones["banderas"]): ResultadoCli {
  const slug = pos[0];
  if (!slug) return { codigo: 2, salida: `Falta el slug.\n\n${AYUDA}` };
  const evento = String(banderas["evento"] ?? "");
  if (!(TIPOS_DE_EVENTO as readonly string[]).includes(evento)) {
    return {
      codigo: 2,
      salida: `--evento "${evento}" no es un tipo de evento del catálogo cerrado.\n` +
        `  Los ocho tipos son: ${TIPOS_DE_EVENTO.join(", ")}.`,
    };
  }
  const lista = typeof banderas["secciones"] === "string"
    ? banderas["secciones"].split(",").map(s => s.trim()).filter(s => s !== "")
    : [...SECCIONES_POR_DEFECTO];
  const desconocidas = lista.filter(s => !TIPOS_DE_SECCION.includes(s));
  if (desconocidas.length > 0) {
    return {
      codigo: 2,
      salida: `--secciones trae tipos que no existen: ${desconocidas.join(", ")}.\n` +
        `  Los 12 tipos son: ${TIPOS_DE_SECCION.join(", ")}.`,
    };
  }
  const destino = typeof banderas["destino"] === "string" ? resolverDir(banderas["destino"]) : TEMPLATES;
  try {
    const r = escribirPaquete(destino, {
      slug, evento: evento as (typeof TIPOS_DE_EVENTO)[number], secciones: lista,
      ...(typeof banderas["version"] === "string" ? { version: banderas["version"] } : {}),
      ...(typeof banderas["nombre"] === "string" ? { nombre: banderas["nombre"] } : {}),
      ...(typeof banderas["descripcion"] === "string" ? { descripcion: banderas["descripcion"] } : {}),
    });
    const comprobacion = check({ dir: r.dir, escribir: false });
    const lineas = [
      `Creado ${r.dir}`,
      `  ${r.ficheros.join(", ")} · ${r.secciones} sección(es) · ${r.bloques} bloque(s) · ${r.lineas} líneas de manifiesto`,
      comprobacion.ok
        ? "  check: en verde a la primera (0 errores)."
        : `  check: ${resumen(comprobacion.hallazgos)}\n\n${formatearHallazgos(comprobacion.hallazgos)}`,
      "",
      "Siguiente paso: edita los textos de defaults.json y ejecuta",
      `  pnpm plantilla check ${r.dir}`,
    ];
    return { codigo: comprobacion.ok ? 0 : 1, salida: lineas.join("\n") };
  } catch (e) {
    return { codigo: 1, salida: `No he podido generar el andamio: ${(e as Error).message}` };
  }
}

function cmdCheck(pos: readonly string[], banderas: Opciones["banderas"]): ResultadoCli {
  const crudo = pos[0];
  if (!crudo) return { codigo: 2, salida: `Falta el directorio del paquete.\n\n${AYUDA}` };
  const dir = resolverDir(crudo);
  const r = check({
    dir,
    escribir: banderas["no-escribir"] !== true,
    estricto: banderas["estricto"] === true,
  });
  if (banderas["silencioso"] === true) {
    return { codigo: r.ok ? 0 : 1, salida: resumen(r.hallazgos) };
  }
  const partes: string[] = [`plantilla check ${dir}`];
  if (r.hallazgos.length > 0) partes.push("", formatearHallazgos(r.hallazgos));
  if (r.escrituras.length > 0) partes.push("", `Reescrito: ${r.escrituras.join(", ")} (digestos medidos, P5).`);
  if (r.packageHash) partes.push("", `package_hash = ${r.packageHash}`);
  partes.push("", resumen(r.hallazgos));
  return { codigo: r.ok ? 0 : 1, salida: partes.join("\n") };
}

function cmdRegistrar(pos: readonly string[], banderas: Opciones["banderas"]): ResultadoCli {
  const crudo = pos[0];
  if (!crudo) return { codigo: 2, salida: `Falta el directorio del paquete.\n\n${AYUDA}` };
  const dir = resolverDir(crudo);
  const r = registrar({
    dir,
    ...(typeof banderas["raiz"] === "string" ? { raiz: banderas["raiz"] } : {}),
    ...(banderas["sin-check"] === true ? { sinCheck: true } : {}),
  });
  return { codigo: r.ok ? 0 : 1, salida: r.texto };
}

function cmdSecciones(tipo?: string): ResultadoCli {
  const lineas: string[] = [];
  const tipos = tipo ? [tipo] : Object.keys(sectionCatalog);
  for (const t of tipos) {
    const ficha = (sectionCatalog as Record<string, (typeof sectionCatalog)[keyof typeof sectionCatalog] | undefined>)[t];
    if (!ficha) {
      return { codigo: 2, salida: `"${t}" no es un tipo de sección. Los 12 son: ${TIPOS_DE_SECCION.join(", ")}.` };
    }
    lineas.push(`${ficha.type} — ${ficha.name} (cardinalidad ${ficha.cardinality})`);
    lineas.push(`  ${ficha.purpose}`);
    lineas.push(`  variantes: ${ficha.variants.map(v => `${v.id} (${v.label})`).join(", ")} · por defecto ${ficha.defaultVariant}`);
    for (const s of ficha.slots) {
      const marcas = [
        s.scaffold ? "andamio" : "opcional",
        s.required ? "obligatorio" : "",
        s.singletonRole ? "singleton" : "",
      ].filter(x => x !== "").join(", ");
      lineas.push(`  · ${s.blockId} — ${s.type} · rol ${s.role} [${marcas}]`);
      for (const i of s.itemBlocks ?? []) {
        lineas.push(`      · ${i.blockId} — ${i.type} · rol ${i.role}${i.scaffold ? " [andamio]" : ""}`);
      }
    }
    lineas.push("");
  }
  return { codigo: 0, salida: lineas.join("\n").trimEnd() };
}

/**
 * Igual que `ejecutar`, más los dos comandos que necesitan `await`: `preview` (levanta un servidor y
 * NO devuelve hasta que lo matan) y `capturas` (levanta el mismo servidor y un Chromium).
 *
 * `preview` es el único comando que no termina: imprime su línea y se queda escuchando. Para que el
 * proceso siga vivo se devuelve `permanece: true` y el punto de entrada no hace nada más; se
 * devuelve además el `servidor` para que las pruebas puedan apagarlo (el CLI no lo usa).
 */
export async function ejecutarAsync(argv: readonly string[]): Promise<ResultadoAsync> {
  const { posicionales, banderas } = parsear(argv);
  const comando = posicionales[0] ?? "ayuda";
  if (comando === "preview") return cmdPreview(posicionales.slice(1), banderas);
  if (comando === "capturas") return cmdCapturas(posicionales.slice(1), banderas);
  return ejecutar(argv);
}

function entero(v: string | boolean | undefined): number | undefined {
  if (typeof v !== "string") return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

async function cmdPreview(pos: readonly string[], banderas: Opciones["banderas"]): Promise<ResultadoAsync> {
  const crudo = pos[0];
  if (!crudo) return { codigo: 2, salida: `Falta el directorio del paquete.\n\n${AYUDA}` };
  try {
    const s = await preview({
      dir: resolverDir(crudo),
      ...(entero(banderas["puerto"]) !== undefined ? { puerto: entero(banderas["puerto"])! } : {}),
      ...(typeof banderas["paleta"] === "string" ? { paleta: banderas["paleta"] } : {}),
      ...(typeof banderas["fuentes"] === "string" ? { fuentes: banderas["fuentes"] } : {}),
      ...(banderas["sin-marcadores"] === true ? { marcadores: false } : {}),
    });
    // Código 0 aunque el paquete esté en rojo: el SERVIDOR ha arrancado y enseña los errores, que es
    // lo que se le ha pedido. El rojo del paquete lo reporta `check`, que es quien tiene ese trabajo.
    return { codigo: 0, salida: s.salida, permanece: true, servidor: s };
  } catch (e) {
    return { codigo: 1, salida: `No he podido levantar el previsualizador: ${(e as Error).message}` };
  }
}

async function cmdCapturas(pos: readonly string[], banderas: Opciones["banderas"]): Promise<ResultadoCli> {
  const crudo = pos[0];
  if (!crudo) return { codigo: 2, salida: `Falta el directorio del paquete.\n\n${AYUDA}` };
  const anchos = typeof banderas["anchos"] === "string"
    ? banderas["anchos"].split(",").map(x => Number.parseInt(x.trim(), 10)).filter(n => Number.isFinite(n) && n > 0)
    : [...ANCHOS_POR_DEFECTO.map(a => a.ancho)];
  try {
    const r = await capturas({
      dir: resolverDir(crudo),
      ...(typeof banderas["destino"] === "string" ? { destino: resolverDir(banderas["destino"]) } : {}),
      ...(anchos.length > 0 ? { anchos } : {}),
      ...(typeof banderas["paleta"] === "string" ? { paleta: banderas["paleta"] } : {}),
      ...(typeof banderas["fuentes"] === "string" ? { fuentes: banderas["fuentes"] } : {}),
      ...(typeof banderas["seccion"] === "string" ? { seccion: banderas["seccion"] } : {}),
    });
    return { codigo: r.ok ? 0 : 1, salida: r.salida };
  } catch (e) {
    return { codigo: 1, salida: `No he podido capturar la plantilla: ${(e as Error).message}` };
  }
}

// Punto de entrada real. `import.meta.url` sólo coincide con `argv[1]` cuando se ejecuta el fichero.
const esEntrada = process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href;
if (esEntrada) {
  const r = await ejecutarAsync(process.argv.slice(2));
  process.stdout.write(r.salida + "\n");
  process.exitCode = r.codigo;
  // `preview` deja el servidor escuchando: el proceso sigue vivo hasta Ctrl+C, sin bucle de espera.
}
