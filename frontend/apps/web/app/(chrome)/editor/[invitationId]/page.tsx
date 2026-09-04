"use client";

// app/(chrome)/editor/[invitationId]/page.tsx — ARMAZÓN de dos paneles (04 §4, §6).
//
// Lo que este archivo SÍ hace (bloque 3-4): montar el store, el ciclo de vida (`:choose-template` →
// `GET .../document`), el candado de pestaña, la recuperación de sesión, el aviso de cierre, el
// reenganche a `window.online`, el diálogo de conflicto y el lienzo con su puente.
//
// Lo que NO hace, a propósito (bloque 3-5): los formularios del panel, el selector de paleta, el
// reordenar con arrastre y la subida de imágenes. Los puntos de extensión están marcados con
// «EXTENSIÓN 3-5» y todos consumen el MISMO store: `useSectionRows`, `useActiveBlock`, y las 11
// acciones de `useEditorStore`.
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CanvasFrame } from "@/components/editor/CanvasFrame";
import { ConflictDialog } from "@/components/editor/ConflictDialog";
import { SaveIndicator } from "@/components/editor/SaveIndicator";
import { UndoRedoBar } from "@/components/editor/UndoRedoBar";
import { ViewportToggle } from "@/components/editor/ViewportToggle";
import { Button } from "@/components/ui/button";
import { es_MX } from "@/lib/i18n";
import { useEditorStore, useSectionRows } from "@/lib/store";
import { createTabLock, type TabLock } from "@/lib/tab-lock";

export default function PaginaEditorInvitacion() {
  const params = useParams<{ invitationId: string }>();
  const invitationId = Number(params.invitationId);

  const loadState = useEditorStore((s) => s.loadState);
  const loadError = useEditorStore((s) => s.loadError);
  const templateVersion = useEditorStore((s) => s.templateVersion);
  const revision = useEditorStore((s) => s.revision);
  const avisos = useEditorStore((s) => s.avisos);
  const recovered = useEditorStore((s) => s.recovered);
  const tabRole = useEditorStore((s) => s.tabRole);
  const selection = useEditorStore((s) => s.selection);
  const filas = useSectionRows();
  const candadoRef = useRef<TabLock | null>(null);

  // ── Carga ─────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!Number.isFinite(invitationId) || invitationId <= 0) return;
    void useEditorStore.getState().load(invitationId);
  }, [invitationId]);

  // ── Un solo editor por navegador (04 §12.6 (a)) ───────────────────────────────────────────
  useEffect(() => {
    if (!Number.isFinite(invitationId) || invitationId <= 0) return;
    const candado = createTabLock({
      invitationId,
      onRole: (role) => useEditorStore.getState().setTabRole(role),
    });
    candadoRef.current = candado;
    return () => {
      candado.destroy();
      candadoRef.current = null;
    };
  }, [invitationId]);

  // ── Enganche de pruebas de punta a punta ──────────────────────────────────────────────────
  // `e2e/` conduce el editor por las MISMAS 11 acciones que usará el panel de 3-5, porque los
  // formularios del panel son de ese bloque y todavía no existen. Va detrás de una variable de
  // entorno pública que solo pone `playwright.config.ts`: en un despliegue real no está definida y
  // este `useEffect` no expone nada. El store NO contiene el token de sesión (vive solo en
  // `lib/api-client.ts`, P8), así que el enganche no filtra ningún secreto.
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_E2E_HOOKS !== "1") return;
    (window as unknown as { __editorStore?: typeof useEditorStore }).__editorStore = useEditorStore;
    return () => {
      delete (window as unknown as { __editorStore?: typeof useEditorStore }).__editorStore;
    };
  }, []);

  // ── Cierre de pestaña y reenganche a la red (04 §12.7, §12.5) ─────────────────────────────
  useEffect(() => {
    function alOcultarse(): void {
      if (document.visibilityState === "hidden") useEditorStore.getState().saveOnHide();
    }
    function alDescargar(evento: BeforeUnloadEvent): void {
      if (!useEditorStore.getState().hasUnsaved()) return;
      evento.preventDefault();
      evento.returnValue = "";
    }
    function alVolverLaRed(): void {
      useEditorStore.getState().flushNow();
    }
    document.addEventListener("visibilitychange", alOcultarse);
    window.addEventListener("beforeunload", alDescargar);
    window.addEventListener("online", alVolverLaRed);
    return () => {
      document.removeEventListener("visibilitychange", alOcultarse);
      window.removeEventListener("beforeunload", alDescargar);
      window.removeEventListener("online", alVolverLaRed);
    };
  }, []);

  if (loadState === "loading" || loadState === "idle") {
    return (
      <p role="status" aria-live="polite" className="p-8 text-ui-ink-muted">
        {es_MX.comun.cargando}
      </p>
    );
  }

  if (loadState === "forbidden") {
    return (
      <div role="alert" className="m-8 rounded-ui-card bg-ui-surface p-6 shadow-ui-1">
        <p className="text-ui-body text-ui-ink">No tienes acceso a esta invitación.</p>
        {loadError ? <p className="mt-1 text-ui-aux text-ui-ink-muted">{loadError}</p> : null}
      </div>
    );
  }

  if (loadState === "not-started") return <ElegirPlantilla invitationId={invitationId} />;

  if (loadState === "error") {
    return (
      <div role="alert" className="m-8 rounded-ui-card bg-ui-surface p-6 shadow-ui-1">
        <p className="text-ui-body text-ui-ink">{loadError ?? es_MX.errores.generico}</p>
        <Button className="mt-4" onClick={() => void useEditorStore.getState().load(invitationId)}>
          {es_MX.comun.reintentar}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-ui-bg">
      {/*
        Barra de aplicación FIJA y compacta: el editor necesita deshacer/rehacer, el indicador de
        guardado y "Publicar" visibles SIEMPRE, o el cliente pierde el botón al hacer scroll dentro
        del lienzo (divergencia deliberada de `arte-chrome.md §7`, que mide `position: static` para
        la cabecera del SITIO — válida en el catálogo, no aquí).
      */}
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-ui-border bg-ui-surface px-4">
        <div className="flex min-w-0 items-center gap-3">
          <a href="/editor" className="shrink-0 font-ui-display text-ui-body font-semibold text-ui-ink-heading">
            Invitaciones
          </a>
          <span className="truncate text-ui-aux text-ui-ink-muted">
            {templateVersion ? `${templateVersion.slug} · versión ${revision}` : `versión ${revision}`}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <UndoRedoBar />
          <ViewportToggle />
          <SaveIndicator />
          {/* EXTENSIÓN 3-5: `PublishDialog` (preflight → release, 04 §7.1 pasos 10-12). */}
          <Button size="sm" disabled title="La publicación llega en el siguiente bloque">
            Publicar
          </Button>
        </div>
      </header>

      {tabRole === "readonly" ? (
        <div role="alert" className="flex items-center justify-between gap-4 bg-ui-accent-soft px-4 py-2 text-ui-aux text-ui-accent-soft-ink">
          <span>Esta invitación ya está abierta en otra pestaña.</span>
          <button
            type="button"
            className="rounded-ui-pill bg-ui-accent px-3 py-1.5 font-semibold text-ui-accent-ink"
            onClick={() => {
              candadoRef.current?.takeover();
              useEditorStore.getState().setTabRole("editor");
            }}
          >
            Editar aquí de todas formas
          </button>
        </div>
      ) : null}

      {recovered ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 bg-ui-bg-alt px-4 py-2 text-ui-aux text-ui-ink">
          <span>
            Tenías cambios sin guardar del{" "}
            {new Date(recovered.at).toLocaleString("es-MX", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} (
            {recovered.operations.length}).
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              className="rounded-ui-pill bg-ui-accent px-3 py-1.5 font-semibold text-ui-accent-ink"
              onClick={() => useEditorStore.getState().restoreRecovered(true)}
            >
              Aplicarlos
            </button>
            <button
              type="button"
              className="rounded-ui-pill border border-ui-border px-3 py-1.5 font-semibold text-ui-ink"
              onClick={() => useEditorStore.getState().restoreRecovered(false)}
            >
              Descartarlos
            </button>
          </span>
        </div>
      ) : null}

      {avisos.map((a) => (
        <div
          key={a.id}
          role={a.nivel === "error" ? "alert" : "status"}
          data-testid="aviso"
          className={`flex items-start justify-between gap-3 px-4 py-2 text-ui-aux ${
            a.nivel === "error" ? "bg-red-50 text-ui-danger" : a.nivel === "warning" ? "bg-orange-50 text-ui-ink" : "bg-ui-bg-alt text-ui-ink"
          }`}
        >
          <span>{a.texto}</span>
          <button
            type="button"
            aria-label="Descartar aviso"
            className="shrink-0 px-2 font-semibold"
            onClick={() => useEditorStore.getState().dismissWarning(a.id)}
          >
            ×
          </button>
        </div>
      ))}

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(280px,340px)_1fr]">
        <aside className="overflow-y-auto border-r border-ui-border bg-ui-surface p-4" aria-label={es_MX.editor.panel.secciones}>
          <h2 className="text-ui-body font-semibold text-ui-ink-heading">{es_MX.editor.panel.secciones}</h2>
          {/*
            EXTENSIÓN 3-5 — aquí van `SectionList` (mostrar/ocultar con `setSectionVisible`,
            reordenar con dnd-kit + alternativa de teclado sobre `reorderSections`, elegir variante
            con `setSectionVariant`) y, con un bloque seleccionado, `BlockForm` (react-hook-form +
            resolver del `BlockSpec`, llamando a `setBlock`/`clearBlock`/`setItemBlock`/
            `clearItemBlock`/`addItem`/`removeItem`/`moveItem`).
            La lista de abajo es la mínima navegable: da clic-a-seleccionar y el estado de
            visibilidad, para que el ciclo completo del núcleo se pueda ver y probar hoy.
          */}
          <ul className="mt-3 flex flex-col gap-1">
            {filas.map((fila) => (
              <li key={fila.key}>
                <button
                  type="button"
                  data-testid={`section-row-${fila.key}`}
                  aria-current={selection?.sectionKey === fila.key ? "true" : undefined}
                  onClick={() => {
                    // Al pulsar una fila el lienzo se desplaza a esa sección (04 §9.3
                    // `SCROLL_TO_SECTION`) y la selección pasa a la sección.
                    useEditorStore.getState().select({ sectionKey: fila.key, blockId: fila.key });
                    useEditorStore.getState().scrollToSection(fila.key);
                  }}
                  className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-ui-control border-l-3 px-3 text-left text-ui-aux transition-colors ${
                    selection?.sectionKey === fila.key
                      ? "border-ui-accent bg-ui-accent-soft font-semibold text-ui-accent-soft-ink"
                      : "border-transparent text-ui-ink hover:bg-ui-bg-alt"
                  }`}
                >
                  <span className="truncate">{fila.title}</span>
                  <span className={`shrink-0 ${fila.visible ? "text-ui-ink-muted" : "text-ui-warning"}`}>
                    {fila.visible ? "Visible" : "Oculta"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="min-h-0 p-4" aria-label={es_MX.editor.lienzo.tituloIframe}>
          <CanvasFrame invitationId={params.invitationId} />
        </section>
      </div>

      <ConflictDialog />
    </div>
  );
}

/**
 * `:choose-template` es el PRIMER paso del flujo (contratos §4, ADR-1R-X-03): `GET .../document`
 * responde `404 TPL_DOCUMENT_NOT_STARTED` y **no crea nada**, así que el editor llama antes a
 * `:choose-template`. No es un error del producto — es el estado inicial esperado.
 */
function ElegirPlantilla({ invitationId }: { invitationId: number }) {
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [plantillas, setPlantillas] = useState<{ slug: string; version: string; nombre: string; previewUrl: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    void import("@/lib/api-client").then(async ({ getCatalog }) => {
      try {
        const catalogo = await getCatalog();
        if (cancelado) return;
        setPlantillas(
          catalogo.items.map((i) => ({ slug: i.slug, version: i.version, nombre: i.name["es-MX"], previewUrl: i.previewUrl })),
        );
      } catch (e: unknown) {
        if (!cancelado) setError(e instanceof Error ? e.message : String(e));
      }
    });
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <main className="mx-auto max-w-(--ui-content-max) px-6 py-12" data-testid="elegir-plantilla">
      <h1 className="font-ui-display text-ui-section font-semibold text-ui-ink-heading">{es_MX.editor.catalogo.titulo}</h1>
      <p className="mt-2 max-w-prose text-ui-body text-ui-ink-muted">
        Esta invitación todavía no tiene plantilla. Elige el punto de partida; podrás cambiarlo más adelante sin perder
        lo que escribas.
      </p>
      {error ? (
        <p role="alert" className="mt-6 text-ui-body text-ui-danger">
          {error}
        </p>
      ) : null}
      {plantillas === null ? (
        <p role="status" className="mt-8 text-ui-ink-muted">
          {es_MX.comun.cargando}
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {plantillas.map((p) => (
            <li key={`${p.slug}@${p.version}`} className="flex h-full flex-col overflow-hidden rounded-ui-card bg-ui-surface shadow-ui-1">
              {/* `<img>` y no `next/image`: la `previewUrl` del catálogo es CADUCABLE (firmada de
                  15 min en S3, `handoffs/3-0a.md` §4) y el optimizador la cachearía por su URL. */}
              <img src={p.previewUrl} alt="" className="aspect-3/4 w-full object-cover" />
              <div className="flex flex-1 flex-col gap-4 p-5">
                <h2 className="text-ui-card font-bold text-ui-ink-heading">{p.nombre}</h2>
                <Button
                  className="mt-auto w-full"
                  busy={ocupada === p.slug}
                  data-testid={`elegir-${p.slug}`}
                  onClick={() => {
                    setOcupada(p.slug);
                    void useEditorStore
                      .getState()
                      .chooseTemplateFor(invitationId, p.slug, p.version)
                      .finally(() => setOcupada(null));
                  }}
                >
                  Elegir esta plantilla
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
