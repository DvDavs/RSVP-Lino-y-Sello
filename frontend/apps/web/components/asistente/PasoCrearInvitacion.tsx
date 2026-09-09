"use client";

// components/asistente/PasoCrearInvitacion.tsx — el alta que falta cuando la clienta llega SIN
// ninguna invitación a la que aplicarle una plantilla (agujero G-01,
// `docs/rediseno-plantillas/memoria/handoffs/5-1b-contrato-alta.md`). Antes de este encargo el
// asistente solo sabía trabajar sobre invitaciones que un ADMIN ya había dado de alta; ahora
// `POST /product/invitations` existe para el rol USER y este formulario es su puerta.
//
// Por qué pide el tipo de evento, la fecha Y la hora en UNA sola pantalla — y no el tipo aquí y la
// fecha en el paso 3 como el resto del asistente: el contrato exige las tres a la vez en el MISMO
// cuerpo (§2, los tres campos son obligatorios juntos). Partirlas en dos pasos dejaría un estado a
// medias que no se puede guardar en ningún sitio; las tres preguntas son, juntas, UN solo objetivo
// («empezar tu invitación»), no dos decisiones combinadas por ahorrar clics.
import { Button, Field, Input } from "@invitaciones/ui";
import type { EventKind } from "@invitaciones/schema";
import { es_MX } from "@/lib/i18n";
import { PasoTipoEvento } from "./PasoTipoEvento.tsx";

export interface PasoCrearInvitacionProps {
  readonly idTitulo: string;
  readonly tipoElegido: EventKind | null;
  readonly alSeleccionarTipo: (kind: EventKind) => void;
  readonly conteo: ReadonlyMap<EventKind, number>;
  readonly fecha: string;
  readonly hora: string;
  readonly hashtag: string;
  readonly alCambiarFecha: (valor: string) => void;
  readonly alCambiarHora: (valor: string) => void;
  readonly alCambiarHashtag: (valor: string) => void;
  readonly enviando: boolean;
  readonly error: string | null;
  readonly alEnviar: () => void;
}

export function PasoCrearInvitacion({
  idTitulo,
  tipoElegido,
  alSeleccionarTipo,
  conteo,
  fecha,
  hora,
  hashtag,
  alCambiarFecha,
  alCambiarHora,
  alCambiarHashtag,
  enviando,
  error,
  alEnviar,
}: PasoCrearInvitacionProps) {
  return (
    <section aria-labelledby={idTitulo} className="flex flex-col gap-6 rounded-ui-card border border-ui-divider bg-ui-surface-raised p-4 sm:p-6">
      <div className="flex flex-col gap-1.5">
        <h2 id={idTitulo} tabIndex={-1} className="heading-md text-ui-ink outline-none">
          {es_MX.asistente.crear.titulo}
        </h2>
        <p className="text-sm text-ui-ink-muted">{es_MX.asistente.crear.ayuda}</p>
      </div>

      {/* Plan 2 (contrato §7): se explica AQUÍ, antes de que elija plantilla, no después de un
          `403 TPL_PLAN_TIER_INSUFFICIENT` en el paso 2 — `11 §5`: nunca un fallo evitable. */}
      <p className="rounded-ui-control bg-ui-info-soft px-3.5 py-2.5 text-sm text-ui-on-info-soft">
        {es_MX.asistente.crear.planAyuda}
      </p>

      <PasoTipoEvento
        seleccionado={tipoElegido}
        alSeleccionar={alSeleccionarTipo}
        conteo={conteo}
        tipoDeLaInvitacion={null}
        idTitulo={idTitulo}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={es_MX.asistente.crear.fecha} hint={es_MX.asistente.crear.fechaAyuda}>
          <Input type="date" value={fecha} onChange={(e) => alCambiarFecha(e.target.value)} />
        </Field>
        <Field label={es_MX.asistente.crear.hora}>
          <Input type="time" value={hora} onChange={(e) => alCambiarHora(e.target.value)} />
        </Field>
      </div>

      <Field label={es_MX.asistente.crear.hashtag}>
        <Input value={hashtag} maxLength={100} autoComplete="off" onChange={(e) => alCambiarHashtag(e.target.value)} />
      </Field>

      {error ? (
        <p role="alert" className="rounded-ui-control bg-ui-danger-soft px-3.5 py-2.5 text-sm text-ui-on-danger-soft">
          {error}
        </p>
      ) : null}

      <div>
        <Button
          size="lg"
          loading={enviando}
          loadingText={es_MX.asistente.crear.creando}
          disabled={enviando}
          data-testid="asistente-crear-invitacion"
          onClick={alEnviar}
        >
          {es_MX.asistente.crear.boton}
        </Button>
      </div>
    </section>
  );
}
