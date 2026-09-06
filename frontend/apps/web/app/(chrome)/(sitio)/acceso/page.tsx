// app/(chrome)/(sitio)/acceso/page.tsx — LA PANTALLA DE ACCESO (U-1), ahora con las dos puertas.
//
// Por qué existe: la revisión de uso sin instrucciones abandonó aquí, en el minuto 3. `/editor`
// decía «Tu sesión no es válida o expiró. Inicia sesión de nuevo.» y **no había dónde**: ni botón,
// ni campo de correo, ni ruta `/login` en el `build` (`bitacora/3-ux.md` §1.1).
//
// El token sigue viviendo SOLO en `lib/api-client.ts` (P8, contratos §8 C4): esta página no lo toca.
// Todo el formulario está en `components/sitio/AsistenteAcceso.tsx`; aquí solo queda el
// `metadata` y el límite de Suspense que `useSearchParams` exige en el App Router (sin él, el build
// falla con «useSearchParams should be wrapped in a suspense boundary», verificado en next@16.3.4).
import { Suspense } from "react";
import type { Metadata } from "next";
import { AsistenteAcceso } from "@/components/sitio/AsistenteAcceso";
import { es_MX } from "@/lib/i18n";

export const metadata: Metadata = {
  title: es_MX.acceso.titulo,
  description: es_MX.acceso.intro,
};

export default function PaginaAcceso() {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-md mx-auto w-full max-w-lg px-5 py-12 text-ui-ink-muted sm:px-8">
          {es_MX.comun.cargando}
        </p>
      }
    >
      <AsistenteAcceso />
    </Suspense>
  );
}
