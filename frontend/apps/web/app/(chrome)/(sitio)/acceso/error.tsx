// app/(chrome)/(sitio)/acceso/error.tsx — frontera de error de esta pantalla.
//
// POR QUÉ AQUÍ Y NO EN `app/(chrome)/error.tsx`, que las cubriría todas de una vez: el grafo de un
// `error.tsx` entra en el JS de PRIMERA CARGA de todas las rutas de su segmento, y la portada solo
// tiene 22,4 KB gz de margen sobre el runtime común (medido: con la frontera en la raíz del chrome,
// `/` pasaba de 148,1 a 160,0 KB y rompía el presupuesto de 150 KB de `contratos.md §8`). La
// portada es estática y no busca datos: su única frontera útil es la de Next. Estas dos pantallas sí
// ejecutan código en el navegador, y son las que llevan la suya. Registrado en
// `preguntas-abiertas.md` (P-3C-5-3).
"use client";

import { PantallaError } from "@/components/sitio/PantallaError";

export default function ErrorDeAcceso({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return <PantallaError digest={error.digest} onReintentar={reset} />;
}
