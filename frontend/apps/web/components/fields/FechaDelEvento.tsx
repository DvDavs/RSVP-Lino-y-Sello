"use client";

// components/fields/FechaDelEvento.tsx — el `[Editar allí]` de `04 §6.3`, por fin con destino.
//
// U-3 / I-06. La fecha de la boda salía con candado y «Se toma de los datos de tu invitación», sin
// decir dónde; y no había dónde: NINGUNA ruta de cliente escribía `invitation.date` — sólo
// `PUT /admin/invitations/{id}` con rol ADMIN. La fase 3-B abre
// `PUT /editor/invitations/{invitationId}/event` (`03 §3.20`, `ADR-3B-I06-01`) y este componente es
// su superficie: el «allí» es AQUÍ, en el mismo panel donde la clienta ya está mirando la fecha.
//
// Por qué NO es un `ScalarBlockField` más: `cover.date` es un bloque `business` (R4). Su valor no
// vive en `document.content` y escribirlo con `setBlock` es `422 TPL_BLOCK_NOT_EDITABLE` por
// invariante I-21 — el editor guardaría algo que la composición ignora siempre y la clienta creería
// haber cambiado la fecha sin haberla cambiado (el motivo por el que ADR-3-8-06 descartó hacer el
// campo editable). Por eso este control no produce ninguna operación, no entra en la pila de undo y
// no pasa por el autoguardado: llama a su ruta y relee.
import { CalendarDays } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { ApiError } from "@/lib/errors.ts";
import { es_MX } from "@/lib/i18n.ts";
import { useEditorStore } from "@/lib/store.ts";
import { CLASES_CONTROL, describedByPara, idsAyudaError } from "./FieldShell.tsx";

export interface FechaDelEventoProps {
  /** Etiqueta del `BlockSpec` («Fecha del evento»): la misma que ve el lienzo. */
  label: string;
  /** `YYYY-MM-DD` tal como está guardado hoy; `""` si la invitación aún no tiene fecha. */
  valor: string;
  /** Ya formateado por el servidor (R6): aquí NUNCA se formatea una fecha (H-27). */
  formateado: string;
}

type Estado = "reposo" | "editando" | "guardando" | "guardada";

export function FechaDelEvento({ label, valor, formateado }: FechaDelEventoProps) {
  const id = useId();
  const { helpId, errorId } = idsAyudaError(id);
  const [estado, setEstado] = useState<Estado>("reposo");
  const [borrador, setBorrador] = useState(valor);
  const [error, setError] = useState<string | null>(null);
  const [hayQueRepublicar, setHayQueRepublicar] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => setBorrador(valor), [valor]);
  useEffect(() => {
    if (estado === "editando") campo.current?.focus();
  }, [estado]);

  async function guardar(): Promise<void> {
    if (!borrador) return;
    setEstado("guardando");
    setError(null);
    try {
      const respuesta = await useEditorStore.getState().cambiarFechaDelEvento(borrador);
      setHayQueRepublicar(respuesta.releaseStale);
      setEstado("guardada");
    } catch (fallo: unknown) {
      // El servidor es el único validador del formato (no se duplica aquí: sería H-27). Su código
      // tipado se traduce a la frase es-MX del editor; cualquier otro fallo tiene la suya.
      const esFormato = fallo instanceof ApiError && fallo.code === "TPL_EVENT_DATE_INVALID";
      setError(esFormato ? es_MX.editor.fechaEvento.formatoInvalido : es_MX.editor.fechaEvento.sinGuardar);
      setEstado("editando");
    }
  }

  function cancelar(): void {
    setBorrador(valor);
    setError(null);
    setEstado("reposo");
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-ui-aux font-semibold text-ui-ink">{label}</span>

      {estado === "editando" || estado === "guardando" ? (
        <>
          <label htmlFor={id} className="sr-only">
            {es_MX.editor.fechaEvento.etiquetaCampo}
          </label>
          <input
            ref={campo}
            id={id}
            type="date"
            value={borrador}
            disabled={estado === "guardando"}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedByPara(id, {
              help: es_MX.editor.fechaEvento.explicacion,
              error: error ?? undefined,
            })}
            className={CLASES_CONTROL}
            onChange={(e) => setBorrador(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" busy={estado === "guardando"} disabled={!borrador} onClick={() => void guardar()}>
              {estado === "guardando" ? es_MX.editor.fechaEvento.guardando : es_MX.editor.fechaEvento.guardar}
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={estado === "guardando"} onClick={cancelar}>
              {es_MX.editor.fechaEvento.cancelar}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="rounded-ui-control bg-ui-bg-alt px-4 py-2.5 text-ui-body text-ui-ink">{formateado || "—"}</p>
          <div>
            <Button type="button" size="sm" variant="secondary" onClick={() => setEstado("editando")}>
              <CalendarDays aria-hidden="true" className="size-4" />
              {es_MX.editor.fechaEvento.abrir}
            </Button>
          </div>
        </>
      )}

      <p id={helpId} className="text-ui-eyebrow text-ui-ink-muted">
        {es_MX.editor.fechaEvento.explicacion}
      </p>

      {error ? (
        <p id={errorId} role="alert" className="text-ui-eyebrow text-ui-danger">
          {error}
        </p>
      ) : null}

      {estado === "guardada" ? (
        <p role="status" className="text-ui-eyebrow text-ui-ink-muted">
          {es_MX.editor.fechaEvento.guardada}
          {hayQueRepublicar ? <> {es_MX.editor.fechaEvento.republicar}</> : null}
        </p>
      ) : null}
    </div>
  );
}
