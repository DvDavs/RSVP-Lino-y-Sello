// test/introspect.contract.test.ts — contrato de la introspección del vocabulario cerrado (fase 4, 4-0B).
//
// Lo que estas pruebas garantizan, y que es la razón de existir del módulo:
//  1. El texto humano cubre EXACTAMENTE el catálogo cerrado: ni un rol sin descripción ni una
//     descripción de un rol que ya no existe.
//  2. Los ejemplos mínimos NO se dan por buenos: pasan el `parse` del esquema real, y sus claves se
//     comparan contra los campos que la introspección deriva como obligatorios.
//  3. La forma de cada rama del `oneOf` sale del árbol Zod, no de una transcripción.
import { describe, expect, it } from "vitest";
import {
  BLOCK_TYPE_TEXT, BLOCK_TYPES, ROLE_TEXT_KEYS, ROLES, SECTION_TYPES,
  describeBlockType, describeBlockTypes, describeField, describeRole, describeRoles,
  explainBlockSpec, rolesForSectionType, suggestBlockType, suggestClosest, suggestRole,
  suggestSectionType,
} from "../src/introspect.ts";
import { BlockKind, BlockRole, BlockSpec, BlockValue, GROUP_ROLES, SINGLETON_ROLES } from "../src/blocks.ts";
import { SectionType, TemplateManifest } from "../src/manifest.ts";

const sorted = (xs: readonly string[]) => [...xs].sort();

describe("catálogos cerrados", () => {
  it("expone los 14 tipos de bloque, los 90 roles y los 12 tipos de sección", () => {
    expect(BLOCK_TYPES).toEqual(BlockKind.options);
    expect(ROLES).toEqual(BlockRole.options);
    expect(SECTION_TYPES).toEqual(SectionType.options);
    expect(BLOCK_TYPES).toHaveLength(14);
    expect(ROLES).toHaveLength(90);
    expect(SECTION_TYPES).toHaveLength(12);
  });

  it("BLOCK_TYPE_TEXT cubre exactamente los 14 tipos, ni uno de más ni de menos", () => {
    expect(sorted(Object.keys(BLOCK_TYPE_TEXT))).toEqual(sorted(BlockKind.options));
    for (const [type, texto] of Object.entries(BLOCK_TYPE_TEXT)) {
      expect(texto.length, `${type} sin descripción útil`).toBeGreaterThan(20);
    }
  });

  it("la tabla de texto por rol cubre exactamente los 90 roles (falla al añadir un rol sin descripción)", () => {
    expect(sorted(ROLE_TEXT_KEYS)).toEqual(sorted(BlockRole.options));
    expect(describeRoles()).toHaveLength(BlockRole.options.length);
    for (const r of describeRoles()) {
      expect(r.description.length, `${r.role} sin descripción`).toBeGreaterThan(10);
      expect(r.blockTypes.length, `${r.role} sin tipo de bloque`).toBeGreaterThan(0);
      expect(r.sectionTypes.length, `${r.role} sin tipo de sección`).toBeGreaterThan(0);
      for (const t of r.blockTypes) expect(BlockKind.options).toContain(t);
      for (const s of r.sectionTypes) expect(SectionType.options).toContain(s);
    }
  });

  it("scope y singleton se DERIVAN de blocks.ts, no se transcriben (I-25, I-26)", () => {
    const grupo = describeRoles().filter(r => r.scope === "group").map(r => r.role);
    expect(sorted(grupo)).toEqual(sorted(GROUP_ROLES));
    const singleton = describeRoles().filter(r => r.singleton).map(r => r.role);
    expect(sorted(singleton)).toEqual(sorted(SINGLETON_ROLES));
    expect(singleton).toHaveLength(17);
    // I-25: un rol de grupo SOLO en bloques group; un rol escalar NUNCA en un bloque group.
    for (const r of describeRoles()) {
      if (r.scope === "group") expect(r.blockTypes).toEqual(["group"]);
      else expect(r.blockTypes).not.toContain("group");
    }
  });

  it("describeRole devuelve undefined para lo que no está en el catálogo", () => {
    expect(describeRole("celebrantName")).toBeUndefined();
    expect(describeRole("")).toBeUndefined();
    expect(describeRole("coverTitle")?.singleton).toBe(true);
    expect(describeRole("sectionTitle")?.singleton).toBe(false);
  });

  it("rolesForSectionType filtra por sección y siempre incluye los cuatro genéricos", () => {
    for (const t of SectionType.options) {
      const roles = rolesForSectionType(t).map(r => r.role);
      expect(roles).toEqual(expect.arrayContaining(["sectionTitle", "sectionIntro", "sectionBackground", "decorative"]));
    }
    expect(rolesForSectionType("cover").map(r => r.role)).toContain("coverTitle");
    expect(rolesForSectionType("cover").map(r => r.role)).not.toContain("eventCards");
    expect(rolesForSectionType("noExiste")).toHaveLength(0);
  });
});

describe("forma de cada rama del oneOf (derivada del árbol Zod)", () => {
  it("describe las 14 ramas de BlockSpec y las 14 de BlockValue", () => {
    const infos = describeBlockTypes();
    expect(infos).toHaveLength(14);
    for (const info of infos) {
      expect(info.spec.all).toContain("type");
      expect(info.spec.required).toEqual(expect.arrayContaining(["id", "role", "label", "type"]));
      expect(info.value.required).toContain("kind");
      expect(info.summary).toBe(BLOCK_TYPE_TEXT[info.type]);
    }
  });

  it("group: min/max/reorderable tienen default; itemLabel e itemBlocks son OBLIGATORIOS (fallo 2 de I-08)", () => {
    const g = describeBlockType("group");
    expect(g.spec.required).toEqual(expect.arrayContaining(["itemLabel", "itemBlocks"]));
    expect(g.spec.withDefault).toEqual(expect.arrayContaining(["min", "max", "reorderable"]));
    expect(g.spec.all).not.toContain("constraints");
    // itemBlocks es un array de la unión de 13 especificaciones escalares: se nombran sus ramas.
    const itemBlocks = g.spec.fields.find(f => f.name === "itemBlocks");
    expect(itemBlocks?.type).toBe("array");
    expect(itemBlocks?.element?.type).toBe("union");
    expect(itemBlocks?.element?.unionOf).toHaveLength(13);
    expect(itemBlocks?.element?.unionOf).not.toContain("group");
  });

  it("text: constraints trae su default completo y sus límites salen del esquema", () => {
    const t = describeBlockType("text");
    expect(t.spec.withDefault).toContain("constraints");
    const constraints = t.spec.fields.find(f => f.name === "constraints");
    expect(constraints?.defaultValue).toEqual({ minLength: 0, maxLength: 200, multiline: false });
    const maxLength = constraints?.fields?.find(f => f.name === "maxLength");
    expect(maxLength?.constraints).toMatchObject({ minimum: 1, maximum: 2000 });
    // `pattern` NO existe (ADR-1R-X-02): si alguien lo reintroduce, esta prueba cae.
    expect(constraints?.fields?.map(f => f.name)).toEqual(["minLength", "maxLength", "multiline"]);
  });

  it("choice: options es obligatorio y describe su elemento", () => {
    const c = describeBlockType("choice");
    expect(c.spec.required).toContain("options");
    const options = c.spec.fields.find(f => f.name === "options");
    expect(options?.type).toBe("array");
    expect(options?.element?.fields?.map(f => f.name)).toEqual(["id", "label"]);
    expect(options?.constraints).toMatchObject({ minLength: 1, maxLength: 20 });
  });

  it("los campos enumerados publican sus valores admitidos", () => {
    const spec = describeBlockType("date").spec;
    const source = spec.fields.find(f => f.name === "source");
    expect(source?.enumValues).toEqual(["user", "business", "fixed"]);
    expect(source?.defaultValue).toBe("user");
    const role = spec.fields.find(f => f.name === "role");
    expect(role?.enumValues).toEqual(BlockRole.options);
    const businessField = spec.fields.find(f => f.name === "businessField");
    expect(businessField?.required).toBe(false);
    expect(businessField?.hasDefault).toBe(false);
    expect(businessField?.enumValues).toContain("invitation.date");
    const image = describeBlockType("image").spec.fields.find(f => f.name === "constraints");
    expect(image?.fields?.find(f => f.name === "aspect")?.enumValues)
      .toEqual(["free", "square", "portrait", "landscape", "wide"]);
  });

  it("el valor de un grupo se describe hasta el mapa por id de bloque", () => {
    const items = describeBlockType("group").value.fields.find(f => f.name === "items");
    expect(items?.type).toBe("array");
    const item = items?.element;
    expect(item?.fields?.map(f => f.name)).toEqual(["itemId", "values"]);
    expect(item?.fields?.find(f => f.name === "values")?.type).toBe("record");
  });

  it("describeField también describe literales y patrones", () => {
    const kind = describeBlockType("text").value.fields.find(f => f.name === "kind");
    expect(kind?.type).toBe("literal");
    expect(kind?.literal).toBe("text");
    const id = describeBlockType("text").spec.fields.find(f => f.name === "id");
    expect(id?.constraints?.pattern).toContain("a-z");
    const secciones = describeField("sections", SectionType);
    expect(secciones.type).toBe("enum");
    expect(secciones.required).toBe(true);
    const manifiesto = describeField("manifest", TemplateManifest);
    expect(manifiesto.fields?.find(f => f.name === "capabilities")?.defaultValue).toEqual([]);
  });

  it("describeBlockType rechaza lo que no es un tipo de bloque y sugiere", () => {
    expect(() => describeBlockType("gruop")).toThrowError(/"group"/);
    expect(() => describeBlockType("texto")).toThrowError(/no es un tipo de bloque/);
  });
});

describe("ejemplos mínimos: se validan contra el esquema real, no se dan por buenos", () => {
  for (const type of BlockKind.options) {
    it(`${type}: el spec mínimo pasa BlockSpec.parse y trae exactamente los campos obligatorios`, () => {
      const info = describeBlockType(type);
      const parsed = BlockSpec.parse(info.minimalSpec);
      expect(parsed.type).toBe(type);
      expect(sorted(Object.keys(info.minimalSpec))).toEqual(sorted(info.spec.required));
    });
    it(`${type}: el valor mínimo pasa BlockValue.parse y trae exactamente los campos obligatorios`, () => {
      const info = describeBlockType(type);
      const parsed = BlockValue.parse(info.minimalValue);
      expect(parsed.kind).toBe(type);
      expect(sorted(Object.keys(info.minimalValue))).toEqual(sorted(info.value.required));
    });
    it(`${type}: el rol del ejemplo es un rol válido para ese tipo`, () => {
      const info = describeBlockType(type);
      const role = (info.minimalSpec as { role: string }).role;
      expect(describeRole(role)?.blockTypes).toContain(type);
      expect(info.roles).toContain(role);
    });
  }

  it("todo el catálogo es serializable a JSON (el CLI lo consume desde Node)", () => {
    const round = JSON.parse(JSON.stringify({ tipos: describeBlockTypes(), roles: describeRoles() }));
    expect(round.tipos).toHaveLength(14);
    expect(round.roles).toHaveLength(90);
    expect(round.tipos[0].spec.required).toEqual(describeBlockType("text").spec.required);
  });
});

describe("explainBlockSpec: la respuesta al «0 are valid»", () => {
  it("reproduce el fallo 2 medido en I-08 y dice qué falta y qué sobra", () => {
    // El intento 2 escribió un grupo con `constraints` (de la rama `text`) y sin itemLabel/itemBlocks.
    const e = explainBlockSpec({
      id: "event.moments", type: "group", role: "eventCards", label: { "es-MX": "Momentos" },
      constraints: { minItems: 1, maxItems: 4 },
    });
    expect(e.known).toBe(true);
    expect(e.missing).toEqual(["itemLabel", "itemBlocks"]);
    expect(e.unknown).toEqual(["constraints"]);
    expect(e.omittedWithDefault).toEqual(expect.arrayContaining(["min", "max", "reorderable"]));
    expect(e.message).toContain("Faltan: itemLabel, itemBlocks");
    expect(e.message).toContain("No admite: constraints");
  });

  it("reproduce el fallo 1 medido en I-08: rol inventado, con sugerencia", () => {
    const e = explainBlockSpec({
      id: "celebrant.name", type: "person", role: "celebrantName", label: { "es-MX": "Nombre" },
    });
    expect(e.missing).toEqual([]);
    expect(e.suggestions.role).toBeDefined();
    expect(e.suggestions.role).toContain("celebrantA");
    expect(e.message).toContain("no está en el catálogo cerrado");
  });

  it("un tipo desconocido o ausente no revienta y sugiere rama", () => {
    const sinTipo = explainBlockSpec({ id: "x" });
    expect(sinTipo.known).toBe(false);
    expect(sinTipo.message).toContain("falta la propiedad `type`");
    const malTipo = explainBlockSpec({ id: "x", type: "gruop" });
    expect(malTipo.known).toBe(false);
    expect(malTipo.suggestions.type).toContain("group");
    expect(explainBlockSpec(null).known).toBe(false);
    expect(explainBlockSpec("group").known).toBe(false);
  });

  it("un bloque correcto no inventa quejas", () => {
    const e = explainBlockSpec(describeBlockType("text").minimalSpec);
    expect(e.missing).toEqual([]);
    expect(e.unknown).toEqual([]);
    expect(e.message).toContain("No falta ni sobra");
  });
});

describe("sugerencia por cercanía", () => {
  it("corrige erratas de un carácter", () => {
    expect(suggestRole("coverTitl")[0]).toBe("coverTitle");
    expect(suggestBlockType("gruop")[0]).toBe("group");
    expect(suggestBlockType("richtext")[0]).toBe("richText");
    expect(suggestSectionType("giftable")[0]).toBe("giftTable");
    expect(suggestSectionType("cver")[0]).toBe("cover");
  });

  it("usa el prefijo común para las palabras compuestas de I-08", () => {
    expect(suggestRole("celebrantName")).toContain("celebrantA");
    expect(suggestRole("coverPhoto")).toContain("coverImage");
    expect(suggestRole("eventPlaces")[0]).toBe("eventPlace");
  });

  it("no sugiere nada cuando no se parece a nada", () => {
    expect(suggestRole("xyzzy")).toEqual([]);
    expect(suggestClosest("", ["group"], 3)).toEqual([]);
    expect(suggestClosest("group", [], 3)).toEqual([]);
  });

  it("devuelve la distancia y respeta el límite", () => {
    const s = suggestClosest("coverTitl", ROLES, 2);
    expect(s.length).toBeLessThanOrEqual(2);
    expect(s[0]).toEqual({ value: "coverTitle", distance: 1 });
    expect(suggestClosest("coverTitle", ROLES, 1)[0].distance).toBe(0);
  });
});
