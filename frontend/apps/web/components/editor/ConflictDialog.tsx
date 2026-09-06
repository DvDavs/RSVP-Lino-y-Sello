"use client";

// components/editor/ConflictDialog.tsx — conflicto de `baseRevision` (04 §12.6 (b), ADR-1R-F-05).
//
// TRES opciones explícitas y **sin rebase automático**: `contratos.md` §2 fija "sin colaboración en
// tiempo real", y un rebase silencioso es una forma encubierta de fusión que puede perder
// escrituras sin que nadie lo note. Mientras el diálogo está abierto, `saveState === "conflict"`,
// `pump()` no envía nada y la edición del panel queda deshabilitada para no agrandar la cola.
//
// La opción por defecto es la CONSERVADORA (traer la versión nueva). La opción 2 nunca envía nada
// sin haber mostrado antes la lista de lo que se descartaría.
//
// Fase 3-C: `Dialog` de `@invitaciones/ui` con `busy` SIEMPRE activo. `busy` es el estado «ocupado»
// de `11 §5`: bloquea Esc y el clic fuera y deshabilita el aspa — que es literalmente lo que exige
// `04 §12.6` (de aquí no se sale sin elegir; el editor está detenido hasta entonces). `11 §5` pide
// que «ocupado» lleve siempre una explicación visible: es la frase `hayQueElegir`.
import { useState } from "react";
import { Button, Dialog, RadioGroup } from "@invitaciones/ui";
import { es_MX } from "@/lib/i18n";
import { useEditorStore, type ConflictChoice } from "@/lib/store";

export function ConflictDialog() {
  const conflicto = useEditorStore((s) => s.conflict);
  const resolver = useEditorStore((s) => s.resolveConflict);
  const [eleccion, setEleccion] = useState<ConflictChoice>("discard-mine");
  const [ocupado, setOcupado] = useState(false);

  if (!conflicto) return null;
  const n = conflicto.pending.length;
  const rebase = conflicto.rebase;
  const textos = es_MX.editor.conflicto;

  return (
    <Dialog
      open
      busy
      title={textos.titulo}
      description={textos.intro(n)}
      className="max-w-[34rem]"
      footer={
        <Button
          data-testid="conflict-continue"
          loading={ocupado}
          loadingText={es_MX.comun.cargando}
          onClick={() => {
            setOcupado(true);
            void resolver(rebase === null ? eleccion : "rebase").finally(() => setOcupado(false));
          }}
        >
          {rebase === null ? textos.continuar : textos.aplicarLosQueSePuedan}
        </Button>
      }
    >
      <div data-testid="conflict-dialog" className="flex flex-col gap-4">
        <p className="text-sm text-ui-ink-muted">{textos.hayQueElegir}</p>

        {rebase === null ? (
          <>
            <RadioGroup
              value={eleccion}
              onValueChange={(v) => setEleccion(v as ConflictChoice)}
              aria-label={textos.queHacer}
              opciones={[
                { value: "discard-mine", label: textos.traerLaNueva(n) },
                {
                  value: "rebase",
                  label: (
                    <span className="flex flex-col gap-0.5">
                      <span>{textos.intentarAplicar(n)}</span>
                      <span className="text-xs text-ui-ink-muted">{textos.intentarAplicarDetalle}</span>
                    </span>
                  ),
                },
                { value: "review", label: textos.verMisCambios },
              ]}
            />
            {eleccion === "review" ? <ListaDeCambios labels={conflicto.labels} /> : null}
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-md text-ui-ink">{textos.resumenRebase(rebase.aplicables.length, rebase.descartadas.length)}</p>
            <ul className="max-h-48 overflow-y-auto rounded-ui-control bg-ui-surface-alt p-3 text-sm text-ui-ink">
              {rebase.descartadas.length === 0 ? (
                <li>{textos.seAplicanTodos}</li>
              ) : (
                rebase.descartadas.map((d, i) => (
                  <li key={i} className="py-0.5">
                    {d.op.op} — {d.motivo}
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </Dialog>
  );
}

/** Opción 3: los cambios pendientes en lenguaje natural (`UndoEntry.label`), no ids ni JSON. */
function ListaDeCambios({ labels }: { labels: string[] }) {
  return (
    <ul className="max-h-40 overflow-y-auto rounded-ui-control bg-ui-surface-alt p-3 text-sm text-ui-ink">
      {labels.length === 0 ? (
        <li>{es_MX.editor.conflicto.sinDescripcion}</li>
      ) : (
        labels.map((l, i) => (
          <li key={i} className="py-0.5">
            {l}
          </li>
        ))
      )}
    </ul>
  );
}
