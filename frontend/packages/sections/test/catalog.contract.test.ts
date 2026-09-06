// test/catalog.contract.test.ts — el catálogo de metadatos NO puede desincronizarse del registro.
//
// Estas pruebas son la única razón por la que `catalog/index.ts` puede declarar variantes y roles en vez de
// derivarlos: si `registry-data.ts` gana o pierde una variante, o un componente deja de pintar un rol,
// aquí se pone en rojo (P1: o se deriva, o hay prueba que falla al divergir).
import { describe, expect, it } from "vitest";
import { BlockRole, SectionType, BLOCK_ID_PATTERN, SINGLETON_ROLES, describeRole, describeRoles } from "@invitaciones/schema";
import { SECTION_REGISTRY_DATA, VARIANT_LABELS_ES_MX } from "../src/registry-data.ts";
import {
  CATALOG_SECTION_TYPES, blockIdFor, describeSection, scaffoldSlots, sectionCatalog, slotForRole,
} from "../catalog/index.ts";
import type { CatalogSlot } from "../catalog/index.ts";

const sorted = (xs: readonly string[]) => [...xs].sort();
const secciones = SectionType.options;

describe("catálogo ↔ registro de secciones", () => {
  it("cubre EXACTAMENTE los 12 tipos de sección del catálogo cerrado", () => {
    expect(sorted(CATALOG_SECTION_TYPES)).toEqual(sorted(secciones));
    expect(sorted(Object.keys(sectionCatalog))).toEqual(sorted(secciones));
  });

  for (const type of secciones) {
    it(`${type}: variantes y variante por omisión idénticas a SECTION_REGISTRY_DATA`, () => {
      const registro = SECTION_REGISTRY_DATA[type];
      const catalogo = sectionCatalog[type];
      // Set equality en ambos sentidos: falla tanto si el catálogo inventa una variante como si
      // el registro gana una que el catálogo no conoce.
      expect(sorted(catalogo.variants.map(v => v.id))).toEqual(sorted(registro.supportedVariants));
      expect(catalogo.defaultVariant).toBe(registro.defaultVariant);
      expect(catalogo.variants.map(v => v.id)).toContain(catalogo.defaultVariant);
      for (const v of catalogo.variants) expect(v.label).toBe(VARIANT_LABELS_ES_MX[v.id]);
    });

    it(`${type}: los roles de los huecos son EXACTAMENTE los que el componente sabe pintar`, () => {
      const registro = SECTION_REGISTRY_DATA[type];
      const rolesDelCatalogo = new Set(sectionCatalog[type].slots.map(s => s.role));
      expect(sorted([...rolesDelCatalogo])).toEqual(sorted([...new Set(registro.roles)]));
    });
  }

  it("todo rol del catálogo está en el catálogo cerrado del esquema", () => {
    for (const type of secciones) {
      for (const slot of sectionCatalog[type].slots) {
        expect(BlockRole.options, `${type}.${slot.blockId}`).toContain(slot.role);
        for (const item of slot.itemBlocks ?? []) expect(BlockRole.options).toContain(item.role);
      }
    }
  });
});

describe("coherencia con la introspección del esquema (cruce entre paquetes)", () => {
  it("role.sectionTypes del esquema = las secciones donde el catálogo coloca ese rol", () => {
    // Admisibles en T = los roles que el componente pinta + los roles de los itemBlocks de sus grupos.
    const admisibles = new Map<string, Set<string>>();
    for (const type of secciones) {
      for (const slot of sectionCatalog[type].slots) {
        for (const r of [slot.role, ...(slot.itemBlocks ?? []).map(i => i.role)]) {
          if (!admisibles.has(r)) admisibles.set(r, new Set());
          admisibles.get(r)!.add(type);
        }
      }
    }
    for (const info of describeRoles()) {
      const esperado = sorted([...(admisibles.get(info.role) ?? new Set<string>())]);
      expect(sorted(info.sectionTypes), `rol ${info.role}`).toEqual(esperado);
    }
  });

  it("el tipo de bloque de cada hueco es uno de los que el esquema declara para ese rol", () => {
    for (const type of secciones) {
      const revisa = (slot: CatalogSlot, path: string) => {
        expect(describeRole(slot.role)?.blockTypes, path).toContain(slot.type);
        for (const item of slot.itemBlocks ?? []) revisa(item, `${path}.${item.blockId}`);
      };
      for (const slot of sectionCatalog[type].slots) revisa(slot, `${type}.${slot.blockId}`);
    }
  });

  it("la frase de cada hueco viene de describeRole, no de una copia local", () => {
    for (const type of secciones) {
      for (const slot of sectionCatalog[type].slots) {
        expect(slot.purpose).toBe(describeRole(slot.role)!.description);
      }
    }
  });

  it("singletonRole se deriva de SINGLETON_ROLES (I-26, 17 roles)", () => {
    const marcados = new Set<string>();
    for (const type of secciones) {
      for (const slot of sectionCatalog[type].slots) if (slot.singletonRole) marcados.add(slot.role);
    }
    for (const r of marcados) expect(SINGLETON_ROLES as readonly string[]).toContain(r);
    // Todo rol singleton que el catálogo coloca en algún hueco está marcado.
    for (const r of SINGLETON_ROLES) {
      const colocado = secciones.some(t => sectionCatalog[t].slots.some(s => s.role === r));
      if (colocado) expect(marcados).toContain(r);
    }
    expect(SINGLETON_ROLES).toHaveLength(17);
  });
});

describe("forma del catálogo", () => {
  it("los ids sugeridos son únicos por sección y válidos como BlockId", () => {
    for (const type of secciones) {
      const ids = sectionCatalog[type].slots.map(s => s.blockId);
      expect(sorted(ids), `${type}: sufijos repetidos`).toEqual(sorted([...new Set(ids)]));
      for (const slot of sectionCatalog[type].slots) {
        expect(blockIdFor(type, slot)).toMatch(BLOCK_ID_PATTERN);
        const internos = (slot.itemBlocks ?? []).map(i => i.blockId);
        expect(sorted(internos)).toEqual(sorted([...new Set(internos)]));
        for (const i of internos) expect(i).toMatch(BLOCK_ID_PATTERN);
      }
    }
  });

  it("solo los huecos `group` traen itemBlocks, min, max e itemLabel; y no anidan (01 §2.5)", () => {
    for (const type of secciones) {
      for (const slot of sectionCatalog[type].slots) {
        if (slot.type === "group") {
          expect(slot.itemBlocks?.length, `${type}.${slot.blockId}`).toBeGreaterThan(0);
          expect(typeof slot.min).toBe("number");
          expect(typeof slot.max).toBe("number");
          expect(slot.min!).toBeLessThanOrEqual(slot.max!);   // I-07
          expect(slot.itemLabel).toBeTruthy();
          expect(describeRole(slot.role)?.scope).toBe("group");   // I-25
          for (const item of slot.itemBlocks ?? []) {
            expect(item.type).not.toBe("group");
            expect(item.itemBlocks).toBeUndefined();
            expect(describeRole(item.role)?.scope).toBe("scalar");
          }
        } else {
          expect(slot.itemBlocks).toBeUndefined();
          expect(describeRole(slot.role)?.scope).toBe("scalar");   // I-25
        }
      }
    }
  });

  it("cada sección tiene al menos un hueco en el andamio, y cada grupo del andamio un itemBlock", () => {
    for (const type of secciones) {
      const scaffold = scaffoldSlots(type);
      expect(scaffold.length, `${type} sin andamio`).toBeGreaterThan(0);
      for (const slot of scaffold) {
        if (slot.type === "group") {
          expect(slot.itemBlocks!.filter(i => i.scaffold).length, `${type}.${slot.blockId}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("los huecos de negocio traen su businessField (I-05) y el tipo que exige (I-06)", () => {
    const negocio = secciones.flatMap(t => sectionCatalog[t].slots.filter(s => s.source === "business"));
    expect(negocio.length).toBeGreaterThan(0);
    for (const slot of negocio) {
      expect(slot.businessField, slot.blockId).toBeTruthy();
      expect(slot.businessField).toMatch(/^invitation\./);
    }
    expect(sectionCatalog.rsvp.slots.find(s => s.role === "rsvpChildrenAllowed")?.businessField)
      .toBe("invitation.childrenAllowed");
  });

  it("cada sección trae nombre, para qué sirve y cardinalidad", () => {
    for (const type of secciones) {
      const s = sectionCatalog[type];
      expect(s.name.length).toBeGreaterThan(2);
      expect(s.purpose.length).toBeGreaterThan(20);
      expect(["1", "0..n", "1..n"]).toContain(s.cardinality);
    }
    expect(sectionCatalog.cover.cardinality).toBe("1");
    expect(sectionCatalog.event.cardinality).toBe("1..n");
    expect(sectionCatalog.gallery.cardinality).toBe("0..n");
  });

  it("es serializable a JSON sin pérdida (el CLI lo consume desde Node)", () => {
    const round = JSON.parse(JSON.stringify(sectionCatalog));
    expect(round).toEqual(sectionCatalog);
    expect(Object.keys(round)).toHaveLength(12);
  });

  it("las funciones de consulta responden lo que el kit necesita", () => {
    expect(describeSection("cover")?.name).toBe("Portada");
    expect(describeSection("noExiste")).toBeUndefined();
    expect(blockIdFor("portada", sectionCatalog.cover.slots[0])).toBe("portada.title");
    expect(slotForRole("event", "eventWhen")?.blockId).toBe("when");     // dentro del grupo
    expect(slotForRole("event", "eventCards")?.type).toBe("group");      // de nivel de sección
    expect(slotForRole("event", "coverTitle")).toBeUndefined();
  });
});
