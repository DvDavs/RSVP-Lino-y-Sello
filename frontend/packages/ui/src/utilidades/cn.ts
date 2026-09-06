// packages/ui/src/utilidades/cn.ts — combinador de clases de la familia de formularios (bloque 2).
// `cx` es el `clsx` que ya trae `class-variance-authority` (no se añade `clsx` como dependencia
// propia); `twMerge` resuelve conflictos de utilidades Tailwind (p. ej. dos `h-*`) por orden de
// aparición, quedándose con la última — así un `className` del consumidor puede pisar una utilidad
// del preset sin dejar las dos en el DOM.
import { cx, type CxOptions } from "class-variance-authority";
import { twMerge } from "tailwind-merge";

export function cn(...entradas: CxOptions): string {
  return twMerge(cx(...entradas));
}
