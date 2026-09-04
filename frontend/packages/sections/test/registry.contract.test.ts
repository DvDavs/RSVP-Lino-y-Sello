// packages/sections/test/registry.contract.test.ts — 04 §5.2, las 5 reglas del contrato del
// registro. Reglas 1-3 se comprueban con tipos (si `sectionRegistry` no tuviera las 12 claves de
// `SectionType`, o `roles` no fuera `BlockRole[]`, el paquete no compilaría — `pnpm typecheck` es
// la prueba de esas dos). Aquí se comprueban en TIEMPO DE EJECUCIÓN las reglas 2 y 5, que son las
// que SÍ pueden fallar con datos correctos de tipo pero incorrectos de contenido.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TemplateManifest } from "@invitaciones/schema";
import { sectionRegistry } from "../src/registry.ts";

const here = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = resolve(here, "../../../templates");

function listTemplateManifests(): Array<{ path: string; manifest: ReturnType<typeof TemplateManifest.parse> }> {
  if (!existsSync(TEMPLATES_DIR)) return [];
  const out: Array<{ path: string; manifest: ReturnType<typeof TemplateManifest.parse> }> = [];
  for (const slug of readdirSync(TEMPLATES_DIR, { withFileTypes: true })) {
    if (!slug.isDirectory()) continue;
    const slugDir = resolve(TEMPLATES_DIR, slug.name);
    for (const version of readdirSync(slugDir, { withFileTypes: true })) {
      if (!version.isDirectory()) continue;
      const manifestPath = resolve(slugDir, version.name, "template.json");
      if (!existsSync(manifestPath)) continue;
      const raw = JSON.parse(readFileSync(manifestPath, "utf8"));
      out.push({ path: manifestPath, manifest: TemplateManifest.parse(raw) });
    }
  }
  return out;
}

describe("registry.contract — regla 1: las 12 claves son exactamente SectionType", () => {
  it("sectionRegistry tiene exactamente 12 entradas", () => {
    expect(Object.keys(sectionRegistry).sort()).toEqual(
      [
        "amenities", "celebrant", "cover", "dressCode", "event", "family", "footer",
        "gallery", "giftTable", "rsvp", "story", "suggestions",
      ].sort(),
    );
  });
});

describe("registry.contract — regla 2: defaultVariant ∈ supportedVariants", () => {
  for (const [type, entry] of Object.entries(sectionRegistry)) {
    it(`"${type}": defaultVariant "${entry.defaultVariant}" está en supportedVariants`, () => {
      expect(entry.supportedVariants).toContain(entry.defaultVariant);
    });
  }
});

describe("registry.contract — regla 3: roles ⊆ BlockRole y sin duplicados", () => {
  for (const [type, entry] of Object.entries(sectionRegistry)) {
    it(`"${type}": roles no está vacío y no tiene duplicados`, () => {
      expect(entry.roles.length).toBeGreaterThan(0);
      expect(new Set(entry.roles).size).toBe(entry.roles.length);
    });
  }
});

describe("registry.contract — variantLabels cubre toda supportedVariants con texto es-MX", () => {
  for (const [type, entry] of Object.entries(sectionRegistry)) {
    it(`"${type}": toda variante soportada tiene etiqueta es-MX no vacía`, () => {
      for (const variant of entry.supportedVariants) {
        expect(entry.variantLabels[variant]).toBeTruthy();
      }
    });
  }
});

describe("registry.contract — regla 5: SectionSpec.variants ⊆ supportedVariants del tipo (paquetes reales)", () => {
  const manifests = listTemplateManifests();

  it("hay al menos un template.json real que comprobar (boda-clasica y xv-jardin)", () => {
    expect(manifests.length).toBeGreaterThanOrEqual(2);
  });

  for (const { path, manifest } of manifests) {
    for (const section of manifest.sections) {
      it(`${manifest.slug}@${manifest.version} · sección "${section.key}" (${section.type}): variants ⊆ supportedVariants`, () => {
        const entry = sectionRegistry[section.type];
        expect(entry, `sectionRegistry no tiene entrada para el tipo "${section.type}" (${path})`).toBeDefined();
        for (const variant of section.variants) {
          expect(
            entry.supportedVariants,
            `"${manifest.slug}@${manifest.version}.${section.key}" declara la variante "${variant}", ausente de sectionRegistry.${section.type}.supportedVariants`,
          ).toContain(variant);
        }
      });

      it(`${manifest.slug}@${manifest.version} · sección "${section.key}" (${section.type}): todo rol de bloque declarado está en roles`, () => {
        // `entry.roles` YA incluye los 4 roles genéricos (registry-data.ts `data()` los añade a
        // toda entrada), así que basta comprobar contra `entry.roles` sin un segundo conjunto.
        const entry = sectionRegistry[section.type];
        for (const block of section.blocks) {
          expect(
            entry.roles,
            `"${manifest.slug}@${manifest.version}.${section.key}.${block.id}" usa el rol "${block.role}", que sectionRegistry.${section.type} no contempla`,
          ).toContain(block.role);
        }
      });
    }
  }
});
