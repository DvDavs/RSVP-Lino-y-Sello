// app/(chrome)/(sitio)/pago/error.tsx — frontera de error de esta pantalla, en su propia carpeta
// (no en la raíz del grupo `(chrome)/(sitio)`) por el mismo motivo que `/precios`, `/acceso` y
// `/ayuda` (`ui-pantalla` §2): un `error.tsx` en la raíz del grupo entra en el JS de primera carga
// de TODAS sus rutas, incluida la portada, sin margen de presupuesto.
//
// Cubre un fallo de React al renderizar (`PantallaPago` ya tiene su PROPIO estado "error" para un
// fetch que falla — `sitio.pago.error` — que no pasa por aquí).
"use client";

import { PantallaError } from "@/components/sitio/PantallaError";

export default function ErrorDePago({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return <PantallaError digest={error.digest} onReintentar={reset} />;
}
