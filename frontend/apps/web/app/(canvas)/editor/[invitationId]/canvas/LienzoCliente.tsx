"use client";

// app/(canvas)/editor/[invitationId]/canvas/LienzoCliente.tsx — DOCUMENTO DEL LIENZO (04 §6, §8, §9).
//
// Es el componente de CLIENTE; `page.tsx` (servidor) le pasa el `nonce` de la CSP. La separacion no
// es cosmetica: `ThemeProvider` emite un `<style nonce>` YA EN EL RENDER DE SERVIDOR, y leer el
// nonce en un `useEffect` llega tarde: el navegador rechaza ese `<style>` («Refused to apply inline
// style», medido) y ademas produce una discrepancia de hidratacion (React #418).
//
// Es una hoja: no navega, no hace `fetch`, no importa `lib/api-client.ts` ni `lib/store.ts`
// (`eslint.config.mjs`, `04 §19.3`) y no toca `localStorage` — en origen opaco eso LANZA. Todo lo
// que pinta llega por `postMessage` (`lib/canvas-client.ts`).
//
// Lo que hace, uno a uno los ocho mensajes salientes de `04 §9.4`:
//   READY (saludo)            · lo emite `createCanvasClient`
//   BLOCK_CLICKED             · `CanvasProvider.onActivate` → el PANEL abre ese campo con el foco.
//                               El lienzo NO edita texto sobre sí mismo: nada de `contenteditable`
//                               (04 §4, decisión de diseño P7/P1 — la validación por `BlockSpec`
//                               es visible en un formulario e imposible en un `contenteditable`).
//   SECTION_IN_VIEW           · `IntersectionObserver` sobre cada `<section>` real
//   CANVAS_RESIZED            · `ResizeObserver` sobre el documento
//   KEY_COMMAND               · atajos con el foco DENTRO del lienzo (04 §7.2, criterio A7)
//   RENDER_ERROR              · `ErrorBoundary` por sección: una sección que lanza NO tumba el editor
//   RENDER_WARNING            · `CanvasProvider.reportWarning` de `@invitaciones/sections`
//   PONG                      · lo responde `createCanvasClient`
//
// CERO `style={{…}}`: la CSP del lienzo no habilita atributos `style` (medido, `3-0b.md §1`). Todo
// el CSS del documento vive en el único `<style nonce>` de `(canvas)/layout.tsx`.
import { CanvasProvider, SectionsRoot, type BlockRef as SectionsBlockRef } from "@invitaciones/sections";
import type { ComposedDocument } from "@invitaciones/schema";
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { createCanvasClient, type CanvasClient, type PatchEntryIn } from "@/lib/canvas-client";
// `lib/composed-patch.ts` es PURO (sin red, sin store, sin token): el lienzo puede importarlo.
import { applyPatchEntries, type PatchEntry } from "@/lib/composed-patch";

type Estado =
  | { tipo: "esperando" }
  | { tipo: "conectado" }
  | { tipo: "pintando"; composed: ComposedDocument; revision: number }
  | { tipo: "incompatible"; version: number };

/** Aislamiento de fallos: es la razón de ser de ADR-018. Una sección que lanza NO tumba el editor. */
class LimiteDeError extends Component<
  { children: ReactNode; onError: (mensaje: string, digest?: string) => void },
  { fallo: string | null }
> {
  override state = { fallo: null as string | null };

  static getDerivedStateFromError(error: unknown): { fallo: string } {
    return { fallo: error instanceof Error ? error.message : String(error) };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError(error.message, (info as { digest?: string }).digest);
  }

  override render(): ReactNode {
    if (this.state.fallo !== null) {
      return (
        <p className="lienzo-error" role="alert">
          No pudimos mostrar esta parte de la invitación.
        </p>
      );
    }
    return this.props.children;
  }
}

/**
 * Clave con la que `@invitaciones/sections` busca un bloque en `pending` (`04 §5.2`, §12.4):
 * `blockId` a nivel de sección y `` `${itemId}.${itemBlockId}` `` dentro de un grupo
 * (`packages/sections/src/blocks/dispatch.ts:41`, `itemPendingKey`, que el paquete no reexporta).
 *
 * NO es `refKey()`: esa es la clave de SELECCIÓN (`sectionKey::blockId::itemId::itemBlockId`) y
 * pertenece a otro espacio de nombres. Usarla aquí hacía que `aria-busy` no apareciera NUNCA en el
 * lienzo — medido en el bloque 3-5b montando el componente y contando los nodos ocupados: 0.
 */
function clavePendiente(ref: { blockId: string; itemId?: string; itemBlockId?: string }): string {
  return ref.itemId !== undefined && ref.itemBlockId !== undefined ? `${ref.itemId}.${ref.itemBlockId}` : ref.blockId;
}

export interface LienzoClienteProps {
  /** Nonce por peticion de la CSP (`proxy.ts`). Obligatorio: sin el, el tema no se aplica. */
  readonly nonce: string;
}

export function LienzoCliente({ nonce }: LienzoClienteProps) {
  const [estado, setEstado] = useState<Estado>({ tipo: "esperando" });
  const [seleccion, setSeleccion] = useState<SectionsBlockRef | null>(null);
  const [pendientes, setPendientes] = useState<ReadonlySet<string>>(() => new Set());
  const [viewport, setViewport] = useState<"mobile" | "desktop">("desktop");
  const [temaPrevio, setTemaPrevio] = useState<{ paletteId: string | null; fontSetId: string | null } | null>(null);
  const clienteRef = useRef<CanvasClient | null>(null);
  const raizRef = useRef<HTMLDivElement>(null);
  /** Última revisión pintada. Distingue un `RENDER` nuevo del servidor de un repintado del padre. */
  const revisionPintadaRef = useRef<number | null>(null);

  // ── Puente ────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const cliente = createCanvasClient(
      {
        onRender: (composed, revision) => {
          setEstado({ tipo: "pintando", composed, revision });
          // Un `RENDER` con la MISMA revisión no trae verdad nueva del servidor: es el documento que
          // el padre ya tenía, repintado. Hoy lo usa la vista previa de tema (`04 §7.1` paso 8), que
          // no puede perder las marcas `aria-busy` de los bloques con valor sin confirmar (§12.4)
          // solo porque el cliente pasó el ratón por una paleta. Con revisión nueva sí se limpian:
          // el servidor ya confirmó lo que hubiera pendiente.
          // El valor se lee ANTES de actualizarlo: el actualizador de `setPendientes` corre después
          // (en el render), y leer la ref dentro de él daría siempre la revisión nueva.
          const revisionPrevia = revisionPintadaRef.current;
          revisionPintadaRef.current = revision;
          setPendientes((previas) => (revisionPrevia === revision ? previas : new Set()));
        },
        onPatch: (entries: PatchEntryIn[]) => {
          setEstado((previo) => {
            if (previo.tipo !== "pintando") return previo;
            return { ...previo, composed: applyPatchEntries(previo.composed, entries as unknown as PatchEntry[]) };
          });
          setPendientes((previas) => {
            const siguiente = new Set(previas);
            for (const e of entries) {
              const clave = clavePendiente(e.ref);
              if (e.pending) siguiente.add(clave);
              else siguiente.delete(clave);
            }
            return siguiente;
          });
        },
        onSelect: (ref) => setSeleccion(ref as SectionsBlockRef | null),
        onScrollToSection: (sectionKey) => {
          const destino = raizRef.current?.querySelector(`[data-section-key="${CSS.escape(sectionKey)}"]`);
          destino?.scrollIntoView({ behavior: "smooth", block: "start" });
        },
        onViewport: (width) => setViewport(width),
        // PREVIEW_THEME solo transporta IDENTIFICADORES (`04 §9.3`, protocolo v1 congelado). El
        // lienzo NO puede resolverlos a `tokens` por sí mismo: no tiene el `theme.json` de la
        // plantilla, no puede pedirlo (`connect-src 'none'`, sin credenciales, `lib/api-client.ts`
        // prohibido aquí) y `ThemeProvider` pinta los `--inv-color-*` desde `theme.tokens`, nunca
        // desde el id. Los tokens ya resueltos llegan por el `RENDER` efímero que envía el padre
        // (`lib/store.ts` → `resolverTemaPrevio`, bloque 3-5b). Esto se queda para que el atributo
        // `data-theme-palette` sea correcto también cuando el padre NO tiene catálogo que resolver.
        onPreviewTheme: (paletteId, fontSetId) => setTemaPrevio(paletteId === null && fontSetId === null ? null : { paletteId, fontSetId }),
        onIncompatible: (version) => setEstado({ tipo: "incompatible", version }),
        onConnected: () => setEstado((p) => (p.tipo === "esperando" ? { tipo: "conectado" } : p)),
      },
      { buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? "apps-web-3-4" },
    );
    clienteRef.current = cliente;
    cliente.start();
    return () => {
      cliente.stop();
      clienteRef.current = null;
    };
  }, []);

  const compuestoEfectivo = useMemo<ComposedDocument | null>(() => {
    if (estado.tipo !== "pintando") return null;
    if (temaPrevio === null) return estado.composed;
    // PREVIEW_THEME es EFÍMERO: no genera operación ni undo (04 §9.3). Los `tokens` de la paleta
    // previsualizada ya vienen dentro de `estado.composed.theme` (el `RENDER` efímero del padre);
    // aquí solo se sellan los identificadores, que es lo único que este mensaje transporta.
    return {
      ...estado.composed,
      theme: {
        ...estado.composed.theme,
        paletteId: temaPrevio.paletteId ?? estado.composed.theme.paletteId,
        fontSetId: temaPrevio.fontSetId ?? estado.composed.theme.fontSetId,
      },
    };
  }, [estado, temaPrevio]);

  // ── CANVAS_RESIZED: medición que el padre NO puede hacer (04 §8.3, criterio A6) ────────────
  useEffect(() => {
    const el = raizRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(() => {
      clienteRef.current?.sendResized(Math.ceil(el.getBoundingClientRect().height));
    });
    observador.observe(el);
    return () => observador.disconnect();
  }, [estado.tipo]);

  // ── `data-section-key`: `packages/sections` (que NO se toca, es contrato integrado y probado)
  //    marca cada `<section>` con `data-section-type`, no con la CLAVE de la sección, y una misma
  //    plantilla puede declarar dos secciones del mismo tipo. `SectionsRoot` las pinta EN ORDEN y
  //    cada componente emite exactamente un `<section>` de primer nivel [V: 12/12], así que la
  //    correspondencia posicional con `composed.sections.filter(visible)` es exacta. Se sella aquí,
  //    en el consumidor, en vez de pedir un campo nuevo al paquete. ──────────────────────────────
  const seccionesVisibles = useMemo(
    () => (compuestoEfectivo?.sections ?? []).filter((s) => s.visible).map((s) => s.key),
    [compuestoEfectivo],
  );
  useEffect(() => {
    const el = raizRef.current;
    if (!el) return;
    const nodos = [...el.querySelectorAll("section[data-section-type]")].filter(
      (n) => n.parentElement?.closest("section[data-section-type]") === null,
    );
    nodos.forEach((n, i) => {
      const clave = seccionesVisibles[i];
      if (clave !== undefined) n.setAttribute("data-section-key", clave);
    });
  }, [seccionesVisibles]);

  // ── SECTION_IN_VIEW: sincroniza el resaltado de la lista al hacer scroll (04 §9.4) ─────────
  useEffect(() => {
    const el = raizRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const secciones = el.querySelectorAll("[data-section-key]");
    if (secciones.length === 0) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        const visible = entradas.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const clave = visible?.target.getAttribute("data-section-key");
        if (clave) clienteRef.current?.sendSectionInView(clave);
      },
      { threshold: [0.25, 0.6] },
    );
    for (const s of secciones) observador.observe(s);
    return () => observador.disconnect();
  }, [estado]);

  // ── KEY_COMMAND: sin esto Ctrl+Z deja de funcionar en cuanto el cliente pincha en el lienzo,
  //    porque los eventos de teclado no cruzan la frontera de documento (04 §7.2, criterio A7) ──
  useEffect(() => {
    function alPulsar(evento: KeyboardEvent): void {
      const meta = evento.ctrlKey || evento.metaKey;
      if (evento.key === "Escape") {
        clienteRef.current?.sendKeyCommand("escape");
        return;
      }
      if (!meta) return;
      const tecla = evento.key.toLowerCase();
      if (tecla === "z" && !evento.shiftKey) {
        evento.preventDefault();
        clienteRef.current?.sendKeyCommand("undo");
      } else if ((tecla === "z" && evento.shiftKey) || tecla === "y") {
        evento.preventDefault();
        clienteRef.current?.sendKeyCommand("redo");
      } else if (tecla === "s") {
        evento.preventDefault();
        clienteRef.current?.sendKeyCommand("save");
      }
    }
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, []);

  // ── El lienzo NO navega (04 §8.7): los `<a>` se interceptan ────────────────────────────────
  useEffect(() => {
    function alHacerClic(evento: MouseEvent): void {
      const destino = evento.target as HTMLElement | null;
      if (destino?.closest("a[href]")) evento.preventDefault();
    }
    document.addEventListener("click", alHacerClic, true);
    return () => document.removeEventListener("click", alHacerClic, true);
  }, []);

  const alActivar = useCallback((ref: SectionsBlockRef) => {
    // BLOCK_CLICKED → el panel abre ese campo con el foco puesto (04 §4/§7.1 paso 5).
    clienteRef.current?.sendBlockClicked(ref as unknown as Parameters<CanvasClient["sendBlockClicked"]>[0]);
  }, []);

  const alAvisar = useCallback((aviso: { code: "unknown-variant" | "unmapped-role" | "missing-font"; detail: string }) => {
    clienteRef.current?.sendRenderWarning(aviso);
  }, []);

  const alFallar = useCallback((mensaje: string, digest?: string) => {
    clienteRef.current?.sendRenderError(digest === undefined ? { message: mensaje } : { message: mensaje, digest });
  }, []);

  if (estado.tipo === "incompatible") {
    return (
      <main className="lienzo-main" data-estado="incompatible">
        <p role="alert">Vista previa incompatible (protocolo v{estado.version}). Recarga la página.</p>
      </main>
    );
  }

  if (compuestoEfectivo === null) {
    return (
      <main className="lienzo-main" data-estado={estado.tipo}>
        <p role="status" aria-live="polite">
          {estado.tipo === "esperando" ? "Esperando al editor…" : "Preparando tu invitación…"}
        </p>
      </main>
    );
  }

  return (
    <div ref={raizRef} className="lienzo-raiz" data-viewport={viewport} data-estado="pintando">
      <CanvasProvider selected={seleccion} onActivate={alActivar} pending={pendientes} reportWarning={alAvisar}>
        <LimiteDeError onError={alFallar}>
          <SectionsRoot composed={compuestoEfectivo} mode="canvas" nonce={nonce} />
        </LimiteDeError>
      </CanvasProvider>
    </div>
  );
}
