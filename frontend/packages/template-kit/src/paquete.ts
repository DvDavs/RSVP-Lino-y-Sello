// packages/template-kit/src/paquete.ts — el paquete en disco: árbol exacto, digestos y `package_hash`.
//
// Todo lo de aquí sale de `diseno/01-dominio-y-esquema.md §2.1` (disposición en disco y algoritmo
// literal del `package_hash`) y de `§5.5` (`canonicalJson`). La función `canonicalJson` NO se
// reimplementa: se importa de `@invitaciones/schema` (`src/compose.ts:228`), que es la que usan la
// composición y el espejo Kotlin. Del hash sólo es nuestro el orden de las líneas, y se comprueba
// contra los tres valores publicados en `memoria/handoffs/4-0a.md §4`, calculados por
// `frontend/templates/scripts/build-packages.mjs` y confirmados byte a byte por el backend.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { canonicalJson } from "@invitaciones/schema";

/** Los tres `.json` obligatorios del paquete, en el orden en que se leen (01 §2.1). */
export const FICHEROS_OBLIGATORIOS = ["template.json", "theme.json", "defaults.json"] as const;
/** Lo único que puede haber en la raíz del paquete además de los tres `.json`. */
export const DIRECTORIOS_PERMITIDOS = ["assets", "migrations"] as const;
/** `AssetEntry.path` (`packages/schema/src/manifest.ts:57`): sin subdirectorios y sin `..`. */
export const PATRON_ASSET = /^assets\/[a-z0-9][a-z0-9._-]{0,99}$/;

/** Extensión → `AssetEntry.contentType` (enum cerrado, `manifest.ts:59`). */
export const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".woff2": "font/woff2",
};

export function sha256(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

/** Un archivo del paquete tal y como entra en el `package_hash`. */
export interface ArchivoDelPaquete {
  /** Ruta relativa a `templates/<slug>/<version>/`, con `/` (nunca `\`). */
  readonly ruta: string;
  /** Los `.json` entran CANONICALIZADOS; los assets, por sus bytes literales (01 §2.1). */
  readonly json?: unknown;
  readonly bytes?: Buffer;
}

/**
 * `package_hash` **exactamente** como `01 §2.1`: una línea `"<ruta>\t<sha256hex>"` por archivo,
 * ordenadas por la codificación UTF-8 de la ruta (byte a byte, nunca por locale), unidas con `\n`
 * y sin `\n` final. Misma fórmula que `build-packages.mjs:packageHash` y que `PackageHasher.kt`.
 */
export function packageHash(archivos: readonly ArchivoDelPaquete[]): string {
  const orden = (a: ArchivoDelPaquete, b: ArchivoDelPaquete): number =>
    Buffer.compare(Buffer.from(a.ruta, "utf8"), Buffer.from(b.ruta, "utf8"));
  const lineas = [...archivos].sort(orden).map(f => {
    const contenido = f.json !== undefined
      ? Buffer.from(canonicalJson(f.json), "utf8")
      : (f.bytes ?? Buffer.alloc(0));
    return `${f.ruta}\t${sha256(contenido)}`;
  });
  return "sha256:" + sha256(Buffer.from(lineas.join("\n"), "utf8"));
}

/** Una entrada del árbol del paquete, ya clasificada. */
export interface EntradaDelArbol {
  /** Ruta relativa al directorio del paquete, con `/`. */
  readonly ruta: string;
  readonly esDirectorio: boolean;
}

/** Recorre el directorio del paquete entero, en orden estable, sin seguir enlaces simbólicos. */
export function recorrer(dir: string, prefijo = ""): readonly EntradaDelArbol[] {
  const salida: EntradaDelArbol[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const ruta = prefijo === "" ? e.name : `${prefijo}/${e.name}`;
    if (e.isDirectory()) {
      salida.push({ ruta, esDirectorio: true });
      salida.push(...recorrer(join(dir, e.name), ruta));
    } else {
      salida.push({ ruta, esDirectorio: false });
    }
  }
  return salida;
}

export interface JsonLeido {
  readonly ok: boolean;
  readonly valor?: unknown;
  /** Mensaje del `JSON.parse` cuando `ok` es falso, o el motivo del rechazo (BOM). */
  readonly error?: string;
  /** Texto crudo tal y como está en disco. */
  readonly texto: string;
}

/** Lee un `.json` del paquete: UTF-8 **sin BOM** y sintácticamente válido (01 §2.1). */
export function leerJson(ruta: string): JsonLeido {
  const texto = readFileSync(ruta, "utf8");
  if (texto.charCodeAt(0) === 0xfeff) {
    return { ok: false, error: "el archivo empieza por una marca de orden de bytes (BOM)", texto };
  }
  try {
    return { ok: true, valor: JSON.parse(texto), texto };
  } catch (e) {
    return { ok: false, error: (e as Error).message, texto };
  }
}

/** Medida real de un archivo de `assets/`: lo que el manifiesto debe declarar (P5). */
export interface MedidaDeAsset {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
  /** `undefined` si la extensión no está en el enum cerrado de `AssetEntry.contentType`. */
  readonly contentType?: string;
}

/** Mide TODOS los archivos de `assets/`, en orden alfabético. Nunca se teclea un digesto (P5). */
export function medirAssets(dirPaquete: string): readonly MedidaDeAsset[] {
  const dir = join(dirPaquete, "assets");
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  const salida: MedidaDeAsset[] = [];
  for (const nombre of readdirSync(dir).sort()) {
    const completo = join(dir, nombre);
    if (!statSync(completo).isFile()) continue;
    const bytes = readFileSync(completo);
    const punto = nombre.lastIndexOf(".");
    const ext = punto >= 0 ? nombre.slice(punto).toLowerCase() : "";
    const medida: MedidaDeAsset = {
      path: `assets/${nombre}`, sha256: sha256(bytes), bytes: bytes.length,
      ...(CONTENT_TYPES[ext] ? { contentType: CONTENT_TYPES[ext] } : {}),
    };
    salida.push(medida);
  }
  return salida;
}

/** Serialización de un `.json` del paquete: dos espacios y salto final, como el resto del árbol. */
export function serializar(valor: unknown): string {
  return JSON.stringify(valor, null, 2) + "\n";
}
