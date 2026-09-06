// components/ui/button.tsx — shadcn/ui copiado al repo (04 §2, §18), sobre la capa de tokens medida
// en `docs/rediseno-plantillas/diseno/arte-chrome.md` §6 ("Botones y controles"): primario sólido en
// píldora, texto 14/21 peso 600, alto 41-49. Estado ocupado con `aria-busy` (nunca solo un spinner,
// 04 §18). Único componente base necesario para el andamiaje de 3-1; el resto del catálogo (Switch,
// Dialog, Tabs…) lo añaden los bloques 3-4/3-5.
"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { twMerge } from "tailwind-merge";

/**
 * Se exporta (bloque 3-8) para poder vestir un `<Link>` con la MISMA apariencia sin convertirlo en
 * `<button>`: un destino que navega debe ser un enlace de verdad — se abre en pestaña nueva, se
 * copia, y los lectores de pantalla lo anuncian como enlace. No se añade `asChild`/Slot: sería una
 * dependencia nueva para un caso que una clase resuelve.
 */
export const estilosBoton = cva(
  "inline-flex items-center justify-center gap-2 rounded-ui-pill text-ui-aux font-semibold transition-colors duration-[var(--ui-duration)] ease-[var(--ui-ease)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // arte-chrome.md §6: primario sólido #4e027c / blanco, hover → --color-ui-primary-hover
        primary: "bg-ui-primary text-ui-on-primary hover:bg-ui-primary-hover",
        // Contorneado: transparente + aro 1px del color de hover del acento
        secondary: "bg-transparent text-ui-primary shadow-[inset_0_0_0_1px_var(--color-ui-primary-hover)] hover:bg-ui-primary-soft",
        // Fantasma/enlace: transparente, hover al link corregido para AA
        ghost: "bg-transparent text-ui-primary hover:text-ui-link",
      },
      size: {
        md: "h-11 px-4", // 44px, dentro del rango 41-49 medido; ≥ 24px de objetivo táctil (2.5.8)
        sm: "h-10 px-3.5",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof estilosBoton> {
  busy?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, busy, disabled, children, ...resto },
  ref,
) {
  return (
    <button
      ref={ref}
      className={twMerge(estilosBoton({ variant, size }), className)}
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      {...resto}
    >
      {children}
    </button>
  );
});
