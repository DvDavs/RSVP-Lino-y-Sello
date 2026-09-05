"use client";

// components/editor/PhotoManager.tsx — gestor de fotos del grupo `galleryPhotos` (04 §6.4, §13, §14).
// Especialización de `GroupField` en cuadrícula: subir (arrastrar o elegir archivos), recortar
// (delegado en `ImageField`, que ya hace §13.2 completo), reordenar por asa+teclado o por el menú `⋮`
// sin arrastre (2.5.7), y quitar. La zona de soltar vive EN EL PANEL, nunca en el lienzo (§8.7).
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ImagePlus, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { ComposedGroup, ImageSpec } from "@/lib/block-types.ts";
import { DropdownMenu, DropdownMenuButton, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { uploadAsset } from "@/lib/api-client.ts";
import { crearAnuncios, INSTRUCCIONES_TECLADO } from "@/lib/dnd-announcements.ts";
import { mensajeDeErrorDeAsset } from "@/components/fields/ImageField.tsx";
import type { GroupSpec } from "@/lib/manifest.ts";
import { useEditorStore } from "@/lib/store.ts";

const TIPOS_ACEPTADOS = ["image/webp", "image/png", "image/jpeg"] as const;

export interface PhotoManagerProps {
  invitationId: number;
  spec: GroupSpec;
  groupId: string;
  group: ComposedGroup | null;
  maxItemBytes: number;
}

interface SubidaEnCurso {
  clave: string;
  nombre: string;
  progreso: number;
  error: string | null;
}

export function PhotoManager({ invitationId, spec, groupId, group, maxItemBytes }: PhotoManagerProps) {
  const items = group?.items ?? [];
  const imageBlockId = spec.itemBlocks.find((b): b is ImageSpec => b.type === "image")?.id ?? null;
  const claves = useMemo(() => items.map((it) => it.itemId), [items]);
  const [subidas, setSubidas] = useState<SubidaEnCurso[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
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

  const anuncios = crearAnuncios(
    (id) => `foto ${claves.indexOf(id) + 1}`,
    (id) => claves.indexOf(id) + 1,
    claves.length,
  );

  async function subirArchivos(archivos: FileList | File[]): Promise<void> {
    if (!imageBlockId) return;
    const lista = Array.from(archivos).slice(0, Math.max(0, spec.max - items.length));
    for (const archivo of lista) {
      const clave = `${archivo.name}-${archivo.size}-${Date.now()}`;
      setSubidas((s) => [...s, { clave, nombre: archivo.name, progreso: 0, error: null }]);
      if (!(TIPOS_ACEPTADOS as readonly string[]).includes(archivo.type)) {
        setSubidas((s) => s.map((u) => (u.clave === clave ? { ...u, error: "Formato no admitido. Usa JPG, PNG o WebP." } : u)));
        continue;
      }
      if (archivo.size > maxItemBytes) {
        const mb = (maxItemBytes / (1024 * 1024)).toFixed(0);
        setSubidas((s) => s.map((u) => (u.clave === clave ? { ...u, error: `Pesa más de ${mb} MB.` } : u)));
        continue;
      }
      const tempId = useEditorStore.getState().addItem(groupId, {});
      setSubidas((s) => s.map((u) => (u.clave === clave ? { ...u, progreso: 30 } : u)));
      try {
        const subida = await uploadAsset(invitationId, { data: archivo, contentType: archivo.type, bytes: archivo.size, filename: archivo.name });
        setSubidas((s) => s.map((u) => (u.clave === clave ? { ...u, progreso: 100 } : u)));
        useEditorStore.getState().setItemBlock(groupId, tempId, imageBlockId, {
          kind: "image",
          assetId: subida.assetId,
          alt: "",
          focal: { x: 0.5, y: 0.5 },
        });
        setSubidas((s) => s.filter((u) => u.clave !== clave));
      } catch (e: unknown) {
        setSubidas((s) => s.map((u) => (u.clave === clave ? { ...u, error: mensajeDeErrorDeAsset(e) } : u)));
        useEditorStore.getState().removeItem(groupId, tempId);
      }
    }
  }

  const puedeAgregar = items.length < spec.max;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-ui-aux font-semibold text-ui-ink">
          Galería — {items.length} de {spec.max} fotos
        </h3>
        <button
          type="button"
          disabled={!puedeAgregar}
          onClick={() => inputRef.current?.click()}
          className="flex h-9 items-center gap-1.5 rounded-ui-pill bg-ui-accent px-3.5 text-ui-aux font-semibold text-ui-accent-ink disabled:opacity-40"
        >
          <ImagePlus aria-hidden="true" className="size-4" /> Agregar
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{ screenReaderInstructions: INSTRUCCIONES_TECLADO, announcements: anuncios }}
        onDragEnd={alTerminarArrastre}
      >
        <SortableContext items={claves} strategy={rectSortingStrategy}>
          <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {items.map((item, i) => {
              const bloqueImagen = imageBlockId ? item.blocks.find((b) => b.id === imageBlockId) : undefined;
              const url = bloqueImagen?.value?.kind === "image" ? bloqueImagen.value.url : null;
              return (
                <PhotoTile
                  key={item.itemId}
                  itemId={item.itemId}
                  posicion={i + 1}
                  url={url}
                  esPrimera={i === 0}
                  esUltima={i === items.length - 1}
                  onQuitar={() => useEditorStore.getState().removeItem(groupId, item.itemId)}
                  onSubir={() => i > 0 && mover(item.itemId, i - 1)}
                  onBajar={() => i < items.length - 1 && mover(item.itemId, i + 1)}
                  onMoverAlPrincipio={() => i > 0 && mover(item.itemId, 0)}
                  onMoverAlFinal={() => i < items.length - 1 && mover(item.itemId, items.length - 1)}
                />
              );
            })}
          </ul>
        </SortableContext>
      </DndContext>

      <div
        className="flex flex-col items-center gap-1.5 rounded-ui-control border-2 border-dashed border-ui-border-field p-4 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length > 0) void subirArchivos(e.dataTransfer.files);
        }}
      >
        <p className="text-ui-aux text-ui-ink">
          Arrastra fotos aquí o{" "}
          <button type="button" onClick={() => inputRef.current?.click()} className="font-semibold text-ui-accent underline">
            selecciona archivos
          </button>
        </p>
        <p className="text-ui-eyebrow text-ui-ink-muted">
          JPG, PNG o WebP · hasta {(maxItemBytes / (1024 * 1024)).toFixed(0)} MB · máximo {spec.max} fotos
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={TIPOS_ACEPTADOS.join(",")}
        multiple
        className="sr-only"
        aria-label="Elegir fotos para la galería"
        onChange={(e) => {
          if (e.target.files) void subirArchivos(e.target.files);
          e.target.value = "";
        }}
      />

      {subidas.length > 0 ? (
        <div className="flex flex-col gap-2" role="status">
          {subidas.length > 1 ? (
            <p className="text-ui-eyebrow text-ui-ink-muted">
              Subiendo {subidas.filter((s) => !s.error).length} de {subidas.length}
            </p>
          ) : null}
          {subidas.map((u) => (
            <div key={u.clave} className="flex flex-col gap-1">
              <span className="truncate text-ui-eyebrow text-ui-ink-muted">{u.nombre}</span>
              {u.error ? (
                <p role="alert" className="text-ui-eyebrow text-ui-danger">
                  {u.error}
                </p>
              ) : (
                <Progress value={u.progreso} label={`Subiendo ${u.nombre}`} />
              )}
            </div>
          ))}
        </div>
      ) : null}

      {!imageBlockId ? (
        <p role="alert" className="text-ui-eyebrow text-ui-danger">
          Esta plantilla no declaró un bloque de foto dentro de la galería — avísanos para revisarlo.
        </p>
      ) : null}
    </div>
  );
}

function PhotoTile({
  itemId,
  posicion,
  url,
  esPrimera,
  esUltima,
  onQuitar,
  onSubir,
  onBajar,
  onMoverAlPrincipio,
  onMoverAlFinal,
}: {
  itemId: string;
  posicion: number;
  url: string | null;
  esPrimera: boolean;
  esUltima: boolean;
  onQuitar: () => void;
  onSubir: () => void;
  onBajar: () => void;
  onMoverAlPrincipio: () => void;
  onMoverAlFinal: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: itemId });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative aspect-square overflow-hidden rounded-ui-media bg-ui-bg-alt ${isDragging ? "z-10 shadow-ui-2" : ""}`}
    >
      {url ? (
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-ui-eyebrow text-ui-ink-muted">Foto {posicion}</div>
      )}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reordenar foto ${posicion}`}
        className="absolute left-1 top-1 flex size-7 items-center justify-center rounded-ui-control bg-white/90 text-ui-ink-muted shadow-ui-1 active:cursor-grabbing"
      >
        <GripVertical aria-hidden="true" className="size-3.5" />
      </button>
      <div className="absolute right-1 top-1 flex gap-1">
        <DropdownMenu>
          <DropdownMenuButton label={`Más opciones de la foto ${posicion}`} className="bg-white/90 shadow-ui-1" />
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
          aria-label={`Quitar foto ${posicion}`}
          onClick={onQuitar}
          className="flex size-7 items-center justify-center rounded-ui-control bg-white/90 text-ui-danger shadow-ui-1"
        >
          <Trash2 aria-hidden="true" className="size-3.5" />
        </button>
      </div>
    </li>
  );
}
