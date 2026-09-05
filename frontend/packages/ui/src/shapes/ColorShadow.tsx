// packages/ui/src/shapes/ColorShadow.tsx — sombra de color desplazada (`11 §3.1`).
//
// Envoltorio, no tarjeta: recibe el contenido y le pone la sombra sólida de color más el borde de
// tinta de 2 px del moodboard. `11 §3.4` regla 8: UNA por vista, y nunca mezclada con la sombra
// difusa (`--ui-shadow-1/2`) en el mismo elemento — por eso este componente no acepta `shadow`.
import type { ElementType, JSX, ReactNode } from "react";
import { clases, color, type Tono } from "./base.ts";

export interface ColorShadowProps {
  /** Color de la sombra. Un apoyo o el acento; nunca el mismo matiz que el fondo del bloque. */
  readonly tone?: Tono;
  /** Desplazamiento en px. `11 §3.1`: 8/8; el moodboard usa 6/6 en piezas pequeñas. */
  readonly offset?: { readonly x: number; readonly y: number };
  /** Radio del contenedor. Token del sistema. */
  readonly radius?: "sm" | "md" | "lg" | "xl";
  /** Borde de tinta de 2 px (el del moodboard). Se puede quitar en superficies muy claras. */
  readonly border?: boolean;
  readonly className?: string;
  /** Elemento a renderizar. Por defecto `div`; una tarjeta clicable usará el suyo. */
  readonly as?: ElementType;
  readonly children: ReactNode;
}

export function ColorShadow({
  tone = "support-2",
  offset = { x: 8, y: 8 },
  radius = "lg",
  border = true,
  className,
  as: Elemento = "div",
  children,
}: ColorShadowProps): JSX.Element {
  return (
    <Elemento
      className={clases("ui-sombra-color", className)}
      data-tono={tone}
      style={{
        boxShadow: `${offset.x}px ${offset.y}px 0 0 ${color(tone)}`,
        border: border ? "2px solid var(--ui-ink)" : undefined,
        borderRadius: `var(--ui-radius-${radius})`,
      }}
    >
      {children}
    </Elemento>
  );
}
