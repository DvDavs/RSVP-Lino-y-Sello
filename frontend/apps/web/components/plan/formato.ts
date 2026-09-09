// components/plan/formato.ts — dos formatos de fecha es-MX para `/editor/[invitationId]/plan`.
// Ningún otro módulo del proyecto expone un formateador compartido (cada pantalla escribe el suyo,
// p. ej. `components/editor/PublishDialog.tsx#formatearFecha`): este es el de esta pantalla.
export function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

export function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}
