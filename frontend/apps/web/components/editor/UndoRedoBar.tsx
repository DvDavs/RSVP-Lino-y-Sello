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
//
// Fase 3-C: `Button variant="icono"` del sistema (44 px, anillo de foco propio) con
// `IconoDeshacer`/`IconoRehacer` del inventario (`11 §4.2`, «Edición»), y `Tooltip` para que quien
// usa ratón vea también QUÉ se deshace. El tooltip NUNCA es el único portador: el `aria-label` dice
// lo mismo (`11 §5`).
import { useEffect } from "react";
import { Button, Tooltip } from "@invitaciones/ui";
import { IconoDeshacer, IconoRehacer } from "@invitaciones/icons";
import { es_MX } from "@/lib/i18n";
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

  const etiquetaDeshacer = undo ? es_MX.editor.barra.deshacer(undo) : es_MX.editor.barra.nadaQueDeshacer;
  const etiquetaRehacer = redo ? es_MX.editor.barra.rehacer(redo) : es_MX.editor.barra.nadaQueRehacer;

  return (
    <div className="flex items-center gap-1" role="group" aria-label={es_MX.editor.barra.deshacerRehacer}>
      <Tooltip content={etiquetaDeshacer}>
        <Button variant="icono" data-testid="undo" onClick={undoOnce} disabled={!canUndo} aria-label={etiquetaDeshacer}>
          <IconoDeshacer size={20} tone="mono" />
        </Button>
      </Tooltip>
      <Tooltip content={etiquetaRehacer}>
        <Button variant="icono" data-testid="redo" onClick={redoOnce} disabled={!canRedo} aria-label={etiquetaRehacer}>
          <IconoRehacer size={20} tone="mono" />
        </Button>
      </Tooltip>
    </div>
  );
}
