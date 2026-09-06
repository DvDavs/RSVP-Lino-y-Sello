// @invitaciones/ui — esqueleto creado por el orquestador de la fase 3-C. Lo llena el bloque 1.
export const PAQUETE = "@invitaciones/ui" as const;

// Biblioteca de formas (3C-4). Ver `src/shapes/index.ts`.
export * from "./shapes/index.ts";
// Fuentes autoalojadas (3C-2, `11 §2.1-2.4`): manifiesto y rutas de precarga de la display. El CSS
// (`@font-face`, utilidades tipográficas) se consume aparte, vía `@invitaciones/ui/estilos.css`.
export * from "./fonts/preload.ts";
export * from "./ilustraciones/index.ts";

// Componentes (bloque 2). `EmptyState` y `Skeleton` no chocan con nada; `Image` sí: `./shapes`
// exporta una `Image` (la forma decorativa, sin estados, server-safe) y `./componentes` exporta OTRA
// `Image` (el componente de producto, `"use client"`, con cargando/cargada/rota — ver el comentario
// de `componentes/Image.tsx`). Dos `export *` con el mismo nombre son ambiguos (TS2308); el re-export
// EXPLÍCITO de abajo gana sobre ambos wildcards (la resolución de módulos ES mira primero las
// entradas explícitas del propio fichero) y deja un único `Image` público: el que tiene estados.
// Quien necesite la forma pelada la importa de `@invitaciones/ui/shapes`.
export * from "./componentes/index.ts";
export { Image, type ImageProps } from "./componentes/Image.tsx";

// Galería de historias (bloque 2): SOLO los metadatos (slug/nombre/familia/descripcion), seguros
// para Server Components. `registro` (con los `render()` reales, y con cualquier historia
// `"use client"` que registre otro bloque) vive en el subpath `@invitaciones/ui/historias` y SOLO
// lo importa código de cliente — ver el porqué en `historias/registro.ts`.
export type { FamiliaHistoria } from "./historias/tipos.ts";
export { metadatos, type MetadatoHistoria } from "./historias/metadatos.ts";
