// packages/sections/src/canvas/CanvasContext.tsx — estado de modo "canvas": selección y avisos.
//
// Este paquete NO sabe hacer `postMessage` (esa es responsabilidad de `apps/web/lib/canvas-bridge.ts`,
// fuera de `packages/sections`, deliberado — ver `types.ts`): `CanvasProvider` es el punto donde
// `apps/web` conecta su propio bucle de postMessage con estos componentes, pasándole `onActivate`
// y `reportWarning` ya cableados. Sin `CanvasProvider` montado (mode="public", o cualquier prueba
// que no lo necesite), `useCanvasOptional()` devuelve `null` — SIN lanzar — y `SectionsRoot`/los
// bloques simplemente no reciben nada de esto (04 §5.1: "los mismos componentes renderizan
// /editor/[id]/canvas, /preview/[id] y /i/[publicToken]").
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { BlockRef, ReportWarning } from "../types.ts";

export interface CanvasContextValue {
  readonly selected: BlockRef | null;
  readonly onActivate: (ref: BlockRef) => void;
  readonly pending: ReadonlySet<string>;
  readonly reportWarning: ReportWarning;
}

const EMPTY_PENDING: ReadonlySet<string> = new Set();
const NOOP_REPORT: ReportWarning = () => {};

const CanvasContext = createContext<CanvasContextValue | null>(null);

export interface CanvasProviderProps {
  readonly selected?: BlockRef | null;
  readonly onActivate?: (ref: BlockRef) => void;
  readonly pending?: ReadonlySet<string>;
  readonly reportWarning?: ReportWarning;
  readonly children: ReactNode;
}

/** Monta el estado de modo "canvas". `apps/web` es quien decide cuándo montarlo (nunca en público). */
export function CanvasProvider({
  selected = null,
  onActivate,
  pending = EMPTY_PENDING,
  reportWarning = NOOP_REPORT,
  children,
}: CanvasProviderProps) {
  // `onActivate` no tiene valor por defecto útil (activar sin destino no significa nada): si no
  // se da, se sustituye por un no-op que además avisa en desarrollo — mejor que fallar en silencio.
  const activate = onActivate ?? (() => {});
  const value = useMemo<CanvasContextValue>(
    () => ({ selected, onActivate: activate, pending, reportWarning }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, activate, pending, reportWarning],
  );
  return <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>;
}

/** `null` fuera de un `CanvasProvider` (p. ej. mode="public") — nunca lanza. */
export function useCanvasOptional(): CanvasContextValue | null {
  return useContext(CanvasContext);
}

/**
 * Clave estable de un `BlockRef`, útil para índices/mapas del lado de `apps/web` (p. ej. el panel
 * de bloque, o el propio `pending: ReadonlySet<string>` que arma `apps/web/lib/store.ts`).
 * `SelectionOverlay` NO la usa para medir — mide por `querySelector` sobre los `data-block-id`/
 * `data-item-id`/`data-item-block-id` que `blocks/activation.ts` ya coloca en modo canvas, así
 * que ningún componente de bloque necesita registrarse aparte en un mapa adicional.
 */
export function refKey(ref: BlockRef): string {
  return [ref.sectionKey, ref.blockId, ref.itemId ?? "", ref.itemBlockId ?? ""].join("::");
}
