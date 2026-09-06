// @invitaciones/ui — barril público del sistema de diseño del producto (fase 3-C).
export const PAQUETE = "@invitaciones/ui" as const;

// Biblioteca de formas (3C-4). Ver `src/shapes/index.ts`.
export * from "./shapes/index.ts";
// Fuentes autoalojadas (3C-2, `11 §2.1-2.4`): manifiesto y rutas de precarga de la display. El CSS
// (`@font-face`, utilidades tipográficas) se consume aparte, vía `@invitaciones/ui/estilos.css`.
export * from "./fonts/preload.ts";
export * from "./ilustraciones/index.ts";

// Componentes (bloque 2): formularios (F1), superficies y navegación (F2), estados e imagen (F3).
// Ver `componentes/index.ts`. `Image` existe dos veces —la forma decorativa de `./shapes` (server-safe,
// sin estados) y el componente de producto de `./componentes` ("use client", con cargando/cargada/rota)—
// y dos `export *` con el mismo nombre son ambiguos (TS2308): el re-export EXPLÍCITO de abajo gana y
// deja un único `Image` público, el que tiene estados. La forma pelada se importa de
// `@invitaciones/ui/shapes`.
export * from "./componentes/index.ts";
export { Image, type ImageProps } from "./componentes/Image.tsx";

// Galería de historias (bloque 2): desde aquí SOLO los metadatos (slug/nombre/familia/descripcion),
// seguros para Server Components. `registro` (con los `render()` reales) vive en el subpath
// `@invitaciones/ui/historias` y SOLO lo importa código de cliente: los `*.historias.tsx` de los
// componentes cliente son módulos "use client" y, evaluados desde un Server Component (el layout
// importa este barril), llegaban como referencias cliente sin `slug` y rompían `next build`.
export type { FamiliaHistoria } from "./historias/tipos.ts";
export { metadatos, type MetadatoHistoria } from "./historias/metadatos.ts";
