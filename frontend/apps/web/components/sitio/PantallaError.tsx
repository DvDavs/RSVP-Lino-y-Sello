// components/sitio/PantallaError.tsx — el molde del error genérico de la web pública (`11 §7`, fila
// «Estados»): ilustración del sistema, título, una frase, UNA acción y el código aparte.
//
// Vive aquí y no dentro de un `error.tsx` porque lo montan DOS fronteras de error (`/acceso` y
// `/ayuda`) y porque así se puede probar con Testing Library sin fabricar un fallo de React.
//
// Por qué NO pasa por `EmptyState`: ese componente resuelve la ilustración por nombre a través del
// registro `Ilustracion`, que arrastra las TRES ilustraciones del catálogo al bundle de cliente.
// Aquí importa solo la suya. Es la única pantalla del bloque donde el presupuesto de JS (`contratos
// §8`) manda sobre la comodidad de reutilizar; medición en `bitacora/3c-5.md` §3.
"use client";

import Link from "next/link";
import { Button } from "@invitaciones/ui/componentes/Button/index.ts";
import { ErrorGenerico } from "@invitaciones/ui/ilustraciones/ErrorGenerico.tsx";
import { es_MX } from "@/lib/i18n";

export interface PropsPantallaError {
  /** `digest` de React: el único dato técnico que se enseña, en voz `label` y fuera de la frase. */
  readonly digest?: string;
  readonly onReintentar: () => void;
}

export function PantallaError({ digest, onReintentar }: PropsPantallaError) {
  return (
    <div className="mx-auto flex w-full max-w-ui-page flex-col items-center gap-4 px-5 py-20 text-center sm:px-8">
      <ErrorGenerico size={140} />
      <h1 className="display-sm text-ui-ink">{es_MX.errores.algoSalioMal.titulo}</h1>
      <p className="text-md max-w-[48ch] text-ui-ink-muted">{es_MX.errores.algoSalioMal.cuerpo}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button type="button" onClick={onReintentar}>
          {es_MX.errores.algoSalioMal.reintentar}
        </Button>
        <Link href="/" className="rounded-ui-control px-2 py-2 text-sm font-semibold text-ui-link hover:underline">
          {es_MX.comun.irAlInicio}
        </Link>
      </div>
      {digest ? <p className="label-sm text-ui-ink-muted">{es_MX.errores.codigo(digest)}</p> : null}
    </div>
  );
}
