"use client";

// components/ui/button.tsx — PUENTE TEMPORAL, fase 3-C bloque 3 (tarea 3C-7).
//
// Era el `Button` de shadcn copiado al repo (04 §2, §18) sobre los tokens medidos de
// `arte-chrome.md §6`. El sistema de diseño del bloque 2 ya trae el suyo — píldora, seis variantes,
// tres tamaños, `loading` con texto, `asChild`, anillo de foco de 3 px con halo (`11 §5`) — así que
// aquí no queda ni una clase ni un token propios: este archivo solo TRADUCE la API vieja
// (`variant: primary | secondary | ghost`, `size: md | sm`, `busy`) a la nueva.
//
// Sigue existiendo porque dos pantallas que NO son de esta tarea todavía lo importan:
// `app/(chrome)/acceso/page.tsx` y `app/(chrome)/editor/page.tsx` (más su `error.tsx`). En cuanto
// esas dos migren a `import { Button } from "@invitaciones/ui"`, este archivo y toda la carpeta
// `components/ui/` se borran: `grep -rn "components/ui/" apps/web` debe quedar en cero.
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Button as ButtonDelSistema, type TamanoBoton, type VarianteBoton } from "@invitaciones/ui";

/** Traducción de nombres: la API vieja era inglesa y tenía tres variantes, no seis. */
const VARIANTE: Record<"primary" | "secondary" | "ghost", VarianteBoton> = {
  primary: "primario",
  secondary: "secundario",
  ghost: "terciario",
};

const TAMANO: Record<"md" | "sm", TamanoBoton> = { md: "md", sm: "sm" };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "sm";
  busy?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", busy, children, ...resto },
  ref,
) {
  return (
    <ButtonDelSistema ref={ref} variant={VARIANTE[variant]} size={TAMANO[size]} loading={busy} {...resto}>
      {children}
    </ButtonDelSistema>
  );
});

/**
 * Se exportaba (bloque 3-8) para vestir un `<Link>` con la MISMA apariencia sin convertirlo en
 * `<button>`. El sistema nuevo resuelve eso con `asChild` (Radix Slot), que además conserva el
 * tamaño y el anillo de foco reales; esta función queda solo para que las dos pantallas ajenas
 * sigan compilando y devuelve las clases de un primario de tamaño medio.
 *
 * @deprecated Usa `<Button asChild><Link …/></Button>` de `@invitaciones/ui`.
 */
export function estilosBoton(opciones?: { variant?: "primary" | "secondary" | "ghost"; size?: "md" | "sm" }): string {
  const variant = opciones?.variant ?? "primary";
  const size = opciones?.size ?? "md";
  const base =
    "inline-flex select-none items-center justify-center gap-2 rounded-ui-pill font-ui-text font-semibold leading-none transition-colors duration-200 ease-ui-out";
  const alto = size === "sm" ? "h-9 px-3.5 text-[14px]" : "h-11 px-5 text-[15px]";
  const color =
    variant === "primary"
      ? "bg-ui-primary text-ui-on-primary hover:bg-ui-primary-hover"
      : variant === "secondary"
        ? "bg-ui-surface-raised text-ui-link ring-2 ring-inset ring-ui-primary hover:bg-ui-primary-soft"
        : "bg-transparent text-ui-link hover:bg-ui-primary-soft";
  return `${base} ${alto} ${color}`;
}
