"use client";

// app/(chrome)/editor/[invitationId]/invitados/error.tsx — frontera de error de ESTA pantalla (no
// en la raíz del grupo `(chrome)`: un `error.tsx` ahí entra en el JS de primera carga de TODAS las
// rutas del grupo, incluida la portada — ver `ui-pantalla` §2 y `(sitio)/acceso/error.tsx`).
//
// Este es el error de React (algo se rompió al renderizar), no el estado `ERROR` de la propia
// pantalla — ese lo pinta `PantallaInvitados` con la tabla anterior visible (`ui-pantalla` §7).
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@invitaciones/ui/componentes/Button/index.ts";
import { ErrorGenerico } from "@invitaciones/ui/ilustraciones/ErrorGenerico.tsx";
import { es_MX } from "@/lib/i18n";

export default function ErrorDeInvitados({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  const params = useParams<{ invitationId: string }>();
  return (
    <div className="mx-auto flex w-full max-w-ui-page flex-col items-center gap-4 px-5 py-20 text-center sm:px-8">
      <ErrorGenerico size={140} />
      <h1 className="display-sm text-ui-ink">{es_MX.errores.algoSalioMal.titulo}</h1>
      <p className="max-w-[48ch] text-md text-ui-ink-muted">{es_MX.errores.algoSalioMal.cuerpo}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button type="button" onClick={reset}>
          {es_MX.errores.algoSalioMal.reintentar}
        </Button>
        <Link
          href={`/editor/${encodeURIComponent(params.invitationId)}`}
          className="rounded-ui-control px-2 py-2 text-sm font-semibold text-ui-link hover:underline"
        >
          {es_MX.panel.marcador.volverAlEditor}
        </Link>
      </div>
      {error.digest ? <p className="label-sm text-ui-ink-muted">{es_MX.errores.codigo(error.digest)}</p> : null}
    </div>
  );
}
