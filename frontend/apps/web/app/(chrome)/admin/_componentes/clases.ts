// app/(chrome)/admin/_componentes/clases.ts — combinador de clases mínimo, sin dependencias, para
// los componentes locales de la consola de administración (sesión E5). Mismo patrón que
// `packages/ui/src/componentes/EmptyState.tsx`: solo filtra y une, nada de resolución de conflictos
// (no hace falta `tailwind-merge` aquí: ninguno de estos componentes acepta dos utilidades del
// mismo eje a la vez).
export function clases(...partes: readonly (string | false | null | undefined)[]): string {
  return partes.filter(Boolean).join(" ");
}
