// @invitaciones/ui — esqueleto creado por el orquestador de la fase 3-C. Lo llena el bloque 1.
export const PAQUETE = "@invitaciones/ui" as const;

// Biblioteca de formas (3C-4). Ver `src/shapes/index.ts`.
export * from "./shapes/index.ts";
// Fuentes autoalojadas (3C-2, `11 §2.1-2.4`): manifiesto y rutas de precarga de la display. El CSS
// (`@font-face`, utilidades tipográficas) se consume aparte, vía `@invitaciones/ui/estilos.css`.
export * from "./fonts/preload.ts";
export * from "./ilustraciones/index.ts";

// Galería de historias (bloque 2): tipos y registro.
export * from "./historias/tipos.ts";
export { registro, historiaPorSlug } from "./historias/registro.ts";

// Componentes (bloque 2, familia de formularios — F1). Ver `componentes/index.ts`.
export * from "./componentes/index.ts";
