// app/(chrome)/(sitio)/precios/error.tsx — frontera de error de esta pantalla, en su propia
// carpeta (no en la raíz del grupo `(chrome)/(sitio)`) por el mismo motivo que `/acceso` y `/ayuda`
// (`ui-pantalla` §2): un `error.tsx` en la raíz del grupo entra en el JS de primera carga de TODAS
// sus rutas, incluida la portada, sin margen de presupuesto.
"use client";

import { PantallaError } from "@/components/sitio/PantallaError";

export default function ErrorDePrecios({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return <PantallaError digest={error.digest} onReintentar={reset} />;
}
