"use client";

// components/editor/SectionRow.tsx — una fila de `SectionList` (04 §6.2). Tres formas de mover la
// MISMA fila producen la MISMA `reorderSections` (04 §14, E-03/E-04/E-05): el asa (ratón + teclado,
// `useSortable` de dnd-kit) y el menú `⋮` (alternativa sin arrastre, **requisito AA 2.5.7**).
//
// U-18 (`04 §20.1`): una sección `required: true` NO tiene interruptor — la fila dice "siempre
// visible". Nunca un interruptor deshabilitado y mudo (04 §7.1 paso 9).
//
// Fase 3-C (`11 §7`, fila «Chrome del editor»): asa `IconoArrastrar`, icono de la sección, nombre,
// insignia «ejemplo», interruptor «Mostrar X» y menú. El botón que SELECCIONA la sección lleva por
// nombre accesible EXACTAMENTE el título (el icono es decorativo y la insignia va fuera del botón):
// `e2e/secciones.spec.ts` lo nombra con `{ name: "Portada", exact: true }`.
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ComponentType } from "react";
import { Badge, Switch } from "@invitaciones/ui";
import { IconoArrastrar, type IconProps } from "@invitaciones/icons";
import { MenuDeFila, opcionesDeReordenar } from "./MenuDeFila.tsx";
import { es_MX } from "@/lib/i18n.ts";

export interface SectionRowData {
  key: string;
  title: string;
  visible: boolean;
  required: boolean;
}

export interface SectionRowProps {
  fila: SectionRowData;
  seleccionada: boolean;
  esPrimera: boolean;
  esUltima: boolean;
  /** Icono de la sección (`11 §4.2`); ausente si el tipo todavía no está en el mapa. */
  Icono?: ComponentType<IconProps>;
  /** La sección conserva contenido de ejemplo (`report.stillDefault`, H-03). */
  conEjemplo?: boolean;
  onSeleccionar: () => void;
  onCambiarVisible: (visible: boolean) => void;
  onSubir: () => void;
  onBajar: () => void;
  onMoverAlPrincipio: () => void;
  onMoverAlFinal: () => void;
}

export function SectionRow({
  fila,
  seleccionada,
  esPrimera,
  esUltima,
  Icono,
  conEjemplo,
  onSeleccionar,
  onCambiarVisible,
  onSubir,
  onBajar,
  onMoverAlPrincipio,
  onMoverAlFinal,
}: SectionRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: fila.key });
  const estilo = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li
      ref={setNodeRef}
      style={estilo}
      data-testid={`section-row-${fila.key}`}
      className={`relative flex items-center gap-1 rounded-ui-card border-l-[3px] pr-1 transition-colors duration-200 ease-ui-out ${
        isDragging ? "z-10 bg-ui-surface-raised shadow-ui-2" : ""
      } ${seleccionada ? "border-l-ui-primary bg-ui-primary-soft" : "border-l-transparent hover:bg-ui-surface-alt"}`}
    >
      {/*
        SELECCIONAR la sección es la acción principal de la fila, así que el objetivo es LA FILA
        ENTERA (2.5.8 con margen de sobra), no el trozo de texto que quede libre entre el asa, el
        interruptor y el menú. Se implementa con un botón estirado por debajo: su nombre accesible
        es exactamente el título («Portada»), el contenido visible va encima con
        `pointer-events-none` para que el clic lo atraviese, y los tres controles de la derecha se
        levantan con `z-10` para conservar el suyo.
      */}
      <button
        type="button"
        onClick={onSeleccionar}
        aria-current={seleccionada ? "true" : undefined}
        className="absolute inset-0 rounded-ui-card focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface"
      >
        <span className="sr-only">{fila.title}</span>
      </button>

      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={es_MX.editor.seccion.reordenar(fila.title)}
        data-testid={`section-handle-${fila.key}`}
        className="relative z-10 inline-flex size-11 shrink-0 cursor-grab items-center justify-center rounded-ui-pill text-ui-ink-muted transition-colors duration-100 ease-ui-out hover:bg-ui-surface-raised hover:text-ui-ink active:cursor-grabbing focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface"
      >
        <IconoArrastrar size={18} tone="mono" />
      </button>

      <span
        aria-hidden="true"
        className="pointer-events-none relative z-10 flex min-h-11 min-w-0 flex-1 items-center gap-2 px-1 text-sm font-semibold text-ui-ink"
      >
        {Icono ? <Icono size={20} className="shrink-0" /> : null}
        <span className="truncate">{fila.title}</span>
      </span>

      {conEjemplo ? (
        <Badge tone="warning" className="pointer-events-none relative z-10 hidden shrink-0 sm:inline-flex">
          {es_MX.editor.seccion.ejemplo}
        </Badge>
      ) : null}

      {fila.required ? (
        <Badge tone="neutro" className="pointer-events-none relative z-10 shrink-0">
          {es_MX.editor.seccion.siempreVisible}
        </Badge>
      ) : (
        <Switch
          checked={fila.visible}
          onCheckedChange={onCambiarVisible}
          aria-label={fila.visible ? es_MX.editor.seccion.ocultar(fila.title) : es_MX.editor.seccion.mostrar(fila.title)}
          data-testid={`section-visible-${fila.key}`}
          className="relative z-10 shrink-0"
        />
      )}

      <MenuDeFila
        etiqueta={es_MX.editor.seccion.masOpciones(fila.title)}
        className="relative z-10"
        testId={`section-menu-${fila.key}`}
        opciones={opcionesDeReordenar({
          esPrimera,
          esUltima,
          onSubir,
          onBajar,
          onMoverAlPrincipio,
          onMoverAlFinal,
          textos: es_MX.editor.seccion,
          testIdSubir: `section-subir-${fila.key}`,
          testIdBajar: `section-bajar-${fila.key}`,
        })}
      />
    </li>
  );
}
