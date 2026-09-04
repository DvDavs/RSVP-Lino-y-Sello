"use client";

// app/(chrome)/editor/[invitationId]/page.tsx — chrome de dos paneles (04 §6, §4). ESQUELETO: carga
// el documento (ruta 3, `GET .../document`) y pinta los tres estados reales (cargando, sin plantilla
// elegida todavía, error) más un armazón navegable de los dos paneles cuando hay documento. El
// panel izquierdo (lista de secciones + formulario `react-hook-form`, `04 §6.2-6.3`), el store de
// Zustand (`04 §10`), el undo (`04 §11`) y el autoguardado (`04 §12`) son del bloque 3-4: el punto
// de extensión es el comentario "PANEL IZQUIERDO" de más abajo.
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CanvasFrame } from "@/components/editor/CanvasFrame";
import { Button } from "@/components/ui/button";
import { ApiError, SessionError, getDocument } from "@/lib/api-client";
import type { GetDocumentResponse } from "@/lib/api-types";
import { es_MX } from "@/lib/i18n";

type Estado =
  | { tipo: "cargando" }
  | { tipo: "sinPlantilla" }
  | { tipo: "listo"; datos: GetDocumentResponse }
  | { tipo: "sesion" }
  | { tipo: "error"; mensaje: string; codigo?: string };

export default function PaginaEditorInvitacion() {
  const params = useParams<{ invitationId: string }>();
  const invitationId = Number(params.invitationId);
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });

  useEffect(() => {
    let cancelado = false;
    setEstado({ tipo: "cargando" });
    getDocument(invitationId)
      .then((datos) => {
        if (!cancelado) setEstado({ tipo: "listo", datos });
      })
      .catch((err: unknown) => {
        if (cancelado) return;
        if (err instanceof SessionError) {
          setEstado({ tipo: "sesion" });
        } else if (err instanceof ApiError) {
          if (err.code === "TPL_DOCUMENT_NOT_STARTED") {
            setEstado({ tipo: "sinPlantilla" });
          } else {
            setEstado({ tipo: "error", mensaje: err.message, codigo: err.code });
          }
        } else {
          setEstado({ tipo: "error", mensaje: err instanceof Error ? err.message : String(err) });
        }
      });
    return () => {
      cancelado = true;
    };
  }, [invitationId]);

  if (estado.tipo === "cargando") {
    return (
      <p role="status" aria-live="polite">
        {es_MX.comun.cargando}
      </p>
    );
  }

  if (estado.tipo === "sesion") {
    return (
      <div role="alert">
        <p>{es_MX.errores.sesionInvalida}</p>
      </div>
    );
  }

  if (estado.tipo === "sinPlantilla") {
    // 404 TPL_DOCUMENT_NOT_STARTED (03 §3.3): esta invitación no ha llamado a `:choose-template`
    // todavía. No es un error del producto — es el estado inicial esperado.
    return (
      <div>
        <p>Esta invitación aún no tiene una plantilla elegida.</p>
        <Button onClick={() => window.location.assign("/editor")}>
          {es_MX.editor.catalogo.titulo}
        </Button>
      </div>
    );
  }

  if (estado.tipo === "error") {
    return (
      <div role="alert">
        <p>{estado.mensaje}</p>
        {estado.codigo ? <p>{es_MX.errores.codigo(estado.codigo)}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/*
        Barra de aplicación FIJA y compacta — divergencia deliberada de la referencia (corrección 4
        del revisor): `arte-chrome.md §7` mide `position: static` para la cabecera del sitio, pero
        eso vale para el catálogo (página de marketing-listado, `/editor`), NO para aquí. El editor
        necesita deshacer/rehacer, el indicador de guardado y "Publicar" visibles SIEMPRE, o el
        cliente pierde el botón de guardar al hacer scroll dentro del lienzo. Punto de extensión de
        3-4/3-5: `UndoRedoBar`, `SaveIndicator`, `PublishDialog` (04 §2, componentes de `editor/`).
      */}
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-ui-border bg-ui-surface px-4">
        <span className="truncate text-ui-aux font-semibold text-ui-ink-heading">
          {estado.datos.templateVersion.slug}@{estado.datos.templateVersion.version} · revisión {estado.datos.revision}
        </span>
        <div className="flex items-center gap-2">
          <span role="status" className="text-ui-aux text-ui-ink-muted">
            {es_MX.comun.guardado}
          </span>
          <Button size="sm">Publicar</Button>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[320px_1fr]">
        <aside className="overflow-y-auto border-r border-ui-border p-4" aria-label={es_MX.editor.panel.secciones}>
          {/*
            PANEL IZQUIERDO — punto de extensión del bloque 3-4 (04 §6.2-6.3): `SectionList`,
            `SectionRow` (mostrar/ocultar, reordenar con dnd-kit + alternativa de teclado, `04 §14`) y,
            con un bloque seleccionado, `BlockForm` (react-hook-form + resolver Zod del `BlockSpec`).
          */}
          <h2 className="text-ui-body font-semibold text-ui-ink-heading">{es_MX.editor.panel.secciones}</h2>
          <ul className="mt-3 flex flex-col gap-1 text-ui-aux text-ui-ink">
            {estado.datos.document.structure.sections.map((s) => (
              <li key={s.key} className="rounded-ui-control px-2 py-1.5 hover:bg-ui-bg-alt">
                {s.key}
              </li>
            ))}
          </ul>
        </aside>
        <section className="p-4" aria-label={es_MX.editor.lienzo.tituloIframe}>
          <CanvasFrame invitationId={params.invitationId} />
        </section>
      </div>
    </div>
  );
}
