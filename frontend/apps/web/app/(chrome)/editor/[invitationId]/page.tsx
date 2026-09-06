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
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Toaster } from "@invitaciones/ui";
import { IconoAtras, IconoAviso, IconoCerrar, IconoError, IconoInfo, IconoVistaPrevia } from "@invitaciones/icons";
import { BlockForm } from "@/components/editor/BlockForm";
import { CanvasFrame } from "@/components/editor/CanvasFrame";
import { ConflictDialog } from "@/components/editor/ConflictDialog";
import { PublishDialog } from "@/components/editor/PublishDialog";
import { SaveIndicator } from "@/components/editor/SaveIndicator";
import { SectionList } from "@/components/editor/SectionList";
import { ThemePicker } from "@/components/editor/ThemePicker";
import { UndoRedoBar } from "@/components/editor/UndoRedoBar";
import { ViewportToggle } from "@/components/editor/ViewportToggle";
import { tituloDe } from "../../../(public)/_componentes/composed-lectura";
import { getAuthToken, haySesionCaducada } from "@/lib/api-client";
import { es_MX } from "@/lib/i18n";
import { sembrarManifiestoFixture, useTemplateManifest } from "@/lib/manifest";
import { useEditorStore } from "@/lib/store";
import { createTabLock, type TabLock } from "@/lib/tab-lock";

/**
 * U-8 — «el editor no se puede usar en un teléfono». Medido en la revisión de uso: a 390×844 la
 * página desbordaba 182 px (`scrollWidth` 572 / `clientWidth` 390), «Publicar» quedaba fuera de
 * pantalla en `x=481` y la vista previa no se veía. Incumple WCAG 2.2 AA **1.4.10 Reflow**.
 *
 * `04 §6` NUNCA dibujó el editor en móvil (§6.2 es un wireframe de dos paneles a lo ancho y §7.4
 * solo cambia el ancho del `<iframe>`): es el hueco de diseño D-16. El wireframe que se decide
 * aquí, y queda como **ADR-3-8-01**, es el más simple que resuelve el problema: una columna,
 * cabecera en dos filas con «Publicar» SIEMPRE en la primera, y lista/vista previa en dos pestañas.
 *
 * 900 px es el umbral: por debajo, el panel de 340 px y un lienzo utilizable no caben a la vez.
 * Se decide en JS y no solo en CSS porque los dos paneles tienen que seguir MONTADOS (el `<iframe>`
 * del lienzo se recargaría entero en cada cambio de disposición si se remontara el árbol).
 */
const CONSULTA_MOVIL = "(max-width: 899px)";

function useEsMovil(): boolean {
  // Arranca en `false` a propósito: es lo que renderiza el servidor, así la hidratación coincide.
  const [esMovil, setEsMovil] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const consulta = window.matchMedia(CONSULTA_MOVIL);
    const aplicar = (): void => setEsMovil(consulta.matches);
    aplicar();
    consulta.addEventListener("change", aplicar);
    return () => consulta.removeEventListener("change", aplicar);
  }, []);
  return esMovil;
}

export default function PaginaEditorInvitacion() {
  const params = useParams<{ invitationId: string }>();
  const invitationId = Number(params.invitationId);
  const esMovil = useEsMovil();
  const [pestana, setPestana] = useState<"editar" | "vista-previa">("editar");

  const loadState = useEditorStore((s) => s.loadState);
  const loadError = useEditorStore((s) => s.loadError);
  const composed = useEditorStore((s) => s.composed);
  const avisos = useEditorStore((s) => s.avisos);
  const recovered = useEditorStore((s) => s.recovered);
  const tabRole = useEditorStore((s) => s.tabRole);
  const selection = useEditorStore((s) => s.selection);
  const panel = useEditorStore((s) => s.panel);
  const candadoRef = useRef<TabLock | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const { manifest, theme, status: manifestStatus } = useTemplateManifest(invitationId);
  // D-6 · el nombre humano de la invitación sale del título de portada ya compuesto (el mismo que
  // usa «Mis invitaciones»); mientras no haya documento, un texto honesto en vez de un id.
  const nombreDeLaInvitacion = (composed ? tituloDe(composed) : null) ?? es_MX.editor.barra.sinNombre;

  // Al cambiar entre "lista de secciones" y "contenido de un bloque" el panel es contenido NUEVO:
  // sin esto, el `<aside>` conserva el `scrollTop` de la vista anterior y el título/las primeras
  // preguntas del formulario nuevo quedan tapados arriba del recuadro visible (visto en las
  // capturas de evidencia — `bitacora/3-5.md`).
  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 });
  }, [panel, selection?.sectionKey]);

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
  // `window.__editorStore` sigue vivo: 3-4 avisó en su handoff que se retira "cuando BlockForm
  // permita teclear de verdad" — ya lo permite (este bloque), pero `editor-nucleo.spec.ts`,
  // `deshacer.spec.ts` y `conflicto.spec.ts` (e2e AJENOS, fuera de mi alcance) siguen construidos
  // sobre él; quitarlo los rompe. Se deja para un bloque posterior que migre esos tres archivos a
  // interacción real y entonces sí lo retire (`bitacora/3-5.md`).
  //
  // `window.__seedManifestFixture` es NUEVO de este bloque: el `manifest` que promete el contrato
  // congelado (`handoffs/3-5.md` §1) todavía no llega por HTTP (verificado sobre
  // `Templates2EditorDtos.kt`). Mis propios e2e (`paneles.spec.ts`, `imagenes.spec.ts`) lo usan para
  // sembrar un manifiesto REAL (`TemplateManifest.safeParse`, mismo esquema) mientras el resto del
  // flujo sigue siendo el backend de verdad, sin mocks (`secciones.spec.ts`/`publicar.spec.ts` no lo
  // necesitan: ni reordenar ni publicar dependen del manifiesto). Ambos ganchos comparten guarda:
  // en un despliegue real `NEXT_PUBLIC_E2E_HOOKS` no está definida y este `useEffect` no expone nada.
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_E2E_HOOKS !== "1") return;
    const w = window as unknown as {
      __editorStore?: typeof useEditorStore;
      __seedManifestFixture?: typeof sembrarManifiestoFixture;
    };
    w.__editorStore = useEditorStore;
    w.__seedManifestFixture = sembrarManifiestoFixture;
    return () => {
      delete w.__editorStore;
      delete w.__seedManifestFixture;
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
      <p role="status" aria-live="polite" className="p-8 text-md text-ui-ink-muted">
        {es_MX.comun.cargando}
      </p>
    );
  }

  if (loadState === "forbidden") {
    return (
      <div role="alert" className="m-8 rounded-ui-card bg-ui-surface-raised p-6 shadow-ui-1">
        <p className="text-md text-ui-ink">{es_MX.editor.avisos.sinAcceso}</p>
        {loadError ? <p className="mt-1 text-sm text-ui-ink-muted">{loadError}</p> : null}
      </div>
    );
  }

  if (loadState === "not-started") return <ElegirPlantilla invitationId={invitationId} />;

  if (loadState === "error") {
    // U-1 — antes, sin sesión, esta pantalla decía «Sesión inválida o token ausente/expirado.» con
    // un «Reintentar» que NO podía funcionar nunca, porque no existía forma de iniciar sesión. Se
    // distingue el fallo de sesión (no hay token, o el backend lo rechazó) de cualquier otro: el
    // primero tiene una salida real —la pantalla de acceso—, y el segundo sí es un «Reintentar».
    const sinSesion = getAuthToken() === null || haySesionCaducada();
    if (sinSesion) {
      const volver = encodeURIComponent(`/editor/${params.invitationId}`);
      const caducada = haySesionCaducada();
      return (
        <div role="alert" className="m-8 flex max-w-prose flex-col items-start gap-3 rounded-ui-card bg-ui-surface-raised p-6 shadow-ui-1">
          <p className="text-md text-ui-ink">{caducada ? es_MX.acceso.sesionTerminada : es_MX.acceso.hayQueEntrar}</p>
          <Button asChild>
            <Link href={`/acceso?volver=${volver}${caducada ? "&motivo=sesion" : ""}`}>{es_MX.comun.iniciarSesion}</Link>
          </Button>
        </div>
      );
    }
    return (
      <div role="alert" className="m-8 rounded-ui-card bg-ui-surface-raised p-6 shadow-ui-1">
        <p className="text-md text-ui-ink">{loadError ?? es_MX.errores.generico}</p>
        <Button className="mt-4" onClick={() => void useEditorStore.getState().load(invitationId)}>
          {es_MX.comun.reintentar}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-x-hidden bg-ui-surface-alt">
      {/*
        Barra de aplicación FIJA y compacta: el editor necesita deshacer/rehacer, el indicador de
        guardado y "Publicar" visibles SIEMPRE, o el cliente pierde el botón al hacer scroll dentro
        del lienzo (divergencia deliberada de `arte-chrome.md §7`, que mide `position: static` para
        la cabecera del SITIO — válida en el catálogo, no aquí).
      */}
      {/*
        U-8 · cabecera en DOS filas por debajo de 900 px. Fila 1: la marca y «Publicar», que es la
        acción que la clienta no podía alcanzar en el teléfono (estaba en x=481, fuera de la
        pantalla de 390 px). Fila 2: deshacer/rehacer y el indicador de guardado. El conmutador
        «Escritorio / Móvil» —que solo cambia el ancho del `<iframe>` de la vista previa— se oculta
        en el teléfono: ahí la vista previa ya es del ancho del teléfono y el control no significa
        nada. `flex-wrap` en la fila y `min-w-0` en los hijos: cero desbordamiento horizontal.
      */}
      <header className="sticky top-0 z-10 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-ui-divider bg-ui-surface px-4 py-2 ed:h-16 ed:flex-nowrap ed:justify-between ed:py-0">
        <div className="order-1 flex min-w-0 flex-1 items-center gap-2">
          {/* «← Mis invitaciones» del wireframe (`04 §6.2`). En el teléfono queda solo la flecha:
              el nombre de la invitación es lo que tiene que ganar el espacio. */}
          <Button asChild variant="terciario" size="sm" className="shrink-0">
            <Link href="/editor" aria-label={es_MX.editor.barra.inicio}>
              <IconoAtras size={18} tone="mono" />
              <span className="hidden ed:inline">{es_MX.editor.barra.inicio}</span>
            </Link>
          </Button>
          {/* D-6 · el nombre HUMANO de la invitación («Ana & Luis»), no `boda-clasica · versión
              194`: con cinco invitaciones iguales, la contabilidad interna no distingue ninguna.
              Si el documento todavía no tiene título de portada, se dice «Tu invitación». */}
          <h1 className="min-w-0 truncate text-md font-semibold text-ui-ink" title={nombreDeLaInvitacion}>
            {nombreDeLaInvitacion}
          </h1>
        </div>
        {/* «Publicar»: en el teléfono acompaña al nombre en la PRIMERA fila —es lo único que no
            puede quedar nunca fuera de la pantalla—; en escritorio, el último de la derecha. Es UNA
            sola instancia, movida con `order`: dos instancias serían dos diálogos en el DOM. */}
        <div className="order-2 flex shrink-0 items-center gap-2 ed:order-3">
          {/* «Ver» (`11 §7`): la vista previa autenticada, en pestaña nueva. Se oculta en el
              teléfono, donde la pestaña «Vista previa» ya hace ese trabajo sin salir de la página. */}
          <Button asChild variant="secundario" size="sm" className="hidden ed:inline-flex">
            <a href={`/preview/${params.invitationId}`} target="_blank" rel="noreferrer">
              <IconoVistaPrevia size={18} tone="mono" />
              {es_MX.editor.lienzo.irAPreview}
            </a>
          </Button>
          <PublishDialog invitationId={invitationId} />
        </div>
        <div className="order-3 flex w-full min-w-0 flex-wrap items-center gap-3 ed:order-2 ed:w-auto ed:flex-nowrap">
          <UndoRedoBar />
          {/* El conmutador «Escritorio / Móvil» solo cambia el ancho del `<iframe>` de la vista
              previa: en un teléfono de 390 px no significa nada y roba sitio. */}
          <span className="hidden ed:inline-flex">
            <ViewportToggle />
          </span>
          <SaveIndicator />
        </div>
      </header>

      {esMovil ? (
        <div
          role="tablist"
          aria-label={es_MX.editor.movil.pestanas}
          className="flex shrink-0 gap-1 rounded-ui-pill border-b border-ui-divider bg-ui-surface px-4 pb-2"
        >
          {(
            [
              ["editar", es_MX.editor.movil.editar],
              ["vista-previa", es_MX.editor.movil.vistaPrevia],
            ] as const
          ).map(([clave, etiqueta]) => (
            <button
              key={clave}
              type="button"
              role="tab"
              id={`pestana-${clave}`}
              aria-selected={pestana === clave}
              aria-controls={`panel-${clave}`}
              tabIndex={pestana === clave ? 0 : -1}
              data-testid={`pestana-${clave}`}
              onClick={() => setPestana(clave)}
              onKeyDown={(e) => {
                // Flechas entre pestañas: patrón de `tablist` (WAI-ARIA APG).
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  const otra = clave === "editar" ? "vista-previa" : "editar";
                  setPestana(otra);
                  document.getElementById(`pestana-${otra}`)?.focus();
                }
              }}
              className={`h-11 flex-1 rounded-ui-pill px-3 text-sm font-semibold transition-colors duration-200 ease-ui-out focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface ${
                pestana === clave ? "bg-ui-primary-soft text-ui-on-primary-soft" : "text-ui-ink-muted hover:text-ui-ink"
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>
      ) : null}

      {tabRole === "readonly" ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 bg-ui-primary-soft px-4 py-2 text-sm text-ui-on-primary-soft">
          <span>{es_MX.editor.avisos.otraPestana}</span>
          <Button
            size="sm"
            onClick={() => {
              candadoRef.current?.takeover();
              useEditorStore.getState().setTabRole("editor");
            }}
          >
            {es_MX.editor.avisos.editarAqui}
          </Button>
        </div>
      ) : null}

      {recovered ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 bg-ui-surface-alt px-4 py-2 text-sm text-ui-ink">
          <span>
            {es_MX.editor.avisos.recuperados(
              new Date(recovered.at).toLocaleString("es-MX", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }),
              recovered.operations.length,
            )}
          </span>
          <span className="flex gap-2">
            <Button size="sm" onClick={() => useEditorStore.getState().restoreRecovered(true)}>
              {es_MX.editor.avisos.aplicarlos}
            </Button>
            <Button size="sm" variant="secundario" onClick={() => useEditorStore.getState().restoreRecovered(false)}>
              {es_MX.editor.avisos.descartarlos}
            </Button>
          </span>
        </div>
      ) : null}

      {/* Banda de aviso por nivel: pareja fondo/tinta verificada AA de `danger`/`warning`/`info`
          (`11 §1.4`), con su icono de estado. El cierre es un botón con nombre accesible, no un
          glifo suelto. */}
      {avisos.map((a) => {
        const Icono = a.nivel === "error" ? IconoError : a.nivel === "warning" ? IconoAviso : IconoInfo;
        return (
          <div
            key={a.id}
            role={a.nivel === "error" ? "alert" : "status"}
            data-testid="aviso"
            className={`flex items-start justify-between gap-3 px-4 py-2 text-sm ${
              a.nivel === "error"
                ? "bg-ui-danger-soft text-ui-on-danger-soft"
                : a.nivel === "warning"
                  ? "bg-ui-warning-soft text-ui-on-warning-soft"
                  : "bg-ui-info-soft text-ui-on-info-soft"
            }`}
          >
            <span className="flex min-w-0 items-start gap-2">
              <Icono size={18} tone="mono" className="mt-px shrink-0" />
              {a.texto}
            </span>
            <Button
              variant="icono"
              size="sm"
              aria-label={es_MX.editor.avisos.descartarAviso}
              className="shrink-0 text-current"
              onClick={() => useEditorStore.getState().dismissWarning(a.id)}
            >
              <IconoCerrar size={18} tone="mono" />
            </Button>
          </div>
        );
      })}

      <div className={esMovil ? "flex min-h-0 flex-1 flex-col" : "grid min-h-0 flex-1 grid-cols-[minmax(280px,340px)_1fr]"}>
        <aside
          ref={panelRef}
          id="panel-editar"
          hidden={esMovil && pestana !== "editar"}
          {...(esMovil
            ? ({ role: "tabpanel", "aria-labelledby": "pestana-editar" } as const)
            : ({ "aria-label": es_MX.editor.panel.secciones } as const))}
          className={`min-w-0 overflow-y-auto bg-ui-surface p-4 ${esMovil ? "flex-1" : "border-r border-ui-divider"}`}
        >
          {panel === "block" && selection ? (
            <BlockForm invitationId={invitationId} manifest={manifest} manifestStatus={manifestStatus} />
          ) : (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="mb-3 heading-sm text-ui-ink">{es_MX.editor.panel.secciones}</h2>
                <SectionList manifest={manifest} />
              </div>
              <div className="border-t border-ui-divider pt-4">
                <ThemePicker theme={theme} />
              </div>
            </div>
          )}
        </aside>

        <section
          id="panel-vista-previa"
          hidden={esMovil && pestana !== "vista-previa"}
          {...(esMovil
            ? ({ role: "tabpanel", "aria-labelledby": "pestana-vista-previa" } as const)
            : ({ "aria-label": es_MX.editor.lienzo.tituloIframe } as const))}
          className={`min-h-0 min-w-0 p-4 ${esMovil ? "flex-1" : ""}`}
        >
          <CanvasFrame invitationId={params.invitationId} />
        </section>
      </div>

      <ConflictDialog />
      {/* Punto de montaje ÚNICO de las tostadas (`handoffs/3c-b2-f2.md`). Vive aquí y no en
          `app/(chrome)/layout.tsx` porque ese layout es de otra tarea del bloque 3; cuando lo
          suba, esta línea sobra. */}
      <Toaster />
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
    <main className="mx-auto max-w-ui-page px-6 py-12" data-testid="elegir-plantilla">
      <h1 className="display-sm text-ui-ink">{es_MX.editor.catalogo.titulo}</h1>
      <p className="mt-2 max-w-prose text-md text-ui-ink-muted">
        Esta invitación todavía no tiene plantilla. Elige el punto de partida; podrás cambiarlo más adelante sin perder
        lo que escribas.
      </p>
      {error ? (
        <p role="alert" className="mt-6 flex items-center gap-1.5 text-md font-semibold text-ui-danger-text">
          <IconoError size={18} tone="mono" className="shrink-0" />
          {error}
        </p>
      ) : null}
      {plantillas === null ? (
        <p role="status" className="mt-8 text-md text-ui-ink-muted">
          {es_MX.comun.cargando}
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {plantillas.map((p) => (
            <li key={`${p.slug}@${p.version}`} className="flex h-full flex-col overflow-hidden rounded-ui-media bg-ui-surface-raised shadow-ui-1">
              {/* `<img>` y no `next/image`: la `previewUrl` del catálogo es CADUCABLE (firmada de
                  15 min en S3, `handoffs/3-0a.md` §4) y el optimizador la cachearía por su URL. */}
              <img src={p.previewUrl} alt="" className="aspect-3/4 w-full object-cover" />
              <div className="flex flex-1 flex-col gap-4 p-5">
                <h2 className="heading-sm text-ui-ink">{p.nombre}</h2>
                <Button
                  className="mt-auto w-full"
                  loading={ocupada === p.slug}
                  loadingText={es_MX.editor.catalogo.eligiendo}
                  data-testid={`elegir-${p.slug}`}
                  onClick={() => {
                    setOcupada(p.slug);
                    void useEditorStore
                      .getState()
                      .chooseTemplateFor(invitationId, p.slug, p.version)
                      .finally(() => setOcupada(null));
                  }}
                >
                  {es_MX.editor.catalogo.elegir}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
