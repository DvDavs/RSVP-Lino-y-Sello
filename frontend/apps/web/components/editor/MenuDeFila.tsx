"use client";

// components/editor/MenuDeFila.tsx — el menú «⋮» de una fila (sección, elemento de grupo, foto).
//
// Es la ALTERNATIVA SIN ARRASTRE que exige WCAG 2.2 AA 2.5.7 (`04 §14.4`): Subir / Bajar / Mover al
// principio / Mover al final, con la misma operación que produce el asa. Un asa accesible por
// teclado NO satisface el criterio: hay que cubrir a quien usa puntero y no puede arrastrar.
//
// Por qué vive aquí y no en `@invitaciones/ui`: el sistema de diseño del bloque 2 no tiene
// componente de menú (`11 §5` no lo inventaría) — ver el handoff de esta tarea. La base accesible
// sigue siendo Radix (`role="menu"`/`menuitem`, ↑/↓, Inicio/Fin, Esc, foco devuelto al disparador);
// el aspecto es 100 % de los tokens del sistema y el icono, del paquete de iconos.
import * as MenuPrimitivo from "@radix-ui/react-dropdown-menu";
import { twMerge } from "tailwind-merge";
import { IconoMenu } from "@invitaciones/icons";

export interface OpcionDeMenu {
  readonly id: string;
  readonly etiqueta: string;
  readonly onSelect: () => void;
  readonly disabled?: boolean;
  /** `data-testid` de la opción, cuando una prueba la nombra (p. ej. `section-subir-cover`). */
  readonly testId?: string;
}

export interface MenuDeFilaProps {
  /** Nombre accesible del disparador: «Más opciones de Portada». */
  readonly etiqueta: string;
  readonly opciones: readonly OpcionDeMenu[];
  readonly testId?: string;
  /** Clases extra del disparador (p. ej. fondo opaco sobre una miniatura). */
  readonly className?: string;
}

export function MenuDeFila({ etiqueta, opciones, testId, className }: MenuDeFilaProps) {
  return (
    <MenuPrimitivo.Root>
      <MenuPrimitivo.Trigger asChild>
        <button
          type="button"
          aria-label={etiqueta}
          data-testid={testId}
          className={twMerge(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-ui-pill text-ui-ink-muted transition-colors duration-100 ease-ui-out hover:bg-ui-surface-alt hover:text-ui-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface",
            className,
          )}
        >
          <IconoMenu size={20} tone="mono" />
        </button>
      </MenuPrimitivo.Trigger>
      <MenuPrimitivo.Portal>
        <MenuPrimitivo.Content
          sideOffset={4}
          align="end"
          className="z-50 min-w-52 rounded-ui-card bg-ui-surface-raised p-1.5 shadow-ui-2"
        >
          {opciones.map((opcion) => (
            <MenuPrimitivo.Item
              key={opcion.id}
              disabled={opcion.disabled}
              onSelect={opcion.onSelect}
              data-testid={opcion.testId}
              className="flex min-h-11 cursor-pointer select-none items-center rounded-ui-control px-3 text-sm text-ui-ink outline-none transition-colors duration-100 ease-ui-out data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45 data-[highlighted]:bg-ui-primary-soft data-[highlighted]:text-ui-on-primary-soft"
            >
              {opcion.etiqueta}
            </MenuPrimitivo.Item>
          ))}
        </MenuPrimitivo.Content>
      </MenuPrimitivo.Portal>
    </MenuPrimitivo.Root>
  );
}

/** Las cuatro opciones de reordenar, idénticas en secciones, grupos y fotos (`04 §14.4`). */
export function opcionesDeReordenar(acciones: {
  readonly esPrimera: boolean;
  readonly esUltima: boolean;
  readonly onSubir: () => void;
  readonly onBajar: () => void;
  readonly onMoverAlPrincipio: () => void;
  readonly onMoverAlFinal: () => void;
  readonly textos: { subir: string; bajar: string; moverAlPrincipio: string; moverAlFinal: string };
  readonly testIdSubir?: string;
  readonly testIdBajar?: string;
}): readonly OpcionDeMenu[] {
  return [
    { id: "subir", etiqueta: acciones.textos.subir, onSelect: acciones.onSubir, disabled: acciones.esPrimera, testId: acciones.testIdSubir },
    { id: "bajar", etiqueta: acciones.textos.bajar, onSelect: acciones.onBajar, disabled: acciones.esUltima, testId: acciones.testIdBajar },
    { id: "principio", etiqueta: acciones.textos.moverAlPrincipio, onSelect: acciones.onMoverAlPrincipio, disabled: acciones.esPrimera },
    { id: "final", etiqueta: acciones.textos.moverAlFinal, onSelect: acciones.onMoverAlFinal, disabled: acciones.esUltima },
  ];
}
