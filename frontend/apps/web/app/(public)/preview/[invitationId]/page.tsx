"use client";

// app/(public)/preview/[invitationId]/page.tsx — previsualización autenticada SIN chrome (04 §15.5):
// compone el DOCUMENTO DE TRABAJO (`GET .../document`, ruta 3) y lo pinta en `mode="public"`. Sirve
// para "ver antes de publicar", como salida de degradación del lienzo (04 §8.8) y como objetivo
// estable para los e2e de render sin la complejidad del iframe.
//
// DESVIACIÓN documentada (`memoria/preguntas-abiertas.md`): `04 §6` marca esta ruta como RSC, pero
// el token de sesión vive en `sessionStorage` (P8, `lib/api-client.ts`) y un Server Component no
// puede leerlo. Hasta que exista un mecanismo de sesión legible en servidor (p. ej. una cookie
// httpOnly que emita el bloque 3-4), esta página es un Client Component — mismo patrón que
// `/editor/[invitationId]`. No cambia el contrato con el backend ni el modo de render de las
// secciones (`mode="public"`).
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ComposedPreviewStub } from "@/components/public/ComposedPreviewStub";
import { ApiError, SessionError, getDocument } from "@/lib/api-client";
import type { GetDocumentResponse } from "@/lib/api-types";
import { es_MX } from "@/lib/i18n";

type Estado =
  | { tipo: "cargando" }
  | { tipo: "listo"; datos: GetDocumentResponse }
  | { tipo: "sesion" }
  | { tipo: "sinPlantilla" }
  | { tipo: "error"; mensaje: string; codigo?: string };

export default function PaginaPreview() {
  const params = useParams<{ invitationId: string }>();
  const invitationId = Number(params.invitationId);
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });

  useEffect(() => {
    let cancelado = false;
    getDocument(invitationId)
      .then((datos) => {
        if (!cancelado) setEstado({ tipo: "listo", datos });
      })
      .catch((err: unknown) => {
        if (cancelado) return;
        if (err instanceof SessionError) setEstado({ tipo: "sesion" });
        else if (err instanceof ApiError && err.code === "TPL_DOCUMENT_NOT_STARTED") setEstado({ tipo: "sinPlantilla" });
        else if (err instanceof ApiError) setEstado({ tipo: "error", mensaje: err.message, codigo: err.code });
        else setEstado({ tipo: "error", mensaje: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelado = true;
    };
  }, [invitationId]);

  if (estado.tipo === "cargando") {
    return (
      <p role="status" aria-live="polite" style={{ padding: "2rem" }}>
        {es_MX.comun.cargando}
      </p>
    );
  }
  if (estado.tipo === "sesion") {
    return (
      <p role="alert" style={{ padding: "2rem" }}>
        {es_MX.errores.sesionInvalida}
      </p>
    );
  }
  if (estado.tipo === "sinPlantilla") {
    return <p style={{ padding: "2rem" }}>Esta invitación aún no tiene una plantilla elegida.</p>;
  }
  if (estado.tipo === "error") {
    return (
      <div role="alert" style={{ padding: "2rem" }}>
        <p>{estado.mensaje}</p>
        {estado.codigo ? <p>{es_MX.errores.codigo(estado.codigo)}</p> : null}
      </div>
    );
  }
  return <ComposedPreviewStub composed={estado.datos.composed} />;
}
