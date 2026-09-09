"use client";

// components/invitados/CompartirInvitacion.tsx — bloque 5-3: compartir LA INVITACIÓN EN GENERAL
// (el enlace público `/i/[publicToken]`), no el enlace personal de ningún invitado — ese vive en
// `AccionesInvitado.tsx`, por fila. Vive en esta pantalla porque «Compartir» del panel
// (`lib/panel/nav.compartir.ts`) aterriza aquí: es donde ya vive todo el reparto.
//
// El origen del enlace sale de `lib/enlace-publico.ts` (N-02: un solo sitio construye el enlace
// público, nunca dos) y el estado de publicación de `getDocument` (`lib/api-client.ts`), la MISMA
// fuente que ya usa `components/asistente/invitaciones.ts` para su propio `publicada`:
// `activeRelease !== null`. No se inventa una segunda forma de saberlo.
//
// El bloque solo se enseña publicada (mismo motivo que la entrada de navegación, U-6: un enlace que
// no abre no se reparte). Sin publicar, se dice qué falta — nunca se promete un enlace roto.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Skeleton, toast } from "@invitaciones/ui";
import { IconoAviso, IconoChat, IconoCompartir, IconoCopiar } from "@invitaciones/icons";
import { ApiError, getDocument } from "@/lib/api-client";
import { enlacePublico } from "@/lib/enlace-publico";
import { textosInvitados as t } from "@/lib/invitados/textos";

type Estado = "cargando" | "publicada" | "no-publicada" | "error";

export function CompartirInvitacion({ invitationId }: { readonly invitationId: number }) {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [enlace, setEnlace] = useState<string | null>(null);
  const [enlaceCopiado, setEnlaceCopiado] = useState(false);
  const [mensajeCopiado, setMensajeCopiado] = useState(false);

  const cargar = useCallback(async (): Promise<void> => {
    setEstado("cargando");
    try {
      const doc = await getDocument(invitationId);
      if (doc.activeRelease) {
        setEnlace(enlacePublico(doc.publicToken, doc.publicUrl));
        setEstado("publicada");
      } else {
        setEnlace(null);
        setEstado("no-publicada");
      }
    } catch (error) {
      // Sin documento todavía no hay nada que publicar: es «no publicada», no un fallo de red.
      if (error instanceof ApiError && error.code === "TPL_DOCUMENT_NOT_STARTED") {
        setEnlace(null);
        setEstado("no-publicada");
        return;
      }
      setEstado("error");
    }
  }, [invitationId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const mensaje = enlace ? t.compartirGeneral.mensaje(enlace) : "";

  async function copiarEnlace(): Promise<void> {
    if (!enlace) return;
    try {
      await navigator.clipboard.writeText(enlace);
      setEnlaceCopiado(true);
      toast({ variante: "exito", descripcion: t.compartirGeneral.enlaceCopiado });
    } catch {
      toast({ variante: "error", descripcion: t.compartirGeneral.errorCopiar });
    }
  }

  async function copiarMensaje(): Promise<void> {
    if (!mensaje) return;
    try {
      await navigator.clipboard.writeText(mensaje);
      setMensajeCopiado(true);
      toast({ variante: "exito", descripcion: t.compartirGeneral.mensajeCopiado });
    } catch {
      toast({ variante: "error", descripcion: t.compartirGeneral.errorCopiar });
    }
  }

  return (
    <section aria-labelledby="compartir-invitacion-titulo" className="rounded-ui-card bg-ui-surface-raised p-6 shadow-ui-1">
      <div className="flex items-center gap-2">
        <IconoCompartir size={20} tone="mono" aria-hidden />
        <h2 id="compartir-invitacion-titulo" className="heading-md text-ui-ink">
          {t.compartirGeneral.titulo}
        </h2>
      </div>
      <p className="mt-1 text-sm text-ui-ink-muted">{t.compartirGeneral.descripcion}</p>

      {estado === "cargando" ? (
        <div className="mt-4 grid gap-3">
          <Skeleton variante="bloque" alto={64} etiqueta={t.compartirGeneral.cargando} />
          <div className="flex flex-wrap gap-2">
            <Skeleton variante="bloque" alto={44} ancho={200} etiqueta="" />
            <Skeleton variante="bloque" alto={44} ancho={160} etiqueta="" />
          </div>
        </div>
      ) : null}

      {estado === "error" ? (
        <div role="alert" className="mt-4 flex flex-col items-start gap-3 rounded-ui-card bg-ui-danger-soft p-4 text-ui-on-danger-soft">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <IconoAviso size={18} tone="mono" aria-hidden />
            {t.compartirGeneral.errorEstado}
          </p>
          <Button variant="secundario" size="sm" onClick={() => void cargar()}>
            {t.reintentar}
          </Button>
        </div>
      ) : null}

      {estado === "no-publicada" ? (
        <div className="mt-4 flex flex-col items-start gap-3 rounded-ui-card bg-ui-surface-alt p-4">
          <p className="text-sm text-ui-ink">{t.compartirGeneral.noPublicada.texto}</p>
          <Button asChild variant="secundario">
            <Link href={`/editor/${invitationId}`}>{t.compartirGeneral.noPublicada.ir}</Link>
          </Button>
        </div>
      ) : null}

      {estado === "publicada" && enlace ? (
        <div className="mt-4 grid gap-4">
          <div className="flex flex-col gap-2 rounded-ui-card bg-ui-surface-alt p-3">
            <span className="label-sm text-ui-ink-muted">{t.compartirGeneral.enlaceEtiqueta}</span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm text-ui-ink" data-testid="compartir-general-enlace">
                {enlace}
              </span>
              <Button size="sm" variant="secundario" onClick={() => void copiarEnlace()}>
                <IconoCopiar size={16} tone="mono" aria-hidden />
                {enlaceCopiado ? t.compartirGeneral.enlaceCopiado : t.compartirGeneral.copiarEnlace}
              </Button>
            </div>
          </div>

          <Button asChild variant="terciario" className="self-start">
            <a href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noreferrer">
              <IconoChat size={16} tone="mono" aria-hidden />
              {t.compartirGeneral.botonWhatsapp}
            </a>
          </Button>

          <div className="flex flex-col gap-2 rounded-ui-card bg-ui-surface-alt p-3">
            <span className="label-sm text-ui-ink-muted">{t.compartirGeneral.mensajeRedesEtiqueta}</span>
            <p className="whitespace-pre-wrap break-words text-sm text-ui-ink" data-testid="compartir-general-mensaje">
              {mensaje}
            </p>
            <Button size="sm" variant="secundario" className="self-start" onClick={() => void copiarMensaje()}>
              <IconoCopiar size={16} tone="mono" aria-hidden />
              {mensajeCopiado ? t.compartirGeneral.mensajeCopiado : t.compartirGeneral.copiarMensaje}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
