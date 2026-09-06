"use client";

// components/editor/UndoRedoBar.tsx — deshacer/rehacer (04 §7.2, §11).
//
// El `aria-label` dice QUÉ se va a deshacer, no solo "deshacer": `UndoEntry.label` es texto es-MX
// («Cambiar el título de la portada»), que es la diferencia entre un botón usable a ciegas y uno
// que no lo es. Deshabilitado cuando la pila está vacía — nunca lanza un error (04 §11.3).
//
// Los atajos de teclado se registran aquí para el foco DENTRO del chrome; con el foco dentro del
// LIENZO los captura el documento del iframe y llegan como `KEY_COMMAND` (04 §7.2). Sin esos dos
// caminos, Ctrl+Z deja de funcionar en cuanto el cliente hace clic en la vista previa.
import { Redo2, Undo2 } from "lucide-react";
import { useEffect } from "react";
import { useEditorStore, useUndoRedoLabels } from "@/lib/store";

export function UndoRedoBar() {
  const { undo, redo, canUndo, canRedo } = useUndoRedoLabels();
  const undoOnce = useEditorStore((s) => s.undoOnce);
  const redoOnce = useEditorStore((s) => s.redoOnce);
  const flushNow = useEditorStore((s) => s.flushNow);

  useEffect(() => {
    function alPulsar(evento: KeyboardEvent): void {
      if (!(evento.ctrlKey || evento.metaKey)) return;
      const tecla = evento.key.toLowerCase();
      if (tecla === "z" && !evento.shiftKey) {
        evento.preventDefault();
        undoOnce();
      } else if ((tecla === "z" && evento.shiftKey) || tecla === "y") {
        evento.preventDefault();
        redoOnce();
      } else if (tecla === "s") {
        evento.preventDefault();
        flushNow();
      }
    }
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [undoOnce, redoOnce, flushNow]);

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Deshacer y rehacer">
      <button
        type="button"
        data-testid="undo"
        onClick={undoOnce}
        disabled={!canUndo}
        title={undo ? `Deshacer: ${undo}` : "No hay nada que deshacer"}
        aria-label={undo ? `Deshacer: ${undo}` : "No hay nada que deshacer"}
        className="inline-flex size-11 items-center justify-center rounded-ui-control text-ui-ink transition-colors hover:bg-ui-primary-soft disabled:pointer-events-none disabled:opacity-40"
      >
        <Undo2 className="size-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        data-testid="redo"
        onClick={redoOnce}
        disabled={!canRedo}
        title={redo ? `Rehacer: ${redo}` : "No hay nada que rehacer"}
        aria-label={redo ? `Rehacer: ${redo}` : "No hay nada que rehacer"}
        className="inline-flex size-11 items-center justify-center rounded-ui-control text-ui-ink transition-colors hover:bg-ui-primary-soft disabled:pointer-events-none disabled:opacity-40"
      >
        <Redo2 className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}
