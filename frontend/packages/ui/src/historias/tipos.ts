// packages/ui/src/historias/tipos.ts — contrato de las "historias" de la galería /design/componentes
// (fase 3-C, bloque 2). Cada componente exporta `historias` desde su `<Nombre>.historias.tsx` y la
// registra en `registro.ts`; la galería (`apps/web/app/(chrome)/design/componentes/[slug]`) las
// renderiza todas, en claro y oscuro, a 390 y 1440, y la regresión visual las captura.
import type { ReactNode } from "react";

export type FamiliaHistoria = "formularios" | "superficies" | "navegacion" | "estados" | "imagen";

export interface Variante {
  /** Nombre visible de la variante o del estado ("Primario", "Deshabilitado", "Error"). */
  readonly nombre: string;
  /** Qué se pinta. Sin efectos: la galería puede llamarlo muchas veces. */
  readonly render: () => ReactNode;
  /** Nota breve para la galería (cuándo se usa, qué comprobar). */
  readonly nota?: string;
}

export interface Historia {
  /** Segmento de ruta en `/design/componentes/<slug>` (kebab-case, único). */
  readonly slug: string;
  readonly nombre: string;
  readonly familia: FamiliaHistoria;
  readonly descripcion: string;
  /** Variantes de aspecto (tamaños, jerarquías, con icono...). */
  readonly variantes: readonly Variante[];
  /** Estados (reposo, hover simulado, foco, activo, deshabilitado, error, cargando...). */
  readonly estados?: readonly Variante[];
}
