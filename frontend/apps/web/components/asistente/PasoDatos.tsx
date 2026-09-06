"use client";

// components/asistente/PasoDatos.tsx — paso 3 del asistente («Los datos básicos», `11 §7`:
// «¿Quiénes celebran?», «¿Cuándo?», «¿Dónde?» y «Puedes cambiarlos después»).
//
// Ningún campo es obligatorio y eso se dice con todas las letras: hay un «Lo lleno después» que
// avanza sin escribir nada. Las etiquetas de los nombres y del lugar las pone la PLANTILLA (llegan
// en el documento compuesto), no este archivo: en una boda se lee «Novio»/«Novia» y en unos XV años
// lo que esa plantilla llame a su homenajeada.
import { Field, Input } from "@invitaciones/ui";
import { es_MX } from "@/lib/i18n";
import type { CampoDeDatos, ValoresDeDatos } from "./datos-basicos.ts";

export interface PasoDatosProps {
  readonly campos: readonly CampoDeDatos[];
  readonly valores: ValoresDeDatos;
  readonly alCambiarValor: (id: string, valor: string) => void;
  readonly fecha: string;
  readonly hora: string;
  readonly alCambiarFecha: (valor: string) => void;
  readonly alCambiarHora: (valor: string) => void;
  readonly errorFecha: string | null;
  /** Fallo al guardar en el paso anterior de este mismo paso: se avisa y se deja continuar. */
  readonly errorGuardado: string | null;
}

export function PasoDatos({
  campos,
  valores,
  alCambiarValor,
  fecha,
  hora,
  alCambiarFecha,
  alCambiarHora,
  errorFecha,
  errorGuardado,
}: PasoDatosProps) {
  const quienes = campos.filter((c) => c.grupo === "quienes");
  const donde = campos.filter((c) => c.grupo === "donde");

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      {errorGuardado ? (
        <p role="alert" className="rounded-ui-control bg-ui-danger-soft px-4 py-3 text-sm text-ui-on-danger-soft">
          {errorGuardado}
        </p>
      ) : null}

      {quienes.length > 0 ? (
        <fieldset className="flex flex-col gap-4">
          <legend className="heading-sm mb-2 text-ui-ink">{es_MX.asistente.datos.quienes}</legend>
          {quienes.map((campo) => (
            <Field key={campo.id} label={campo.etiqueta}>
              <Input
                value={valores[campo.id] ?? ""}
                maxLength={campo.maxLength}
                autoComplete="off"
                onChange={(e) => alCambiarValor(campo.id, e.target.value)}
              />
            </Field>
          ))}
        </fieldset>
      ) : null}

      <fieldset className="flex flex-col gap-4">
        <legend className="heading-sm mb-2 text-ui-ink">{es_MX.asistente.datos.cuando}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={es_MX.asistente.datos.fecha}
            hint={es_MX.asistente.datos.fechaAyuda}
            error={errorFecha ?? undefined}
          >
            <Input type="date" value={fecha} onChange={(e) => alCambiarFecha(e.target.value)} />
          </Field>
          <Field label={es_MX.asistente.datos.hora}>
            <Input type="time" value={hora} onChange={(e) => alCambiarHora(e.target.value)} />
          </Field>
        </div>
      </fieldset>

      {donde.map((campo) => (
        <fieldset key={campo.id} className="flex flex-col gap-4">
          <legend className="heading-sm mb-2 text-ui-ink">{es_MX.asistente.datos.donde}</legend>
          <Field label={campo.etiqueta} hint={es_MX.asistente.datos.lugarAyuda}>
            <Input
              value={valores[campo.id] ?? ""}
              maxLength={campo.maxLength}
              autoComplete="off"
              onChange={(e) => alCambiarValor(campo.id, e.target.value)}
            />
          </Field>
        </fieldset>
      ))}
    </div>
  );
}
