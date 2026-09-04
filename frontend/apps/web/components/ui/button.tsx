// components/ui/button.tsx — shadcn/ui copiado al repo (04 §2, §18), sobre la capa de tokens medida
// en `docs/rediseno-plantillas/diseno/arte-chrome.md` §6 ("Botones y controles"): primario sólido en
// píldora, texto 14/21 peso 600, alto 41-49. Estado ocupado con `aria-busy` (nunca solo un spinner,
// 04 §18). Único componente base necesario para el andamiaje de 3-1; el resto del catálogo (Switch,
// Dialog, Tabs…) lo añaden los bloques 3-4/3-5.
"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { twMerge } from "tailwind-merge";

const estilosBoton = cva(
  "inline-flex items-center justify-center gap-2 rounded-ui-pill text-ui-aux font-semibold transition-colors duration-[var(--ui-duration)] ease-[var(--ui-ease)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // arte-chrome.md §6: primario sólido #4e027c / blanco, hover → --color-ui-accent-hover
        primary: "bg-ui-accent text-ui-accent-ink hover:bg-ui-accent-hover",
        // Contorneado: transparente + aro 1px del color de hover del acento
        secondary: "bg-transparent text-ui-accent shadow-[inset_0_0_0_1px_var(--color-ui-accent-hover)] hover:bg-ui-accent-soft",
        // Fantasma/enlace: transparente, hover al link corregido para AA
        ghost: "bg-transparent text-ui-accent hover:text-ui-accent-link",
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
