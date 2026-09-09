// app/(chrome)/(sitio)/legal/error.tsx — frontera de error de `/legal` Y de sus dos hijas
// (`/legal/privacidad`, `/legal/terminos`): un `error.tsx` sin `layout.tsx` propio en el segmento
// envuelve también las rutas anidadas, así que basta uno aquí en vez de tres iguales. Mismo motivo
// que `ayuda/error.tsx` para no ponerlo en la raíz del grupo: presupuesto de JS de la portada.
"use client";

import { PantallaError } from "@/components/sitio/PantallaError";

export default function ErrorDeLegal({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return <PantallaError digest={error.digest} onReintentar={reset} />;
}
