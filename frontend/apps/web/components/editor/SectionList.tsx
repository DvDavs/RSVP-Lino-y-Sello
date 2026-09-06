"use client";

// components/editor/SectionList.tsx — lista de secciones del panel (04 §6.2, §14). Las TRES vías de
// reordenar (ratón, teclado, menú `⋮` sin arrastre) llaman a `arrayMove` y terminan en la MISMA
// `reorderSections` — es la garantía mecánica de que E-03/E-04/E-05 dan el mismo resultado.
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useMemo } from "react";
import { SectionRow } from "./SectionRow.tsx";
import { ICONO_DE_SECCION } from "./iconos-de-seccion.ts";
import { crearAnuncios, INSTRUCCIONES_TECLADO } from "@/lib/dnd-announcements.ts";
import { findSectionSpec, type TemplateManifest } from "@/lib/manifest.ts";
import { useEditorStore, useSectionRows } from "@/lib/store.ts";

const SIN_ELEMENTOS: readonly string[] = [];

export function SectionList({ manifest }: { manifest: TemplateManifest | null }) {
  const filas = useSectionRows();
  const selection = useEditorStore((s) => s.selection);
  // Insignia «ejemplo» por sección (H-03): una sección la lleva si alguno de sus bloques sigue con
  // el contenido por defecto de la plantilla (`report.stillDefault`, ids de BLOQUE, no de sección).
  const stillDefault = useEditorStore((s) => s.report?.stillDefault ?? SIN_ELEMENTOS);
  const secciones = useEditorStore((s) => s.composed?.sections);
  const conEjemplo = useMemo(() => {
    const pendientes = new Set(stillDefault);
    const marcadas = new Set<string>();
    for (const seccion of secciones ?? []) {
      if (seccion.blocks.some((b) => pendientes.has(b.id))) marcadas.add(seccion.key);
    }
    return marcadas;
  }, [secciones, stillDefault]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const claves = useMemo(() => filas.map((f) => f.key), [filas]);
  const titulos = useMemo(() => new Map(filas.map((f) => [f.key, f.title])), [filas]);

  function mover(nuevoOrden: string[]): void {
    if (nuevoOrden.join("|") === claves.join("|")) return;
    useEditorStore.getState().reorderSections(nuevoOrden);
  }

  function alTerminarArrastre({ active, over }: DragEndEvent): void {
    if (!over || active.id === over.id) return;
    const desde = claves.indexOf(String(active.id));
    const hasta = claves.indexOf(String(over.id));
    if (desde === -1 || hasta === -1) return;
    mover(arrayMove(claves, desde, hasta));
  }

  const anuncios = crearAnuncios(
    (id) => titulos.get(id) ?? id,
    (id) => claves.indexOf(id) + 1,
    claves.length,
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{ screenReaderInstructions: INSTRUCCIONES_TECLADO, announcements: anuncios }}
      onDragEnd={alTerminarArrastre}
    >
      <SortableContext items={claves} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-1">
          {filas.map((fila, i) => {
            const spec = findSectionSpec(manifest, fila.key);
            // Conservador (U-18): sin manifiesto (o sin spec para esta clave) NO sabemos si la
            // sección es obligatoria, así que se trata como si lo fuera — nunca se ofrece un
            // interruptor que podría llegar a ocultar una sección obligatoria por una carrera de
            // red o un manifiesto todavía sin sembrar. Solo se muestra el interruptor cuando el
            // manifiesto CONFIRMA `required: false`.
            const required = spec ? spec.required : true;
            return (
              <SectionRow
                key={fila.key}
                fila={{ key: fila.key, title: fila.title, visible: fila.visible, required }}
                seleccionada={selection?.sectionKey === fila.key}
                esPrimera={i === 0}
                esUltima={i === filas.length - 1}
                Icono={ICONO_DE_SECCION[fila.type]}
                conEjemplo={conEjemplo.has(fila.key)}
                onSeleccionar={() => {
                  useEditorStore.getState().select({ sectionKey: fila.key, blockId: fila.key });
                  useEditorStore.getState().openPanel("block");
                  useEditorStore.getState().scrollToSection(fila.key);
                }}
                onCambiarVisible={(visible) => useEditorStore.getState().setSectionVisible(fila.key, visible)}
                onSubir={() => i > 0 && mover(arrayMove(claves, i, i - 1))}
                onBajar={() => i < filas.length - 1 && mover(arrayMove(claves, i, i + 1))}
                onMoverAlPrincipio={() => i > 0 && mover(arrayMove(claves, i, 0))}
                onMoverAlFinal={() => i < filas.length - 1 && mover(arrayMove(claves, i, filas.length - 1))}
              />
            );
          })}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
