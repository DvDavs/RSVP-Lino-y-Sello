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
import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { useEditorStore, type ConflictChoice } from "@/lib/store";

export function ConflictDialog() {
  const conflicto = useEditorStore((s) => s.conflict);
  const resolver = useEditorStore((s) => s.resolveConflict);
  const [eleccion, setEleccion] = useState<ConflictChoice>("discard-mine");
  const [ocupado, setOcupado] = useState(false);

  if (!conflicto) return null;
  const n = conflicto.pending.length;
  const rebase = conflicto.rebase;

  return (
    <Dialog.Root open modal>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          data-testid="conflict-dialog"
          className="fixed left-1/2 top-1/2 z-50 w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-ui-card bg-ui-surface p-6 shadow-ui-2"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <Dialog.Title className="font-ui-display text-ui-card font-semibold text-ui-ink-heading">
            Esta invitación cambió en otro lugar
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-ui-body text-ui-ink">
            Alguien (o tú, en otro dispositivo) guardó cambios mientras editabas. Tienes {n}{" "}
            {n === 1 ? "cambio" : "cambios"} sin guardar.
          </Dialog.Description>

          {rebase === null ? (
            <fieldset className="mt-5 flex flex-col gap-3">
              <legend className="sr-only">Qué hacer con tus cambios</legend>
              <Opcion
                valor="discard-mine"
                actual={eleccion}
                onChange={setEleccion}
                titulo={`Traer la versión nueva y perder mis ${n} ${n === 1 ? "cambio" : "cambios"}`}
              />
              <Opcion
                valor="rebase"
                actual={eleccion}
                onChange={setEleccion}
                titulo={`Intentar aplicar mis ${n} ${n === 1 ? "cambio" : "cambios"} sobre la versión nueva`}
                detalle="Los revisaremos uno por uno; los que ya no apliquen se descartarán y te los mostraremos antes de enviar nada."
              />
              <Opcion
                valor="review"
                actual={eleccion}
                onChange={setEleccion}
                titulo="Ver mis cambios antes de decidir"
              />
              {eleccion === "review" ? <ListaDeCambios labels={conflicto.labels} /> : null}
            </fieldset>
          ) : (
            <div className="mt-5 flex flex-col gap-3">
              <p className="text-ui-body text-ui-ink">
                Se pueden aplicar {rebase.aplicables.length} de tus cambios. Estos {rebase.descartadas.length} ya no
                aplican sobre la versión nueva:
              </p>
              <ul className="max-h-48 overflow-y-auto rounded-ui-control bg-ui-bg-alt p-3 text-ui-aux text-ui-ink">
                {rebase.descartadas.length === 0 ? (
                  <li>Ninguno: se pueden aplicar todos.</li>
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

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              data-testid="conflict-continue"
              disabled={ocupado}
              aria-busy={ocupado || undefined}
              onClick={() => {
                setOcupado(true);
                void resolver(rebase === null ? eleccion : "rebase").finally(() => setOcupado(false));
              }}
              className="inline-flex h-11 items-center rounded-ui-pill bg-ui-primary px-5 text-ui-aux font-semibold text-ui-on-primary disabled:opacity-50"
            >
              {rebase === null ? "Continuar" : "Aplicar los que se puedan"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Opcion({
  valor,
  actual,
  onChange,
  titulo,
  detalle,
}: {
  valor: ConflictChoice;
  actual: ConflictChoice;
  onChange: (v: ConflictChoice) => void;
  titulo: string;
  detalle?: string;
}) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-ui-control border border-ui-border p-3 has-[:checked]:border-ui-primary has-[:checked]:bg-ui-primary-soft">
      <input
        type="radio"
        name="conflicto"
        value={valor}
        checked={actual === valor}
        onChange={() => onChange(valor)}
        className="mt-1 size-4 shrink-0 accent-[var(--color-ui-primary)]"
      />
      <span>
        <span className="block text-ui-body font-semibold text-ui-ink-strong">{titulo}</span>
        {detalle ? <span className="mt-0.5 block text-ui-aux text-ui-ink-muted">{detalle}</span> : null}
      </span>
    </label>
  );
}

/** Opción 3: los cambios pendientes en lenguaje natural (`UndoEntry.label`), no ids ni JSON. */
function ListaDeCambios({ labels }: { labels: string[] }) {
  return (
    <ul className="max-h-40 overflow-y-auto rounded-ui-control bg-ui-bg-alt p-3 text-ui-aux text-ui-ink">
      {labels.length === 0 ? (
        <li>No pudimos describir tus cambios pendientes.</li>
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
