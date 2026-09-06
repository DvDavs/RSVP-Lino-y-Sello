"use client";

// components/asistente/PasoTipoEvento.tsx — paso 1 del asistente («¿Qué vamos a celebrar?»,
// `11 §7`). Ocho cuadros con icono propio y el placeholder del sistema; el que corresponde al tipo
// registrado de la invitación viene preseleccionado y marcado.
//
// Patrón de teclado: grupo de radios de ARIA con tabulación itinerante (una sola parada de
// tabulación para todo el grupo; flechas para moverse, y moverse SELECCIONA, como en un `<input
// type="radio">` nativo). Se implementa a mano y no con `RadioGroup` de `@invitaciones/ui` porque
// ese componente pinta filas de texto y aquí cada opción es una tarjeta con imagen, icono y meta.
import type { EventKind } from "@invitaciones/schema";
import { Badge, Image } from "@invitaciones/ui";
import { useRef, type KeyboardEvent } from "react";
import { es_MX } from "@/lib/i18n";
import { TIPOS_DE_EVENTO, type TipoDeEvento } from "./tipos-de-evento.ts";

/** Dos tonos por tarjeta, alternados: el placeholder no es el mismo bloque de color ocho veces. */
const TONOS = [
  ["primary-soft", "support-2-soft"],
  ["support-1-soft", "primary-soft"],
  ["accent-soft", "support-1-soft"],
  ["support-2-soft", "accent-soft"],
] as const;

export interface PasoTipoEventoProps {
  readonly seleccionado: EventKind | null;
  readonly alSeleccionar: (kind: EventKind) => void;
  /** Cuántas plantillas publicadas hay de cada tipo (catálogo completo, sin filtrar). */
  readonly conteo: ReadonlyMap<EventKind, number>;
  /** Tipo con el que la invitación quedó registrada al contratarla, si se conoce. */
  readonly tipoDeLaInvitacion: EventKind | null;
  readonly idTitulo: string;
}

export function PasoTipoEvento({
  seleccionado,
  alSeleccionar,
  conteo,
  tipoDeLaInvitacion,
  idTitulo,
}: PasoTipoEventoProps) {
  const contenedor = useRef<HTMLDivElement>(null);

  function moverA(indice: number): void {
    const total = TIPOS_DE_EVENTO.length;
    const siguiente = TIPOS_DE_EVENTO[((indice % total) + total) % total];
    alSeleccionar(siguiente.kind);
    const botones = contenedor.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    botones?.[((indice % total) + total) % total]?.focus();
  }

  function alPulsarTecla(evento: KeyboardEvent<HTMLButtonElement>, indice: number): void {
    switch (evento.key) {
      case "ArrowRight":
      case "ArrowDown":
        evento.preventDefault();
        moverA(indice + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        evento.preventDefault();
        moverA(indice - 1);
        break;
      case "Home":
        evento.preventDefault();
        moverA(0);
        break;
      case "End":
        evento.preventDefault();
        moverA(TIPOS_DE_EVENTO.length - 1);
        break;
      default:
        break;
    }
  }

  return (
    <div
      ref={contenedor}
      role="radiogroup"
      aria-labelledby={idTitulo}
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
    >
      {TIPOS_DE_EVENTO.map((tipo, indice) => (
        <TarjetaDeTipo
          key={tipo.kind}
          tipo={tipo}
          indice={indice}
          marcada={seleccionado === tipo.kind}
          esElDeLaInvitacion={tipoDeLaInvitacion === tipo.kind}
          plantillas={conteo.get(tipo.kind) ?? 0}
          // Tabulación itinerante: la marcada es la única parada; sin ninguna marcada, la primera.
          tabulable={seleccionado === null ? indice === 0 : seleccionado === tipo.kind}
          alSeleccionar={() => alSeleccionar(tipo.kind)}
          alPulsarTecla={(e) => alPulsarTecla(e, indice)}
        />
      ))}
    </div>
  );
}

interface TarjetaDeTipoProps {
  readonly tipo: TipoDeEvento;
  readonly indice: number;
  readonly marcada: boolean;
  readonly esElDeLaInvitacion: boolean;
  readonly plantillas: number;
  readonly tabulable: boolean;
  readonly alSeleccionar: () => void;
  readonly alPulsarTecla: (evento: KeyboardEvent<HTMLButtonElement>) => void;
}

function TarjetaDeTipo({
  tipo,
  indice,
  marcada,
  esElDeLaInvitacion,
  plantillas,
  tabulable,
  alSeleccionar,
  alPulsarTecla,
}: TarjetaDeTipoProps) {
  const tonos = TONOS[indice % TONOS.length];
  const meta = plantillas === 0 ? es_MX.asistente.evento.sinPlantillas : es_MX.asistente.evento.plantillas(plantillas);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={marcada}
      tabIndex={tabulable ? 0 : -1}
      onClick={alSeleccionar}
      onKeyDown={alPulsarTecla}
      data-tipo={tipo.kind}
      className={[
        "flex h-full flex-col gap-3 rounded-ui-card border-2 bg-ui-surface-raised p-3 text-left",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface",
        marcada ? "border-ui-primary bg-ui-surface-alt" : "border-ui-divider hover:border-ui-primary",
      ].join(" ")}
    >
      <Image
        decorative
        mask="radius-lg"
        ratio="4 / 3"
        src={tipo.imagenSrc}
        imageId={tipo.imagenId}
        tones={tonos}
        className="w-full"
      />
      <span className="flex items-start gap-2">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-ui-pill bg-ui-primary-soft text-ui-on-primary-soft">
          <tipo.Icono size={20} />
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="heading-sm text-ui-ink">{tipo.nombre}</span>
          <span className="text-xs text-ui-ink-muted">{meta}</span>
          {esElDeLaInvitacion ? <Badge tone="primary">{es_MX.asistente.evento.tuTipo}</Badge> : null}
        </span>
      </span>
    </button>
  );
}
