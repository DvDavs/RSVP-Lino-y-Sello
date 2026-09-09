// app/(chrome)/perfil/page.tsx — `/perfil` ENTERA (fase 5, E3; sustituye el marcador del andamio
// 5-0d, `README.md` de esta carpeta). El wireframe que construye es
// `docs/rediseno-plantillas/diseno/12-producto-completo.md` § «7 · /perfil».
//
// Server Component: solo resuelve `NEXT_PUBLIC_SOPORTE_CORREO` (necesita el `process.env` REAL del
// servidor — `lib/env.ts` lee por índice de cadena, así que el reemplazo estático de Next en
// cliente nunca lo alcanzaría, a diferencia de `process.env.NEXT_PUBLIC_X` literal) y se lo pasa
// como prop al componente cliente, que es quien de verdad pinta la pantalla y llama al backend con
// el token de `lib/api-client.ts` (solo existe en el navegador).
//
// Va en `(chrome)` y NO en `(chrome)/(sitio)`: es producto detrás de sesión (README de esta
// carpeta), así que no hay `MarcoSitio` que ponga `<main>` — lo pone `PerfilCuenta` con
// `EncabezadoSitio` arriba, igual que `/editor` (`app/(chrome)/editor/page.tsx`).
import type { Metadata } from "next";
import { PerfilCuenta } from "@/components/cuenta/PerfilCuenta";
import { correoDeSoporteDelEntorno } from "@/lib/env";
import { es_MX } from "@/lib/i18n";

export const metadata: Metadata = {
  title: es_MX.perfil.titulo,
  // Permanente: es una pantalla de la cuenta, detrás de sesión (README de esta carpeta).
  robots: { index: false, follow: false },
};

export default function PaginaPerfil() {
  return <PerfilCuenta correoSoporte={correoDeSoporteDelEntorno()} />;
}
