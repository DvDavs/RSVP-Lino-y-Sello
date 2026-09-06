// src/hash.ts — `package_hash` con el algoritmo LITERAL de `01 §2.1`.
//
//   package_hash = "sha256:" + hex( SHA-256( LF.join( lineas ) ) )
//   lineas       = [ `${ruta}\t${sha256hex(bytes_del_archivo)}` por cada archivo del paquete ]
//                  ordenadas por `ruta` con comparación byte a byte de su UTF-8 (no por locale)
//
// · `ruta` relativa a `templates/<slug>/<version>/`, con `/` como separador.
// · Para los tres `.json` obligatorios y los planes de migración, `bytes_del_archivo` NO es el archivo
//   en disco: es `canonicalJson(JSON.parse(archivo))` en UTF-8, para que un reformateo no cambie el
//   paquete. Para los assets son los bytes literales.
// · `LF` es `"\n"`. NO hay `\n` final.
//
// `canonicalJson` se IMPORTA de `@invitaciones/schema` (no se reimplementa): dos definiciones del
// mismo canónico es exactamente la enfermedad que P1 ataca.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { canonicalJson } from "@invitaciones/schema";

export const sha256Hex = (b: Buffer | string): string =>
  crypto.createHash("sha256").update(b).digest("hex");

/** Los archivos cuyo contenido se canonicaliza antes de hashear. */
function seCanonicaliza(rutaRelativa: string): boolean {
  return rutaRelativa === "template.json" || rutaRelativa === "theme.json" ||
    rutaRelativa === "defaults.json" || rutaRelativa.startsWith("migrations/");
}

/** Lista recursiva de rutas relativas, con `/` como separador. */
export function archivosDelPaquete(dirVersion: string): string[] {
  const out: string[] = [];
  const rec = (dir: string, prefijo: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefijo === "" ? e.name : `${prefijo}/${e.name}`;
      if (e.isDirectory()) rec(path.join(dir, e.name), rel);
      else out.push(rel);
    }
  };
  rec(dirVersion, "");
  return out;
}

/** Comparación byte a byte de la codificación UTF-8 de dos rutas (no por locale). */
export function compararRutasUtf8(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

export function packageHash(dirVersion: string): string {
  const lineas = archivosDelPaquete(dirVersion)
    .sort(compararRutasUtf8)
    .map((rel) => {
      const bruto = fs.readFileSync(path.join(dirVersion, rel));
      const bytes = seCanonicaliza(rel)
        ? Buffer.from(canonicalJson(JSON.parse(bruto.toString("utf8"))), "utf8")
        : bruto;
      return `${rel}\t${sha256Hex(bytes)}`;
    });
  return "sha256:" + sha256Hex(Buffer.from(lineas.join("\n"), "utf8"));
}

/**
 * ULID DETERMINISTA para los `itemId` de grupo.
 *
 * `ADR-002`/`ADR-1R-C-02` exigen que el `itemId` sea NUEVO —jamás el `id` legado (`f1`, `event-1`,
 * duplicados hasta 103 veces por fichero)— y que se genere en el orden del array legado. Pero
 * `package_hash` tiene que ser reproducible byte a byte entre dos ejecuciones (es la clave de
 * idempotencia del registro, ADR-008), y un ULID aleatorio lo rompería: dos corridas producirían dos
 * paquetes distintos y el segundo registro sería una versión nueva en vez de un `noop_same_hash`.
 *
 * Se deriva por tanto de `sha256(slug|version|blockIdDelGrupo|indice)` y se codifica en el alfabeto de
 * Crockford del `ULID_PATTERN` de `common.ts`. Sigue siendo un id opaco y nuevo, sigue respetando el
 * orden del array legado, y además dos corridas dan el mismo paquete.
 */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export function ulidDeterminista(semilla: string): string {
  let bits = "";
  let n = 0;
  while (bits.length < 130) { bits += BigInt("0x" + sha256Hex(`${semilla}#${n++}`)).toString(2).padStart(256, "0"); }
  let out = "";
  for (let i = 0; i < 26; i++) out += CROCKFORD[Number.parseInt(bits.slice(i * 5, i * 5 + 5), 2)];
  return out;
}
