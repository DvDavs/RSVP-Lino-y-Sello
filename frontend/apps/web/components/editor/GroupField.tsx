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
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import type { GroupValue } from "@invitaciones/schema";
import type { ComposedGroup } from "@/lib/block-types.ts";
import { DropdownMenu, DropdownMenuButton, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu.tsx";
import { crearAnuncios, INSTRUCCIONES_TECLADO } from "@/lib/dnd-announcements.ts";
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
        <p role="alert" className="text-ui-eyebrow text-ui-danger">
          Agrega al menos {spec.min} {spec.min === 1 ? "elemento" : "elementos"}.
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
      <button
        type="button"
        disabled={!puedeAgregar}
        onClick={() => useEditorStore.getState().addItem(groupId, {})}
        className="flex h-10 items-center gap-1.5 self-start rounded-ui-control border border-dashed border-ui-border-field px-3.5 text-ui-aux font-semibold text-ui-primary disabled:opacity-40"
      >
        <Plus aria-hidden="true" className="size-4" /> Agregar {etiqueta(spec.itemLabel).toLowerCase()}
      </button>
      {!puedeAgregar ? <p className="text-ui-eyebrow text-ui-ink-muted">Alcanzaste el máximo de {spec.max}.</p> : null}
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
      className={`rounded-ui-card border border-ui-border bg-white p-3.5 ${isDragging ? "z-10 shadow-ui-2" : ""}`}
    >
      <div className="mb-2.5 flex items-center gap-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reordenar ${titulo}`}
          className="flex size-8 shrink-0 cursor-grab items-center justify-center rounded-ui-control text-ui-ink-muted hover:bg-ui-bg-alt active:cursor-grabbing"
        >
          <GripVertical aria-hidden="true" className="size-4" />
        </button>
        <span className="flex-1 text-ui-aux font-semibold text-ui-ink">{titulo}</span>
        <DropdownMenu>
          <DropdownMenuButton label={`Más opciones de ${titulo}`} />
          <DropdownMenuContent>
            <DropdownMenuItem disabled={esPrimera} onSelect={onSubir}>
              Subir
            </DropdownMenuItem>
            <DropdownMenuItem disabled={esUltima} onSelect={onBajar}>
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
        <button
          type="button"
          disabled={!puedeQuitar}
          aria-label={`Quitar ${titulo}`}
          onClick={onQuitar}
          className="flex size-8 shrink-0 items-center justify-center rounded-ui-control text-ui-danger hover:bg-red-50 disabled:opacity-30"
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </button>
      </div>
      {children}
    </li>
  );
}
