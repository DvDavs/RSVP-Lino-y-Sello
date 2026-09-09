// app/(chrome)/(sitio)/verificar-correo/error.tsx — frontera de error de esta pantalla, en su
// propia carpeta y no en la raíz de `(chrome)`/`(sitio)` por el mismo presupuesto de JS de primera
// carga que ya midió `acceso/error.tsx` (ver su cabecera).
"use client";

import { PantallaError } from "@/components/sitio/PantallaError";

export default function ErrorDeVerificarCorreo({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return <PantallaError digest={error.digest} onReintentar={reset} />;
}
