// packages/schema/test/manifest-asset-id.contract.test.ts — I-09 (bitácora 3-2d §5, ADR-3B-I09-01).
//
// EL DEFECTO. `AssetEntry` no tenía campo de id y el `publicId` de cada asset lo acuña el servidor
// en el registro (`TemplateRegistrationService.kt:104`, `"as_" + ulid.next()`, aleatorio). Un
// `assetId` escrito a mano en `defaults.json` NO resuelve: el bloque sale `provenance:"empty"` y,
// si es obligatorio, `canPublish:false`. Para un bloque `source:"fixed"` —`rsvp.background`— era
// peor: su único origen posible es `defaults.json` y el cliente no puede escribirlo
// (`422 TPL_BLOCK_NOT_EDITABLE`), así que el bloque quedaba inalcanzable por cualquier vía.
//
// EL ARREGLO. `AssetEntry.id` opcional: el paquete DECLARA el alias de cada archivo y el backend lo
// añade al `AssetIndex` apuntando a la misma fila de `tpl_asset` (alias en memoria, la base no
// cambia). Esta prueba fija las dos mitades del contrato en TypeScript, que es la fuente (P1):
//   1. la forma: `id` es opcional, se valida como `AssetId` y un paquete sin él sigue siendo válido;
//   2. la coherencia de los paquetes REALES de `frontend/templates/`: todo `assetId` que
//      `defaults.json` referencia está declarado como `id` de un `AssetEntry` del manifiesto.
//
// (2) falla en rojo antes del arreglo: hoy ningún manifiesto declara ids y los siete `assetId` de
// `boda-clasica/1.0.0/defaults.json` no los declara nadie.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AssetEntry, TemplateManifest, DefaultsFile } from "../src/manifest.ts";

const here = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = resolve(here, "../../../templates");
const PLANTILLAS = [
  { slug: "boda-clasica", version: "1.0.0" },
  { slug: "xv-jardin", version: "1.0.0" },
] as const;

const entradaBase = {
  path: "assets/rsvp-bg.webp",
  sha256: "a".repeat(64),
  contentType: "image/webp",
  bytes: 43_340,
} as const;

describe("AssetEntry.id — el manifiesto puede declarar el alias de cada archivo", () => {
  it("sin `id` sigue siendo válido: el cambio es aditivo", () => {
    const r = AssetEntry.safeParse(entradaBase);
    expect(r.success).toBe(true);
    expect(r.success && r.data.id).toBeUndefined();
  });

  it("con un `id` bien formado lo conserva", () => {
    const r = AssetEntry.safeParse({ ...entradaBase, id: "as_01J8DEM000000000000000RSV1" });
    expect(r.success).toBe(true);
    expect(r.success && r.data.id).toBe("as_01J8DEM000000000000000RSV1");
  });

  it("un `id` que no es un AssetId se rechaza (no vale cualquier texto)", () => {
    for (const malo of ["rsvp-bg", "as_minusculas0000000000000", "01J8DEM000000000000000RSV1", ""])
      expect(AssetEntry.safeParse({ ...entradaBase, id: malo }).success).toBe(false);
  });

  it("`id` no admite null: o está bien formado o no está", () => {
    expect(AssetEntry.safeParse({ ...entradaBase, id: null }).success).toBe(false);
  });
});

/** Todos los `assetId` que aparecen en un valor de `defaults.json`, a cualquier profundidad. */
function assetIdsDe(raiz: unknown): string[] {
  const ids: string[] = [];
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n === null || typeof n !== "object") return;
    const o = n as Record<string, unknown>;
    if (typeof o.assetId === "string") ids.push(o.assetId);
    Object.values(o).forEach(walk);
  };
  walk(raiz);
  return [...new Set(ids)].sort();
}

const leer = (slug: string, version: string, archivo: string): unknown =>
  JSON.parse(readFileSync(join(TEMPLATES_DIR, slug, version, archivo), "utf8"));

describe("los paquetes reales de frontend/templates/ referencian SUS PROPIAS imágenes", () => {
  for (const { slug, version } of PLANTILLAS) {
    const manifiesto = TemplateManifest.parse(leer(slug, version, "template.json"));
    const defaults = DefaultsFile.parse(leer(slug, version, "defaults.json"));
    const declarados = manifiesto.assets.map(a => a.id).filter((x): x is string => x !== undefined);

    it(`${slug}@${version}: todo assetId de defaults.json está declarado en template.json`, () => {
      const referenciados = assetIdsDe(defaults.content);
      expect(referenciados.length).toBeGreaterThan(0);
      expect(referenciados.filter(id => !declarados.includes(id))).toEqual([]);
    });

    it(`${slug}@${version}: los alias declarados son únicos`, () => {
      expect(declarados.length).toBe(new Set(declarados).size);
    });

    it(`${slug}@${version}: cada alias declarado apunta a un archivo del paquete`, () => {
      for (const a of manifiesto.assets)
        if (a.id !== undefined) expect(a.path).toMatch(/^assets\/[a-z0-9][a-z0-9._-]{0,99}$/);
    });
  }
});
