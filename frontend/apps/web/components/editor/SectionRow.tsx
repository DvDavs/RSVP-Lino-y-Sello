"use client";

// components/editor/SectionRow.tsx — una fila de `SectionList` (04 §6.2). Tres formas de mover la
// MISMA fila producen la MISMA `reorderSections` (04 §14, E-03/E-04/E-05): el asa (ratón + teclado,
// `useSortable` de dnd-kit) y el menú `⋮` (alternativa sin arrastre, **requisito AA 2.5.7**).
//
// U-18 (`04 §20.1`): una sección `required: true` NO tiene interruptor — la fila dice "siempre
// visible". Nunca un interruptor deshabilitado y mudo (04 §7.1 paso 9).
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuButton, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu.tsx";
import { Switch } from "@/components/ui/switch.tsx";

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
      className={`flex items-center gap-1 rounded-ui-control border-l-3 py-1 pr-1.5 transition-colors ${
        isDragging ? "z-10 bg-ui-surface shadow-ui-2" : ""
      } ${seleccionada ? "border-ui-accent bg-ui-accent-soft" : "border-transparent hover:bg-ui-bg-alt"}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reordenar ${fila.title}`}
        data-testid={`section-handle-${fila.key}`}
        className="flex size-8 shrink-0 cursor-grab items-center justify-center rounded-ui-control text-ui-ink-muted hover:bg-white active:cursor-grabbing"
      >
        <GripVertical aria-hidden="true" className="size-4" />
      </button>

      <button
        type="button"
        onClick={onSeleccionar}
        aria-current={seleccionada ? "true" : undefined}
        className="min-h-11 flex-1 truncate rounded-ui-control px-1 text-left text-ui-aux font-semibold text-ui-ink"
      >
        {fila.title}
      </button>

      {fila.required ? (
        <span className="shrink-0 px-2 text-ui-eyebrow text-ui-ink-muted">Siempre visible</span>
      ) : (
        <Switch
          checked={fila.visible}
          onCheckedChange={onCambiarVisible}
          aria-label={fila.visible ? `Ocultar ${fila.title}` : `Mostrar ${fila.title}`}
          data-testid={`section-visible-${fila.key}`}
        />
      )}

      <DropdownMenu>
        <DropdownMenuButton label={`Más opciones de ${fila.title}`} data-testid={`section-menu-${fila.key}`} />
        <DropdownMenuContent>
          <DropdownMenuItem disabled={esPrimera} onSelect={onSubir} data-testid={`section-subir-${fila.key}`}>
            Subir
          </DropdownMenuItem>
          <DropdownMenuItem disabled={esUltima} onSelect={onBajar} data-testid={`section-bajar-${fila.key}`}>
            Bajar
          </DropdownMenuItem>
          <DropdownMenuItem disabled={esPrimera} onSelect={onMoverAlPrincipio}>
            Mover al principio
          </DropdownMenuItem>
          <DropdownMenuItem disabled={esUltima} onSelect={onMoverAlFinal}>
            Mover al final
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
