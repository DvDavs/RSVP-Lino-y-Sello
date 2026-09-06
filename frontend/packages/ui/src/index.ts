// @invitaciones/ui — esqueleto creado por el orquestador de la fase 3-C. Lo llena el bloque 1.
export const PAQUETE = "@invitaciones/ui" as const;

// Biblioteca de formas (3C-4). Ver `src/shapes/index.ts`.
export * from "./shapes/index.ts";
// Fuentes autoalojadas (3C-2, `11 §2.1-2.4`): manifiesto y rutas de precarga de la display. El CSS
// (`@font-face`, utilidades tipográficas) se consume aparte, vía `@invitaciones/ui/estilos.css`.
export * from "./fonts/preload.ts";
export * from "./ilustraciones/index.ts";


// Componentes (bloque 2, familia de formularios — F1). Ver `componentes/index.ts`.
// Componentes (bloque 2): formularios (F1) + superficies y navegación (F2). Ver `componentes/index.ts`.
export * from "./componentes/index.ts";

// Las historias de la galería NO se reexportan desde aquí: los `*.historias.tsx` de los componentes
// cliente son módulos "use client" y, evaluados desde un Server Component (el layout importa este
// barril), llegan como referencias cliente sin `slug`. Se consumen desde `@invitaciones/ui/historias`
// y solo en componentes cliente (medido: rompía `next build` al recopilar /editor).
