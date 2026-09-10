// app/(chrome)/admin/_componentes/BloqueConError.tsx — el error POR BLOQUE de la consola
// (`12-producto-completo.md §B3.6`: «ERROR ▸ por bloque: si "Pagos" falla, "Clientas" sigue en
// pantalla con su dato bueno»). Nunca un error de página entera: cada bloque de `/admin`
// (`FilaDeMetricas`, cada `Tabla`) que falle sustituye SOLO su propio contenido por esto — el resto
// de la pantalla sigue mostrando lo que sí cargó.
//
// Título, cuerpo (qué hacer) y UNA sola acción de reintento (`onReintentar`, por props: este
// componente nunca decide por sí mismo qué reintentar ni ejecuta nada además de avisar). Nunca dos
// acciones primarias en un bloque de error — regla del sistema (`11 §5`, `EmptyState`).
//
// Server-safe a propósito (sin "use client", sin hooks): igual que `EmptyState.tsx`, el único
// elemento con comportamiento es `Button` (ya "use client" en sí mismo); este componente solo lo
// compone con texto que llega por props.
import type { JSX } from "react";
import { Button } from "@invitaciones/ui/componentes/Button/index.ts";
import { IconoError } from "@invitaciones/icons";
import { clases } from "./clases.ts";

export interface BloqueConErrorProps {
  /** Título corto del bloque que falló (p. ej. «No pudimos cargar los pagos»). */
  readonly titulo: string;
  /** Qué pasó y qué puede hacer la persona (nunca solo «Error»). */
  readonly cuerpo: string;
  readonly etiquetaReintentar: string;
  /** Sustituye el texto del botón mientras el reintento está en curso. */
  readonly etiquetaReintentando?: string;
  /** `true` mientras `onReintentar` está resolviendo: el botón queda en `loading` (`aria-busy`). */
  readonly reintentando?: boolean;
  readonly onReintentar: () => void;
  readonly className?: string;
}

export function BloqueConError({
  titulo,
  cuerpo,
  etiquetaReintentar,
  etiquetaReintentando,
  reintentando = false,
  onReintentar,
  className,
}: BloqueConErrorProps): JSX.Element {
  return (
    <div role="alert" className={clases("flex flex-col items-start gap-3 rounded-ui-card bg-ui-danger-soft p-5", className)}>
      <div className="flex items-start gap-2.5">
        <IconoError size={20} tone="mono" className="mt-0.5 shrink-0 text-ui-on-danger-soft" />
        <div className="flex flex-col gap-1">
          <p className="heading-md text-ui-on-danger-soft">{titulo}</p>
          <p className="text-sm text-ui-on-danger-soft">{cuerpo}</p>
        </div>
      </div>
      <Button
        variant="secundario"
        size="sm"
        onClick={onReintentar}
        loading={reintentando}
        loadingText={etiquetaReintentando}
        className="text-ui-on-danger-soft"
      >
        {etiquetaReintentar}
      </Button>
    </div>
  );
}
