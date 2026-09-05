"use client";

// components/editor/BlockForm.tsx — panel de contenido de UNA sección (04 §6.3, §7.1 paso 5): el
// "Diseño de la sección" (variante, si hay más de una) y un campo por bloque declarado en el
// `SectionSpec` del manifiesto. `react-hook-form` + resolver Zod vive DENTRO de cada campo
// (`components/fields/**`), construido desde el `BlockSpec` correspondiente — este archivo solo
// resuelve QUÉ campo pintar para cada bloque y si va de solo lectura.
import { ChevronLeft } from "lucide-react";
import type { ComposedBlock, ComposedGroup, ResolvedValue } from "@/lib/block-types.ts";
import { sectionRegistry } from "@invitaciones/sections";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group.tsx";
import { VariantDiagram } from "./VariantDiagram.tsx";
import { GroupField } from "./GroupField.tsx";
import { PhotoManager } from "./PhotoManager.tsx";
import { es_MX } from "@/lib/i18n.ts";
import { esEditable, etiqueta, explicacionSoloLectura, findSectionSpec, type ManifestStatus, type TemplateManifest } from "@/lib/manifest.ts";
import { useEditorStore } from "@/lib/store.ts";
import { ScalarBlockField, type ScalarSpec } from "@/components/fields/ScalarBlockField.tsx";
import { SoloLectura } from "@/components/fields/FieldShell.tsx";

const SIN_ELEMENTOS: never[] = [];

export function BlockForm({ invitationId, manifest, manifestStatus }: { invitationId: number; manifest: TemplateManifest | null; manifestStatus: ManifestStatus }) {
  const sectionKey = useEditorStore((s) => s.selection?.sectionKey ?? null);
  const composedSection = useEditorStore((s) => s.composed?.sections.find((sec) => sec.key === sectionKey) ?? null);
  const stillDefault = useEditorStore((s) => s.report?.stillDefault ?? SIN_ELEMENTOS);
  const rawContent = useEditorStore((s) => s.document?.content ?? null);
  const spec = sectionKey ? findSectionSpec(manifest, sectionKey) : null;

  function volver(): void {
    useEditorStore.getState().select(null);
    useEditorStore.getState().openPanel("sections");
  }

  if (!sectionKey || !composedSection) return null;

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={volver}
        className="flex h-9 items-center gap-1 self-start rounded-ui-control px-1 text-ui-aux font-semibold text-ui-accent hover:bg-ui-accent-soft"
      >
        <ChevronLeft aria-hidden="true" className="size-4" /> Volver a secciones
      </button>
      <h2 className="-mt-2 text-ui-eyebrow font-semibold uppercase tracking-[1.2px] text-ui-ink-muted">{composedSection.title}</h2>

      {manifestStatus === "loading" || manifestStatus === "idle" ? (
        <p role="status" className="text-ui-body text-ui-ink-muted">
          {es_MX.comun.cargando}
        </p>
      ) : !spec ? (
        <div role="status" className="rounded-ui-control bg-ui-bg-alt p-3.5 text-ui-aux text-ui-ink">
          <p>Por ahora no podemos mostrar las opciones de esta sección para editarlas aquí.</p>
          <p className="mt-1 text-ui-ink-muted">
            Puedes seguir mostrándola u ocultándola y reordenándola desde la lista; para el contenido, usa{" "}
            <a href={`/preview/${invitationId}`} target="_blank" rel="noreferrer" className="font-semibold text-ui-accent underline">
              la vista previa
            </a>{" "}
            mientras tanto.
          </p>
        </div>
      ) : (
        <>
          {spec.variants.length > 1 ? (
            <div className="flex flex-col gap-2">
              <span className="text-ui-aux font-semibold text-ui-ink">Diseño de la sección</span>
              <RadioGroup
                value={composedSection.variant}
                onValueChange={(v) => useEditorStore.getState().setSectionVariant(sectionKey, v)}
                className="flex flex-wrap gap-2"
              >
                {spec.variants.map((variante) => (
                  <label
                    key={variante}
                    className="flex cursor-pointer flex-col items-center gap-1 rounded-ui-control border border-ui-border-field p-1.5 has-[[data-state=checked]]:border-ui-accent has-[[data-state=checked]]:bg-ui-accent-soft"
                  >
                    <VariantDiagram variant={variante} />
                    <span className="flex items-center gap-1 text-ui-eyebrow text-ui-ink">
                      <RadioGroupItem value={variante} />
                      {etiquetaVariante(spec.type, variante)}
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </div>
          ) : null}

          {spec.blocks.map((blockSpec) => {
            if (blockSpec.type === "group") {
              const grupo = composedSection.blocks.find((b): b is ComposedGroup => "items" in b && b.id === blockSpec.id) ?? null;
              const esGaleria = blockSpec.role === "galleryPhotos";
              return (
                <div key={blockSpec.id} className="flex flex-col gap-1.5">
                  <span className="text-ui-aux font-semibold text-ui-ink">{etiqueta(blockSpec.label)}</span>
                  {blockSpec.help ? <p className="text-ui-eyebrow text-ui-ink-muted">{etiqueta(blockSpec.help)}</p> : null}
                  {esGaleria ? (
                    <PhotoManager
                      invitationId={invitationId}
                      spec={blockSpec}
                      groupId={blockSpec.id}
                      group={grupo}
                      maxItemBytes={imageMaxBytesDe(blockSpec) ?? 8_388_608}
                    />
                  ) : (
                    <GroupField invitationId={invitationId} spec={blockSpec} groupId={blockSpec.id} group={grupo} />
                  )}
                </div>
              );
            }

            const bloque = composedSection.blocks.find((b): b is ComposedBlock => !("items" in b) && b.id === blockSpec.id) ?? null;
            if (!esEditable(blockSpec)) {
              return (
                <SoloLectura
                  key={blockSpec.id}
                  label={etiqueta(blockSpec.label)}
                  valor={textoLegible(bloque?.value ?? null)}
                  explicacion={explicacionSoloLectura(blockSpec)}
                />
              );
            }

            const crudo = rawContent?.[blockSpec.id];
            return (
              <ScalarBlockField
                key={blockSpec.id}
                id={`campo-${blockSpec.id}`}
                invitationId={invitationId}
                spec={blockSpec as ScalarSpec}
                composedValue={bloque?.value ?? null}
                rawValue={crudo && crudo.kind !== "group" ? crudo : null}
                esContenidoDeEjemplo={stillDefault.includes(blockSpec.id)}
                onCommit={(valor) => useEditorStore.getState().setBlock(blockSpec.id, valor)}
              />
            );
          })}
        </>
      )}
    </div>
  );
}

/** Reusa las etiquetas es-MX YA verificadas de `sectionRegistry` (`packages/sections`, `04 §5.2`)
 *  en vez de duplicarlas — una sola fuente para el mismo texto que ve el lienzo. */
function etiquetaVariante(sectionType: keyof typeof sectionRegistry, id: string): string {
  return sectionRegistry[sectionType]?.variantLabels[id] ?? id;
}

function imageMaxBytesDe(spec: { itemBlocks: readonly ScalarSpec[] }): number | undefined {
  const imagen = spec.itemBlocks.find((b) => b.type === "image");
  return imagen && imagen.type === "image" ? imagen.constraints.maxBytes : undefined;
}

/** Texto legible para un bloque de SOLO LECTURA (business/fixed) — nunca deshabilitado y mudo. */
function textoLegible(value: ResolvedValue | null): string {
  if (!value) return "";
  switch (value.kind) {
    case "text":
      return value.value;
    case "richText":
      return value.doc.content.map((p) => p.content.map((s) => s.text).join("")).join(" ");
    case "listText":
      return value.items.join(", ");
    case "date":
      return value.formatted;
    case "time":
      return value.formatted;
    case "dateTimeRange":
      return value.formatted;
    case "link":
      return value.label ?? value.href;
    case "location":
      return [value.name, value.address].filter(Boolean).join(" — ");
    case "choice":
      return value.label;
    case "boolean":
      return value.value ? "Sí" : "No";
    case "person":
      return value.name;
    case "image":
    case "audio":
      return "";
  }
}
