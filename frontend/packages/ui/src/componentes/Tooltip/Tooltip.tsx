// packages/ui/src/componentes/Tooltip/Tooltip.tsx — información complementaria al pasar el
// puntero o al enfocar con teclado (`11 §5` fila «Tooltip»). Base Radix (`@radix-ui/react-tooltip`):
// visible con foco (sin retardo) y con ratón (retardo de `delayDuration`), `role="tooltip"` con
// `aria-describedby` en el disparador. NUNCA es el único portador de una información: el contenido
// debe existir en otro sitio, porque en táctil el tooltip no aparece (11 §5).
"use client";

import type { JSX, ReactElement, ReactNode } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { twMerge } from "tailwind-merge";

export interface TooltipProps {
  /** Texto del tooltip. Corto: 13/500 en una o dos líneas (`11 §5`). */
  readonly content: ReactNode;
  /** Disparador: un único elemento enfocable (botón, enlace). Recibe `asChild`. */
  readonly children: ReactElement;
  readonly side?: "top" | "right" | "bottom" | "left";
  readonly align?: "start" | "center" | "end";
  /** Retardo en ms SOLO para el ratón; el foco de teclado no espera (accesibilidad). */
  readonly delayDuration?: number;
  readonly className?: string;
}

export function Tooltip({ content, children, side = "top", align = "center", delayDuration = 400, className }: TooltipProps): JSX.Element {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            align={align}
            sideOffset={8}
            className={twMerge(
              "z-50 max-w-[240px] rounded-[10px] bg-ui-ink px-3 py-2 text-sm font-medium text-ui-surface shadow-ui-2",
              className,
            )}
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-ui-ink" width={10} height={5} />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
