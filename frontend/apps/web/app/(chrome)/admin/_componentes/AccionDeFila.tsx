"use client";

// app/(chrome)/admin/_componentes/AccionDeFila.tsx — la acción destructiva de una fila de `Tabla`
// (p. ej. «Deshabilitar»), con confirmación (`12-producto-completo.md §B3.6`).
//
// Regla del wireframe, literal: «en móvil no se esconde, se enseña deshabilitado con la razón
// visible (…), nunca escondida». Por eso este componente pinta DOS botones a la vez — la MISMA
// acción, nunca dos acciones distintas — y deja que el CSS (breakpoint `sm`, 640 px, mismo patrón
// que `components/editor/PublishDialog.tsx` con `ed:hidden`/`hidden ed:inline`) decida cuál se ve:
//   - escritorio (`hidden sm:inline-flex`): el botón real, `trigger` de un `Dialog` de confirmación;
//   - móvil (`sm:hidden`): el MISMO botón, siempre `disabled`, con la razón escrita justo al lado
//     (nunca solo accesible, VISIBLE) — nunca ausente.
// Los dos existen siempre en el documento (nunca se monta/desmonta uno según el ancho): así el
// control de móvil se puede probar sin simular un `matchMedia`, y no hay salto de layout al cambiar
// de tamaño la ventana.
//
// `onConfirmar` decide qué pasa; este componente no ejecuta nada por sí mismo, solo pide
// confirmación y llama a la función que le dieron por props.
import { useState, type JSX } from "react";
import { Button } from "@invitaciones/ui/componentes/Button/index.ts";
import { Dialog, DialogClose } from "@invitaciones/ui/componentes/Dialog/index.ts";
import { clases } from "./clases.ts";

export interface AccionDeFilaProps {
  /** Texto del botón (p. ej. «Deshabilitar»). */
  readonly etiqueta: string;
  readonly tituloConfirmacion: string;
  readonly descripcionConfirmacion: string;
  readonly etiquetaConfirmar: string;
  readonly etiquetaCancelar: string;
  /** Sustituye el texto del botón de confirmar mientras `onConfirmar` está resolviendo. */
  readonly etiquetaConfirmando?: string;
  readonly onConfirmar: () => void | Promise<void>;
  /** Razón visible en móvil, SIEMPRE (p. ej. «Necesita pantalla más ancha»). */
  readonly razonAnchoInsuficiente: string;
  readonly className?: string;
}

export function AccionDeFila({
  etiqueta,
  tituloConfirmacion,
  descripcionConfirmacion,
  etiquetaConfirmar,
  etiquetaCancelar,
  etiquetaConfirmando,
  onConfirmar,
  razonAnchoInsuficiente,
  className,
}: AccionDeFilaProps): JSX.Element {
  const [abierto, setAbierto] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  async function confirmar(): Promise<void> {
    setConfirmando(true);
    try {
      await onConfirmar();
      setAbierto(false);
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <div className={clases("inline-flex flex-col items-start gap-1", className)}>
      <Dialog
        open={abierto}
        onOpenChange={(siguiente) => {
          if (!confirmando) setAbierto(siguiente);
        }}
        busy={confirmando}
        title={tituloConfirmacion}
        description={descripcionConfirmacion}
        trigger={
          <Button variant="peligro" size="sm" className="hidden sm:inline-flex" data-testid="accion-fila-escritorio">
            {etiqueta}
          </Button>
        }
        footer={
          <>
            <DialogClose asChild>
              <Button variant="terciario" size="sm" disabled={confirmando}>
                {etiquetaCancelar}
              </Button>
            </DialogClose>
            <Button
              variant="peligro"
              size="sm"
              loading={confirmando}
              loadingText={etiquetaConfirmando}
              onClick={() => void confirmar()}
              data-testid="accion-fila-confirmar"
            >
              {etiquetaConfirmar}
            </Button>
          </>
        }
      />

      {/* Móvil (< 640 px): la MISMA acción, nunca escondida — deshabilitada con su razón visible. */}
      <div className="flex flex-col items-start gap-1 sm:hidden">
        <Button variant="peligro" size="sm" disabled data-testid="accion-fila-movil">
          {etiqueta}
        </Button>
        <p className="text-xs text-ui-ink-muted">{razonAnchoInsuficiente}</p>
      </div>
    </div>
  );
}
