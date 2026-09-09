// app/(chrome)/(sitio)/contacto/error.tsx — frontera de error de esta pantalla, no de la raíz del
// grupo (mismo motivo medido que `ayuda/error.tsx`: el presupuesto de JS de la portada no la admite
// en `(chrome)/error.tsx`, `contratos.md §8`).
"use client";

import { PantallaError } from "@/components/sitio/PantallaError";

export default function ErrorDeContacto({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return <PantallaError digest={error.digest} onReintentar={reset} />;
}
