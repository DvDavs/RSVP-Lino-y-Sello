"use client";

// components/editor/GroupField.tsx — campo del 14.º tipo de bloque: `group` (listas repetibles:
// padrinos, tarjetas del evento, opciones de regalo…). Igual que `SectionList` (04 §14): TRES vías
// para reordenar que llaman a la MISMA `moveItem` — asa + teclado (dnd-kit) y menú `⋮` sin arrastre
// (requisito AA 2.5.7). `GallerySection`/`galleryPhotos` usa `PhotoManager` en su lugar (04 §6.4);
// este componente es el genérico para el resto de grupos.
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, type ReactNode } from "react";
import { Button } from "@invitaciones/ui";
import { IconoAgregar, IconoArrastrar, IconoBorrar } from "@invitaciones/icons";
import type { GroupValue } from "@invitaciones/schema";
import type { ComposedGroup } from "@/lib/block-types.ts";
import { MenuDeFila, opcionesDeReordenar } from "./MenuDeFila.tsx";
import { crearAnuncios, INSTRUCCIONES_TECLADO } from "@/lib/dnd-announcements.ts";
import { es_MX } from "@/lib/i18n.ts";
import type { GroupSpec } from "@/lib/manifest.ts";
import { etiqueta } from "@/lib/manifest.ts";
import { useEditorStore } from "@/lib/store.ts";
import { ScalarBlockField } from "@/components/fields/ScalarBlockField.tsx";

export interface GroupFieldProps {
  invitationId: number;
  spec: GroupSpec;
  groupId: string;
  group: ComposedGroup | null;
}

export function GroupField({ invitationId, spec, groupId, group }: GroupFieldProps) {
  const rawGroup = useEditorStore((s) => {
    const crudo = s.document?.content?.[groupId];
    return crudo && typeof crudo === "object" && "kind" in crudo && crudo.kind === "group" ? (crudo as GroupValue) : null;
  });
  const items = group?.items ?? [];
  const claves = useMemo(() => items.map((it) => it.itemId), [items]);
  const nombres = useMemo(
    () => new Map(items.map((it, i) => [it.itemId, `${etiqueta(spec.itemLabel)} ${i + 1}`])),
    [items, spec.itemLabel],
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function mover(itemId: string, toIndex: number): void {
    useEditorStore.getState().moveItem(groupId, itemId, toIndex);
  }

  function alTerminarArrastre({ active, over }: DragEndEvent): void {
    if (!over || active.id === over.id) return;
    const hasta = claves.indexOf(String(over.id));
    if (hasta === -1) return;
    mover(String(active.id), hasta);
  }

  const anuncios = crearAnuncios((id) => nombres.get(id) ?? id, (id) => claves.indexOf(id) + 1, claves.length);
  const puedeAgregar = items.length < spec.max;
  const puedeQuitar = items.length > spec.min;

  return (
    <div className="flex flex-col gap-3">
      {spec.min > 0 && items.length < spec.min ? (
        <p role="alert" className="text-xs font-semibold text-ui-danger-text">
          {es_MX.editor.seccion.alMinimo(spec.min)}
        </p>
      ) : null}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{ screenReaderInstructions: INSTRUCCIONES_TECLADO, announcements: anuncios }}
        onDragEnd={alTerminarArrastre}
      >
        <SortableContext items={claves} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-3">
            {items.map((item, i) => (
              <GroupItemCard
                key={item.itemId}
                titulo={nombres.get(item.itemId) ?? `Elemento ${i + 1}`}
                itemId={item.itemId}
                esPrimera={i === 0}
                esUltima={i === items.length - 1}
                puedeQuitar={puedeQuitar}
                onQuitar={() => useEditorStore.getState().removeItem(groupId, item.itemId)}
                onSubir={() => i > 0 && mover(item.itemId, i - 1)}
                onBajar={() => i < items.length - 1 && mover(item.itemId, i + 1)}
                onMoverAlPrincipio={() => i > 0 && mover(item.itemId, 0)}
                onMoverAlFinal={() => i < items.length - 1 && mover(item.itemId, items.length - 1)}
              >
                <div className="flex flex-col gap-3">
                  {spec.itemBlocks.map((itemBlockSpec) => {
                    const bloqueCompuesto = item.blocks.find((b) => b.id === itemBlockSpec.id) ?? null;
                    const valorCrudo = rawGroup?.items.find((it) => it.itemId === item.itemId)?.values[itemBlockSpec.id] ?? null;
                    return (
                      <ScalarBlockField
                        key={itemBlockSpec.id}
                        id={`campo-${groupId}-${item.itemId}-${itemBlockSpec.id}`}
                        invitationId={invitationId}
                        spec={itemBlockSpec}
                        composedValue={bloqueCompuesto?.value ?? null}
                        rawValue={valorCrudo}
                        onCommit={(valor) => useEditorStore.getState().setItemBlock(groupId, item.itemId, itemBlockSpec.id, valor)}
                      />
                    );
                  })}
                </div>
              </GroupItemCard>
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <Button
        variant="secundario"
        size="sm"
        disabled={!puedeAgregar}
        onClick={() => useEditorStore.getState().addItem(groupId, {})}
        className="self-start"
      >
        <IconoAgregar size={18} tone="mono" />
        {es_MX.editor.seccion.agregar(etiqueta(spec.itemLabel).toLowerCase())}
      </Button>
      {!puedeAgregar ? <p className="text-xs text-ui-ink-muted">{es_MX.editor.seccion.alMaximo(spec.max)}</p> : null}
    </div>
  );
}

function GroupItemCard({
  titulo,
  itemId,
  esPrimera,
  esUltima,
  puedeQuitar,
  onQuitar,
  onSubir,
  onBajar,
  onMoverAlPrincipio,
  onMoverAlFinal,
  children,
}: {
  titulo: string;
  itemId: string;
  esPrimera: boolean;
  esUltima: boolean;
  puedeQuitar: boolean;
  onQuitar: () => void;
  onSubir: () => void;
  onBajar: () => void;
  onMoverAlPrincipio: () => void;
  onMoverAlFinal: () => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: itemId });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-ui-card bg-ui-surface-raised p-3.5 shadow-ui-1 ${isDragging ? "z-10 shadow-ui-2" : ""}`}
    >
      <div className="mb-2.5 flex items-center gap-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={es_MX.editor.seccion.reordenar(titulo)}
          className="inline-flex size-11 shrink-0 cursor-grab items-center justify-center rounded-ui-pill text-ui-ink-muted transition-colors duration-100 ease-ui-out hover:bg-ui-surface-alt hover:text-ui-ink active:cursor-grabbing focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface-raised"
        >
          <IconoArrastrar size={18} tone="mono" />
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ui-ink">{titulo}</span>
        <MenuDeFila
          etiqueta={es_MX.editor.seccion.masOpciones(titulo)}
          opciones={opcionesDeReordenar({
            esPrimera,
            esUltima,
            onSubir,
            onBajar,
            onMoverAlPrincipio,
            onMoverAlFinal,
            textos: es_MX.editor.seccion,
          })}
        />
        <Button
          variant="icono"
          size="sm"
          disabled={!puedeQuitar}
          aria-label={es_MX.editor.seccion.quitar(titulo)}
          onClick={onQuitar}
          className="text-ui-danger-text hover:bg-ui-danger-soft"
        >
          <IconoBorrar size={18} tone="mono" />
        </Button>
      </div>
      {children}
    </li>
  );
}
