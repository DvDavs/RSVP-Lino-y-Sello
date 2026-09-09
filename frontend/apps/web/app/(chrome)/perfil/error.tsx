// app/(chrome)/perfil/error.tsx — frontera de error de esta pantalla. Propia y no en la raíz de
// `(chrome)` por el mismo presupuesto de JS de primera carga que ya midió `acceso/error.tsx` (su
// cabecera trae la medición completa).
"use client";

import { PantallaError } from "@/components/sitio/PantallaError";

export default function ErrorDePerfil({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return <PantallaError digest={error.digest} onReintentar={reset} />;
}
