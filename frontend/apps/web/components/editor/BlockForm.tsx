"use client";

// components/editor/BlockForm.tsx — panel de contenido de UNA sección (04 §6.3, §7.1 paso 5): el
// "Diseño de la sección" (variante, si hay más de una) y un campo por bloque declarado en el
// `SectionSpec` del manifiesto. `react-hook-form` + resolver Zod vive DENTRO de cada campo
// (`components/fields/**`), construido desde el `BlockSpec` correspondiente — este archivo solo
// resuelve QUÉ campo pintar para cada bloque y si va de solo lectura.
import { Button, RadioGroup } from "@invitaciones/ui";
import { IconoAtras } from "@invitaciones/icons";
import type { ComposedBlock, ComposedGroup, ResolvedValue } from "@/lib/block-types.ts";
import { sectionRegistry } from "@invitaciones/sections";
import { VariantDiagram } from "./VariantDiagram.tsx";
import { GroupField } from "./GroupField.tsx";
import { PhotoManager } from "./PhotoManager.tsx";
import { es_MX } from "@/lib/i18n.ts";
import { esEditable, etiqueta, explicacionSoloLectura, findSectionSpec, type ManifestStatus, type TemplateManifest } from "@/lib/manifest.ts";
import { useEditorStore } from "@/lib/store.ts";
import { ScalarBlockField, type ScalarSpec } from "@/components/fields/ScalarBlockField.tsx";
import { SoloLectura } from "@/components/fields/FieldShell.tsx";
import { FechaDelEvento } from "@/components/fields/FechaDelEvento.tsx";

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
      <Button variant="terciario" size="sm" onClick={volver} className="self-start">
        <IconoAtras size={18} tone="mono" />
        {es_MX.editor.panel.volverASecciones}
      </Button>
      <h2 className="-mt-2 label-md text-ui-ink-muted">{composedSection.title}</h2>

      {manifestStatus === "loading" || manifestStatus === "idle" ? (
        <p role="status" className="text-md text-ui-ink-muted">
          {es_MX.comun.cargando}
        </p>
      ) : !spec ? (
        <div role="status" className="rounded-ui-card bg-ui-surface-alt p-3.5 text-sm text-ui-ink">
          <p>{es_MX.editor.panel.sinOpciones}</p>
          <p className="mt-1 text-ui-ink-muted">
            {es_MX.editor.panel.sinOpcionesSalida}{" "}
            <a href={`/preview/${invitationId}`} target="_blank" rel="noreferrer" className="font-semibold text-ui-link underline">
              {es_MX.editor.panel.sinOpcionesEnlace}
            </a>{" "}
            mientras tanto.
          </p>
        </div>
      ) : (
        <>
          {spec.variants.length > 1 ? (
            <fieldset className="flex flex-col gap-2">
              {/* `legend` y no un `<span>`: el grupo de radios tiene que llevar nombre accesible
                  propio (`04 §6.3`, «Diseño de la sección»). */}
              <legend className="text-sm font-semibold text-ui-ink">{es_MX.editor.panel.disenoDeLaSeccion}</legend>
              <RadioGroup
                value={composedSection.variant}
                onValueChange={(v) => useEditorStore.getState().setSectionVariant(sectionKey, v)}
                aria-label={es_MX.editor.panel.disenoDeLaSeccion}
                opciones={spec.variants.map((variante) => ({
                  value: variante,
                  // El diagrama es `aria-hidden`: el nombre accesible del radio es la etiqueta es-MX
                  // de `sectionRegistry` («Pantalla completa», «Enmarcada»), que es como lo nombran
                  // `e2e/paneles.spec.ts` y la clienta.
                  label: (
                    <span className="flex items-center gap-2">
                      <VariantDiagram variant={variante} />
                      {etiquetaVariante(spec.type, variante)}
                    </span>
                  ),
                }))}
              />
            </fieldset>
          ) : null}

          {spec.blocks.map((blockSpec) => {
            if (blockSpec.type === "group") {
              const grupo = composedSection.blocks.find((b): b is ComposedGroup => "items" in b && b.id === blockSpec.id) ?? null;
              const esGaleria = blockSpec.role === "galleryPhotos";
              return (
                <div key={blockSpec.id} className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-ui-ink">{etiqueta(blockSpec.label)}</span>
                  {blockSpec.help ? <p className="text-xs text-ui-ink-muted">{etiqueta(blockSpec.help)}</p> : null}
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

            // U-3 · `04 §6.3` «[Editar allí]», ahora CON destino (I-06, `ADR-3B-I06-01`): la fecha
            // del evento se cambia AQUÍ, con `PUT …/event`. Sigue sin ser un campo del documento
            // —es un bloque `business` y `setBlock` sobre él es `422 TPL_BLOCK_NOT_EDITABLE` por
            // I-21—, así que tiene su propio control y su propia ruta.
            if (blockSpec.source === "business" && blockSpec.businessField === "invitation.date") {
              const valor = bloque?.value;
              return (
                <FechaDelEvento
                  key={blockSpec.id}
                  label={etiqueta(blockSpec.label)}
                  valor={valor && valor.kind === "date" ? valor.value : ""}
                  formateado={valor && valor.kind === "date" ? valor.formatted : ""}
                />
              );
            }

            if (!esEditable(blockSpec)) {
              // El resto de bloques bloqueados sigue como estaba. Los `business` que NO son la fecha
              // (hashtag, «se admiten niños»…) todavía no tienen ruta de cliente que los escriba, así
              // que conservan el enlace a `/ayuda`; los `fixed` los define la plantilla y su
              // explicación ya se basta.
              const esDeNegocio = blockSpec.source === "business";
              return (
                <SoloLectura
                  key={blockSpec.id}
                  label={etiqueta(blockSpec.label)}
                  valor={textoLegible(bloque?.value ?? null)}
                  explicacion={esDeNegocio ? es_MX.editor.soloLectura.deLaInvitacion : explicacionSoloLectura(blockSpec)}
                  dondeSeCambia={
                    esDeNegocio ? { href: "/ayuda#fecha", etiqueta: es_MX.editor.soloLectura.dondeSeCambia } : undefined
                  }
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
