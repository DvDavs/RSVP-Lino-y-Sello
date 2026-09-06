// packages/ui/src/componentes/Button/Button.tsx — botón del sistema de diseño del producto
// (`11 §5`, fila Button). Píldora, seis variantes, tres tamaños (36/44/52), `loading` con
// `aria-busy` y texto visible, `asChild` para que un enlace se vea como botón (Radix Slot).
//
// El alto y el anillo de foco se fijan como `style` en línea, no como clase Tailwind: es lo que
// `bitacora/3c-b2-f1.md` deja medible con `getComputedStyle` en jsdom (el paquete no compila
// Tailwind en pruebas). El resto del aspecto (color, radio, tipografía) sí es Tailwind del preset
// semántico: se resuelve en `apps/web`.
"use client";

import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../utilidades/cn.ts";
import { conAnilloFoco, useFoco } from "../../utilidades/foco.ts";

export type VarianteBoton = "primario" | "secundario" | "terciario" | "icono" | "peligro" | "acento";
export type TamanoBoton = "sm" | "md" | "lg";

const ALTURAS: Record<TamanoBoton, number> = { sm: 36, md: 44, lg: 52 };

/** Borde propio (sin relleno) de las variantes que no llevan fondo sólido. */
const BORDE_POR_VARIANTE: Partial<Record<VarianteBoton, string>> = {
  secundario: "inset 0 0 0 2px var(--ui-primary)",
};

const claseBoton = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-ui-pill font-ui-text text-[15px] font-semibold leading-none transition-[background-color,transform,filter,color] duration-[var(--ui-dur-2)] ease-ui-out disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98] active:brightness-[0.92]",
  {
    variants: {
      variant: {
        primario: "bg-ui-primary text-ui-on-primary hover:bg-ui-primary-hover hover:-translate-y-px",
        secundario: "bg-transparent text-ui-link hover:bg-ui-primary-soft",
        terciario: "bg-transparent text-ui-link hover:bg-ui-primary-soft",
        icono: "bg-transparent text-ui-link hover:bg-ui-primary-soft",
        peligro: "bg-ui-danger text-ui-on-danger hover:brightness-95 hover:-translate-y-px",
        acento: "bg-ui-accent text-ui-on-accent hover:brightness-95 hover:-translate-y-px",
      },
      size: {
        sm: "text-[14px]",
        md: "",
        lg: "text-[16px]",
      },
    },
    defaultVariants: { variant: "primario", size: "md" },
  },
);

type PropsVariantes = VariantProps<typeof claseBoton>;

interface PropsComunes {
  readonly variant?: VarianteBoton;
  readonly size?: TamanoBoton;
  /** Renderiza el `children` (un `<a>`, normalmente) con el aspecto del botón (Radix Slot). */
  readonly asChild?: boolean;
  /** `aria-busy` + texto visible (nunca solo un spinner mudo). */
  readonly loading?: boolean;
  /** Sustituye el contenido mientras `loading` es verdadero (p. ej. «Publicando…»). */
  readonly loadingText?: ReactNode;
}

export type PropsBoton = PropsComunes &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color" | keyof PropsVariantes>;

const PADDING_HORIZONTAL: Record<VarianteBoton, Record<TamanoBoton, number>> = {
  primario: { sm: 14, md: 20, lg: 26 },
  secundario: { sm: 14, md: 20, lg: 26 },
  peligro: { sm: 14, md: 20, lg: 26 },
  acento: { sm: 14, md: 20, lg: 26 },
  terciario: { sm: 10, md: 12, lg: 14 },
  icono: { sm: 0, md: 0, lg: 0 },
};

export const Button = forwardRef<HTMLButtonElement, PropsBoton>(function Button(
  {
    variant = "primario",
    size = "md",
    asChild = false,
    loading = false,
    loadingText,
    disabled,
    className,
    style,
    children,
    onFocus,
    onBlur,
    ...resto
  },
  ref,
) {
  const { enFoco, onFocus: manejarFoco, onBlur: manejarDesenfoque } = useFoco<HTMLButtonElement>(onFocus, onBlur);
  const esIcono = variant === "icono";
  const alto = ALTURAS[size];

  const estiloTamano: CSSProperties = esIcono
    ? { height: alto, width: alto, padding: 0 }
    : { height: alto, paddingLeft: PADDING_HORIZONTAL[variant]?.[size], paddingRight: PADDING_HORIZONTAL[variant]?.[size] };

  const estilo: CSSProperties = {
    ...estiloTamano,
    boxShadow: conAnilloFoco(enFoco, BORDE_POR_VARIANTE[variant]),
    ...style,
  };

  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      ref={ref}
      className={cn(claseBoton({ variant, size: esIcono ? undefined : size }), className)}
      style={estilo}
      disabled={asChild ? undefined : disabled || loading}
      aria-disabled={asChild ? disabled || loading || undefined : undefined}
      aria-busy={loading || undefined}
      data-foco={enFoco ? "true" : "false"}
      onFocus={manejarFoco}
      onBlur={manejarDesenfoque}
      {...resto}
    >
      {loading ? (
        <>
          <span aria-hidden className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
          {loadingText ?? children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
});
