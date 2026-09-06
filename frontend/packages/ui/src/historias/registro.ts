// packages/ui/src/historias/registro.ts — ÚNICO punto donde se enumeran las historias. Cada familia
// del bloque 2 añade UNA línea por componente (orden alfabético por slug) y su import arriba; el
// orquestador resuelve el merge conservando todas las líneas.
//
// SOLO desde componentes de CLIENTE (contrato de integración F1+F2, medido al fusionar F1+F2 en
// `4ea8d00`): algunos ficheros `*.historias.tsx` son `"use client"` (Dialog, Tabs, Toast…), así que
// si un Server Component evalúa `registro` esas historias llegan como referencias cliente sin
// `slug`/`nombre` y `next build` rompe (`Cannot read properties of undefined (reading
// 'localeCompare')`). Por eso este módulo se publica bajo el subpath `@invitaciones/ui/historias`
// (nunca desde la raíz del paquete) y un Server Component que solo necesite slug/nombre/familia/
// descripción usa `metadatos.ts` en su lugar — ver ese fichero y `metadatos.test.ts`.
import type { Historia } from "./tipos.ts";
import { historias as historiasEmptyState } from "../componentes/EmptyState.historias.tsx";
import { historias as historiasImage } from "../componentes/Image.historias.tsx";
import { historias as historiasSkeleton } from "../componentes/Skeleton.historias.tsx";

export const registro: readonly Historia[] = [
  // F1 formularios · F2 superficies y navegación · F3 estados e imagen
  ...historiasEmptyState,
  ...historiasImage,
  ...historiasSkeleton,
];

export function historiaPorSlug(slug: string): Historia | undefined {
  return registro.find((h) => h.slug === slug);
}
