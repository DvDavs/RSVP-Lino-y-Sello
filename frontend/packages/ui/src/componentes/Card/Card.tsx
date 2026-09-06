// packages/ui/src/componentes/Card/Card.tsx — tarjeta del sistema (`11 §5` fila «Card»): plana,
// elevada, sombra de color (envuelta en `ColorShadow` de `shapes`, ADR-3C-0-03) y tinta.
//
// Reglas que este componente hace cumplir:
//  - "sin hover de elevación en rejillas": ninguna variante añade `translateY`/sombra en `:hover`
//    (11 §6.2 regla 3, la rejilla no salta). Un enlace dentro de la tarjeta cambia solo el color del
//    título; eso lo decide quien use la tarjeta (el título es contenido, no prop de este componente).
//  - la variante `color` es la ÚNICA sombra de color por vista (11 §3.4 regla 8): el consumidor la
//    usa como mucho una vez por pantalla, este componente no lo puede forzar por sí mismo.
import type { ElementType, JSX, ReactNode } from "react";
import { twMerge } from "tailwind-merge";
import { ColorShadow } from "../../shapes/ColorShadow.tsx";
import type { Tono } from "../../shapes/base.ts";

export type VarianteCard = "plana" | "elevada" | "color" | "tinta";
/** Tonos de apoyo verificados para `tinta`/`color` (nunca el matiz principal: `11 §3.4` regla 2). */
export type TonoCard = "support-1" | "support-2" | "accent";

const BASE = "block rounded-ui-card p-6 text-ui-text-sm";

const VARIANTE: Record<Exclude<VarianteCard, "tinta">, string> = {
  plana: "bg-ui-surface-raised shadow-[inset_0_0_0_1.5px_var(--ui-divider)]",
  elevada: "bg-ui-surface-raised shadow-ui-2",
  color: "bg-ui-surface-raised",
};

const TINTA: Record<TonoCard, string> = {
  "support-1": "bg-ui-support-1-soft text-ui-support-1-deep",
  "support-2": "bg-ui-support-2-soft text-ui-support-2-deep",
  accent: "bg-ui-accent-soft text-ui-on-accent-soft",
};

export interface CardProps {
  readonly variant?: VarianteCard;
  /** Tono de apoyo para `tinta` (fondo/texto) y `color` (desplazamiento de `ColorShadow`). */
  readonly tone?: TonoCard;
  readonly as?: ElementType;
  readonly className?: string;
  readonly children: ReactNode;
}

export function Card({ variant = "plana", tone = "support-2", as: Elemento = "article", className, children }: CardProps): JSX.Element {
  if (variant === "color") {
    return (
      <ColorShadow tone={tone as Tono} radius="md" border className={className}>
        <Elemento className={BASE}>{children}</Elemento>
      </ColorShadow>
    );
  }
  const clase =
    variant === "tinta"
      ? twMerge(BASE, TINTA[tone], className)
      : twMerge(BASE, VARIANTE[variant], className);
  return <Elemento className={clase}>{children}</Elemento>;
}
