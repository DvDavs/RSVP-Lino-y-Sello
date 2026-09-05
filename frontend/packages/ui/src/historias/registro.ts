// packages/ui/src/historias/registro.ts — ÚNICO punto donde se enumeran las historias. Cada familia
// del bloque 2 añade UNA línea por componente (orden alfabético por slug) y su import arriba; el
// orquestador resuelve el merge conservando todas las líneas.
import type { Historia } from "./tipos.ts";

export const registro: readonly Historia[] = [
  // F1 formularios · F2 superficies y navegación · F3 estados e imagen
];

export function historiaPorSlug(slug: string): Historia | undefined {
  return registro.find((h) => h.slug === slug);
}
