// lib/manifest.ts — acceso al `TemplateManifest` de la versión activa (contrato nuevo, congelado por
// el orquestador mientras 3-5 trabajaba en paralelo con el backend):
//
//   «GET /editor/invitations/{iid}/document gana un campo de primer nivel `manifest` con el
//   TemplateManifest completo de la versión de plantilla activa».
//
// AL CIERRE DE ESTE BLOQUE el campo TODAVÍA NO llega por HTTP: verificado leyendo
// `Templates2EditorDtos.kt` (`DocumentResponse` no declara `manifest`, `bitacora/3-5.md` §1). Por
// eso este archivo NO duplica ni inventa el manifiesto (eso sería exactamente H-27): usa el tipo
// `TemplateManifest` de `@invitaciones/schema` y llama a la ruta REAL (`getDocument`, la única que el
// contrato promete enriquecer). En cuanto el backend publique el campo, `parseManifestField` empieza
// a devolver datos sin tocar una sola línea de este archivo — es el «camino real enchufado» que pide
// el brief. Mientras tanto, `status` vale `"unavailable"` y cada componente que lo consume EXPLICA la
// degradación (P1): nunca fabrica un manifiesto falso ni bloquea el resto del editor.
//
// `ThemeSpec` (paletas/fuentes de `theme.json`) tiene el MISMO problema pero el contrato del
// orquestador no prometió exponerlo (solo `manifest`) — `TemplateManifest` no lleva `theme` embebido
// (contratos.md §3: «NO existen … TemplateManifest.theme»). Se registra como pregunta ALTA en
// `preguntas-abiertas.md`; aquí se deja el mismo enchufe especulativo (`theme` opcional en la
// respuesta) por si el backend lo añade junto con `manifest`, y `ThemePicker` degrada mostrando solo
// la paleta activa (`composed.theme`) cuando no llega.
import { useEffect, useState, useSyncExternalStore } from "react";
import { ThemeSpec, TemplateManifest } from "@invitaciones/schema";
import type { BlockSpec, GroupSpec, SectionSpec, ThemeSpec as ThemeSpecType, TemplateManifest as TemplateManifestType } from "@invitaciones/schema";
import { getDocument } from "./api-client.ts";
import { useEditorStore } from "./store.ts";

export type ManifestStatus = "idle" | "loading" | "ready" | "unavailable" | "error";

export interface ManifestState {
  manifest: TemplateManifestType | null;
  theme: ThemeSpecType | null;
  status: ManifestStatus;
}

interface CacheEntry {
  promise: Promise<{ manifest: TemplateManifestType | null; theme: ThemeSpecType | null }>;
}

const cache = new Map<string, CacheEntry>();

function claveDeCache(invitationId: number, templateVersion: string): string {
  return `${invitationId}::${templateVersion}`;
}

/**
 * Lee `manifest` (y, si algún día llega, `theme`) de la MISMA respuesta que ya usa `lib/store.ts`
 * (`GET .../document`). Se cachea por invitación + versión de plantilla porque el manifiesto es
 * inmutable dentro de una versión (`tpl_template_version`), así que no hace falta refrescarlo con
 * cada revisión del documento — solo cuando cambia la plantilla (`:choose-template`).
 */
async function cargarManifiesto(
  invitationId: number,
  templateVersion: string,
): Promise<{ manifest: TemplateManifestType | null; theme: ThemeSpecType | null }> {
  const clave = claveDeCache(invitationId, templateVersion);
  const existente = cache.get(clave);
  if (existente) return existente.promise;

  const promesa = (async () => {
    const doc = (await getDocument(invitationId)) as unknown as { manifest?: unknown; theme?: unknown };
    const manifestParseado = TemplateManifest.safeParse(doc.manifest);
    const themeParseado = ThemeSpec.safeParse(doc.theme);
    return {
      manifest: manifestParseado.success ? manifestParseado.data : null,
      theme: themeParseado.success ? themeParseado.data : null,
    };
  })();
  cache.set(clave, { promise: promesa });
  return promesa;
}

// -------------------------------------------------------------------------------------------
// Fixture de pruebas — SOLO se activa detrás de `NEXT_PUBLIC_E2E_HOOKS=1` (mismo guarda que
// `window.__editorStore` en `page.tsx`, ADR-3-4-… / `handoffs/3-4.md` §5.5). Sirve a dos cosas:
// (a) los e2e de Playwright, que corren contra el backend real y por tanto SIN `manifest` todavía;
// (b) las capturas de evidencia (`docs/rediseno-plantillas/evidencia/fase-3/editor/`), que necesitan
// mostrar el panel de contenido como el producto terminado que será en cuanto el backend publique el
// campo. Nunca se llama en producción: nada en el bundle de producción la invoca.
// -------------------------------------------------------------------------------------------

let epocaFixture = 0;
const oyentesFixture = new Set<() => void>();

/**
 * `manifest`/`theme` llegan como JSON crudo (de un fixture leído por SQL, `test/fixtures/`, o
 * `page.evaluate` en los e2e — cruzar esa frontera pierde cualquier tipo de TypeScript). Se
 * validan con el MISMO `TemplateManifest.parse` que usaría el camino real (`cargarManifiesto`),
 * para que los `.default()` de Zod (`source: "user"`, `editable: true`…) se apliquen igual — sin
 * esto, un bloque sin `source` explícito en el JSON del autor parecía `fixed` en vez de editable
 * (defecto real encontrado sembrando el fixture en `e2e/paneles.spec.ts`).
 */
export function sembrarManifiestoFixture(invitationId: number, templateVersion: string, manifest: unknown, theme: unknown): void {
  const manifestValidado = TemplateManifest.parse(manifest);
  const themeValidado = ThemeSpec.safeParse(theme);
  cache.set(claveDeCache(invitationId, templateVersion), {
    promise: Promise.resolve({ manifest: manifestValidado, theme: themeValidado.success ? themeValidado.data : null }),
  });
  epocaFixture += 1;
  oyentesFixture.forEach((l) => l());
}

function suscribirEpoca(cb: () => void): () => void {
  oyentesFixture.add(cb);
  return () => oyentesFixture.delete(cb);
}
function instantaneaEpoca(): number {
  return epocaFixture;
}

/**
 * Hook de lectura. Se dispara cuando cambia la versión de plantilla activa del store (no en cada
 * tecla), y NUNCA escribe en `lib/store.ts` (prohibido tocar ese archivo, `brief` §"archivos que te
 * tocan"): mantiene su propio estado local, aparte.
 */
export function useTemplateManifest(invitationId: number): ManifestState {
  const templateVersion = useEditorStore((s) => s.templateVersion);
  const clave = templateVersion ? `${templateVersion.slug}@${templateVersion.version}` : null;
  const epoca = useSyncExternalStore(suscribirEpoca, instantaneaEpoca, () => 0);
  const [estado, setEstado] = useState<ManifestState>({ manifest: null, theme: null, status: "idle" });

  useEffect(() => {
    if (!clave || !Number.isFinite(invitationId) || invitationId <= 0) return;
    let cancelado = false;
    setEstado((prev) => ({ ...prev, status: "loading" }));
    void cargarManifiesto(invitationId, clave)
      .then((r) => {
        if (cancelado) return;
        setEstado({ manifest: r.manifest, theme: r.theme, status: r.manifest ? "ready" : "unavailable" });
      })
      .catch(() => {
        if (cancelado) return;
        setEstado({ manifest: null, theme: null, status: "error" });
      });
    return () => {
      cancelado = true;
    };
    // `epoca` fuerza un refetch cuando `sembrarManifiestoFixture` acaba de escribir el caché.
  }, [invitationId, clave, epoca]);

  return estado;
}

// -------------------------------------------------------------------------------------------
// Índice de bloques — búsqueda O(1) por id, usada por BlockForm/GroupField/PhotoManager.
// -------------------------------------------------------------------------------------------

export interface ManifestIndex {
  sections: Map<string, SectionSpec>;
  /** Bloques escalares de primer nivel, por `blockId`, con la clave de su sección. */
  scalars: Map<string, { spec: Exclude<BlockSpec, GroupSpec>; sectionKey: string }>;
  /** Grupos de primer nivel, por `blockId` (== `groupId`), con la clave de su sección. */
  groups: Map<string, { spec: GroupSpec; sectionKey: string }>;
}

export function buildManifestIndex(manifest: TemplateManifestType | null): ManifestIndex {
  const sections = new Map<string, SectionSpec>();
  const scalars: ManifestIndex["scalars"] = new Map();
  const groups: ManifestIndex["groups"] = new Map();
  if (!manifest) return { sections, scalars, groups };
  for (const section of manifest.sections) {
    sections.set(section.key, section);
    for (const block of section.blocks) {
      if (block.type === "group") groups.set(block.id, { spec: block, sectionKey: section.key });
      else scalars.set(block.id, { spec: block, sectionKey: section.key });
    }
  }
  return { sections, scalars, groups };
}

export function findSectionSpec(manifest: TemplateManifestType | null, sectionKey: string): SectionSpec | null {
  return manifest?.sections.find((s) => s.key === sectionKey) ?? null;
}

/** Texto es-MX de un `LocalizedText` (siempre lleva `es-MX`, `esquema/common.ts`). */
export function etiqueta(texto: { "es-MX": string } | undefined | null): string {
  return texto?.["es-MX"] ?? "";
}

/** ¿Este bloque lo puede escribir el cliente? `editable:false` o `source !== "user"` ⇒ no (§7.1 paso 5). */
export function esEditable(spec: { editable: boolean; source: "user" | "business" | "fixed" }): boolean {
  return spec.editable && spec.source === "user";
}

/** Explicación es-MX de dónde se cambia un bloque de solo lectura (04 §6.3). */
export function explicacionSoloLectura(spec: { source: "user" | "business" | "fixed" }): string {
  if (spec.source === "business") {
    return "Se toma de los datos de tu invitación.";
  }
  return "Este contenido lo define el diseño de la plantilla y no se puede editar.";
}

export type { BlockSpec, GroupSpec, SectionSpec, ThemeSpecType as ThemeSpec, TemplateManifestType as TemplateManifest };
