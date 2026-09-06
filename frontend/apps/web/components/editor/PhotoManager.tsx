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
import { useMemo, useRef, useState } from "react";
import { Button, ProgressRing } from "@invitaciones/ui";
import { IconoAgregar, IconoArrastrar, IconoBorrar, IconoError } from "@invitaciones/icons";
import type { ComposedGroup, ImageSpec } from "@/lib/block-types.ts";
import { MenuDeFila, opcionesDeReordenar } from "./MenuDeFila.tsx";
import { uploadAsset } from "@/lib/api-client.ts";
import { crearAnuncios, INSTRUCCIONES_TECLADO } from "@/lib/dnd-announcements.ts";
import { es_MX } from "@/lib/i18n.ts";
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
        setSubidas((s) => s.map((u) => (u.clave === clave ? { ...u, error: es_MX.editor.fotos.formatoNoAdmitido } : u)));
        continue;
      }
      if (archivo.size > maxItemBytes) {
        const mb = (maxItemBytes / (1024 * 1024)).toFixed(0);
        setSubidas((s) => s.map((u) => (u.clave === clave ? { ...u, error: es_MX.editor.fotos.pesaMasDe(mb) } : u)));
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ui-ink">{es_MX.editor.fotos.titulo(items.length, spec.max)}</h3>
        <Button size="sm" disabled={!puedeAgregar} onClick={() => inputRef.current?.click()}>
          <IconoAgregar size={18} tone="mono" />
          {es_MX.editor.fotos.agregar}
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{ screenReaderInstructions: INSTRUCCIONES_TECLADO, announcements: anuncios }}
        onDragEnd={alTerminarArrastre}
      >
        <SortableContext items={claves} strategy={rectSortingStrategy}>
          {/* Tres columnas SIEMPRE (antes cuatro en el panel de escritorio): con cuatro, la miniatura
              medía ~85 px y los tres controles de 36 px que van encima la tapaban entera y se salían
              por la derecha (revisión de calidad visual del cierre de 3-C). */}
          <ul className="grid grid-cols-3 gap-2.5">
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
        className="flex flex-col items-center gap-1.5 rounded-ui-media border-2 border-dashed border-ui-border bg-ui-surface-alt p-5 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length > 0) void subirArchivos(e.dataTransfer.files);
        }}
      >
        <p className="text-sm text-ui-ink">
          {es_MX.editor.fotos.soltarAqui}{" "}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-ui-control font-semibold text-ui-link underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface-alt"
          >
            {es_MX.editor.fotos.seleccionaArchivos}
          </button>
        </p>
        <p className="text-xs text-ui-ink-muted">
          {es_MX.editor.fotos.limites(Number((maxItemBytes / (1024 * 1024)).toFixed(0)), spec.max)}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={TIPOS_ACEPTADOS.join(",")}
        multiple
        className="sr-only"
        aria-label={es_MX.editor.fotos.elegirParaGaleria}
        onChange={(e) => {
          if (e.target.files) void subirArchivos(e.target.files);
          e.target.value = "";
        }}
      />

      {subidas.length > 0 ? (
        <div className="flex flex-col gap-2" role="status">
          {subidas.length > 1 ? (
            <p className="text-xs text-ui-ink-muted">
              {es_MX.editor.fotos.subiendoN(subidas.filter((s) => !s.error).length, subidas.length)}
            </p>
          ) : null}
          {subidas.map((u) => (
            <div key={u.clave} className="flex items-center gap-3">
              {u.error ? (
                <p role="alert" className="flex items-start gap-1.5 text-xs font-semibold text-ui-danger-text">
                  <IconoError size={16} tone="mono" className="mt-px shrink-0" />
                  <span>
                    <span className="block text-ui-ink-muted">{u.nombre}</span>
                    {u.error}
                  </span>
                </p>
              ) : (
                <>
                  <ProgressRing value={u.progreso} size={56} label={`Subiendo ${u.nombre}`} />
                  <span className="min-w-0 flex-1 truncate text-xs text-ui-ink-muted">{u.nombre}</span>
                </>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {!imageBlockId ? (
        <p role="alert" className="text-xs font-semibold text-ui-danger-text">
          {es_MX.editor.fotos.sinBloqueDeFoto}
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
      className={`relative aspect-square overflow-hidden rounded-ui-media bg-ui-surface-alt ${isDragging ? "z-10 shadow-ui-2" : ""}`}
    >
      {url ? (
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-xs text-ui-ink-muted">{es_MX.editor.fotos.foto(posicion)}</div>
      )}
      {/* Los tres controles van sobre PAPEL OPACO, nunca sobre la foto (`11 §3.4` R5): una pastilla
          `surface-raised` con sombra 1, no un velo ni un degradado. */}
      <div className="absolute inset-x-1 top-1 flex items-center justify-between gap-0.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={es_MX.editor.fotos.reordenarFoto(posicion)}
          className="inline-flex size-8 items-center justify-center rounded-ui-pill bg-ui-surface-raised text-ui-ink-muted shadow-ui-1 transition-colors duration-100 ease-ui-out hover:text-ui-ink active:cursor-grabbing focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface-alt"
        >
          <IconoArrastrar size={16} tone="mono" />
        </button>
        <span className="flex gap-0.5">
          <MenuDeFila
            etiqueta={es_MX.editor.fotos.masOpcionesFoto(posicion)}
            className="size-8 bg-ui-surface-raised shadow-ui-1"
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
          <button
            type="button"
            aria-label={es_MX.editor.fotos.quitarFoto(posicion)}
            onClick={onQuitar}
            className="inline-flex size-8 items-center justify-center rounded-ui-pill bg-ui-surface-raised text-ui-danger-text shadow-ui-1 transition-colors duration-100 ease-ui-out hover:bg-ui-danger-soft focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface-alt"
          >
            <IconoBorrar size={16} tone="mono" />
          </button>
        </span>
      </div>
    </li>
  );
}
