// test/check.test.ts — el resto de `check`: árbol, migraciones, invariantes, avisos y punteros.
import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AYUDA_INVARIANTE, check, punteroDeBloque, revisarRolYSeccion, revisarVariantes } from "../src/check.ts";
import { copiarPaquete, escribirManifiesto, escribirTema, leerManifiesto, mensajeDe, PAQUETES } from "./ayuda.ts";

type J = Record<string, any>;

/** Códigos (sin duplicar) de los hallazgos de un check. */
function codigos(dir: string, escribir = false): string[] {
  return [...new Set(check({ dir, escribir }).hallazgos.map(h => h.codigo))];
}

describe("check: árbol del paquete (01 §2.1)", () => {
  it("un directorio que no existe se dice, no se lanza", () => {
    const r = check({ dir: join(tmpdir(), "no-existe-jamas-kit") });
    expect(r.ok).toBe(false);
    expect(r.hallazgos[0]!.codigo).toBe("TPL_PACKAGE_NOT_FOUND");
  });

  it("faltar un `.json` obligatorio corta el check ahí mismo", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    rmSync(join(dir, "theme.json"));
    const hs = check({ dir }).hallazgos;
    expect(hs.map(h => h.codigo)).toEqual(["TPL_PACKAGE_MISSING_FILE"]);
    expect(hs[0]!.puntero).toBe("theme.json#$");
  });

  it("un subdirectorio dentro de assets/ es un archivo inesperado", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    mkdirSync(join(dir, "assets", "sub"));
    writeFileSync(join(dir, "assets", "sub", "x.webp"), "x", "utf8");
    expect(codigos(dir)).toContain("TPL_PACKAGE_UNEXPECTED_FILE");
  });

  it("un asset presente pero no declarado se rechaza y la sugerencia trae la entrada lista", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    writeFileSync(join(dir, "assets", "extra.png"), "1234", "utf8");
    const m = mensajeDe(dir, "TPL_PACKAGE_UNEXPECTED_FILE");
    expect(m).toContain('El archivo "assets/extra.png" está en el paquete pero el manifiesto no lo declara.');
    expect(m).toContain('"contentType":"image/png","bytes":4');
  });

  it("un JSON roto se explica y corta el check", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    writeFileSync(join(dir, "defaults.json"), "{,}", "utf8");
    const hs = check({ dir }).hallazgos;
    expect(hs.map(h => h.codigo)).toEqual(["TPL_PACKAGE_JSON_INVALID"]);
  });
});

describe("check: assets", () => {
  it("un asset declarado que no está en disco", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    const m = leerManifiesto(dir) as J;
    m["assets"].push({ path: "assets/fantasma.webp", sha256: "a".repeat(64), contentType: "image/webp", bytes: 10 });
    escribirManifiesto(dir, m);
    expect(mensajeDe(dir, "TPL_ASSET_FILE_MISSING"))
      .toContain('El manifiesto declara "assets/fantasma.webp" pero ese archivo no está en el paquete.');
  });

  it("una ruta de asset con subdirectorio o `..` se rechaza por el patrón", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    const m = leerManifiesto(dir) as J;
    m["assets"][0].path = "assets/../fuera.webp";
    escribirManifiesto(dir, m);
    expect(codigos(dir)).toContain("TPL_ASSET_PATH_INVALID");
  });

  it("dos assets con el mismo alias (I-09) se rechazan", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    const m = leerManifiesto(dir) as J;
    const alias = m["assets"].find((a: J) => a["id"]) as J;
    const otro = m["assets"].find((a: J) => !a["id"]) as J;
    otro["id"] = alias["id"];
    escribirManifiesto(dir, m);
    expect(codigos(dir)).toContain("TPL_ASSET_ALIAS_DUPLICATE");
  });

  it("una extensión fuera del enum de contentType se rechaza", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    writeFileSync(join(dir, "assets", "raro.txt"), "x", "utf8");
    const m = leerManifiesto(dir) as J;
    m["assets"].push({ path: "assets/raro.txt", sha256: "a".repeat(64), contentType: "image/webp", bytes: 1 });
    escribirManifiesto(dir, m);
    expect(codigos(dir)).toContain("TPL_ASSET_CONTENT_TYPE_UNKNOWN");
  });
});

describe("check: migraciones (01 §2.1)", () => {
  it("boda-clasica@1.0.1 trae su plan y pasa", () => {
    expect(codigos(join(PAQUETES, "boda-clasica/1.0.1"))).toEqual([]);
  });

  it("declarar `migrationsFrom` sin plan lo dice con el nombre exacto del archivo", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    const m = leerManifiesto(dir) as J;
    m["migrationsFrom"] = ["0.9.0"];
    escribirManifiesto(dir, m);
    const msg = mensajeDe(dir, "TPL_MIGRATION_PLAN_MISSING");
    expect(msg).toContain("falta migrations/0.9.0-to-1.0.0.json");
    expect(msg).toContain('"ops":[]');
    expect(msg).toContain("es `ops`, no `operations`");
  });

  it("un plan huérfano se rechaza", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    mkdirSync(join(dir, "migrations"));
    writeFileSync(join(dir, "migrations", "0.9.0-to-1.0.0.json"),
      JSON.stringify({ templateSlug: "xv-jardin", from: "0.9.0", to: "1.0.0", ops: [] }), "utf8");
    expect(codigos(dir)).toContain("TPL_MIGRATION_PLAN_ORPHAN");
  });

  it("un plan con la forma antigua `{from,to,operations}` se explica (trampa de handoffs/4-0a §3.5)", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    const m = leerManifiesto(dir) as J;
    m["migrationsFrom"] = ["0.9.0"];
    escribirManifiesto(dir, m);
    mkdirSync(join(dir, "migrations"));
    writeFileSync(join(dir, "migrations", "0.9.0-to-1.0.0.json"),
      JSON.stringify({ from: "0.9.0", to: "1.0.0", operations: [] }), "utf8");
    expect(mensajeDe(dir, "TPL_MIGRATION_PLAN_INVALID"))
      .toContain("NO `{from, to, operations}`");
  });

  it("un plan que se contradice con el nombre del archivo se rechaza", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    const m = leerManifiesto(dir) as J;
    m["migrationsFrom"] = ["0.9.0"];
    escribirManifiesto(dir, m);
    mkdirSync(join(dir, "migrations"));
    writeFileSync(join(dir, "migrations", "0.9.0-to-1.0.0.json"),
      JSON.stringify({ templateSlug: "otra", from: "0.8.0", to: "1.0.0", ops: [] }), "utf8");
    expect(codigos(dir)).toContain("TPL_MIGRATION_PLAN_MISMATCH");
  });
});

describe("check: invariantes del paquete", () => {
  it("una clave de defaults.json que no es un blockId sugiere las cercanas (I-10)", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    const d = JSON.parse(readFileSync(join(dir, "defaults.json"), "utf8")) as J;
    d["content"]["cover.titulo"] = { kind: "text", value: "x" };
    writeFileSync(join(dir, "defaults.json"), JSON.stringify(d, null, 2) + "\n", "utf8");
    const msg = mensajeDe(dir, "I-10_DEFAULT_KEY_UNKNOWN");
    expect(msg).toContain("defaults.json#/content/cover.titulo");
    expect(msg).toContain('¿Quisiste decir "cover.title"');
  });

  it("un rol singleton repetido (I-26) señala el bloque y explica la salida", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    const m = leerManifiesto(dir) as J;
    const cover = m["sections"][0];
    cover.blocks.push({
      id: "cover.title2", type: "text", role: "coverTitle", label: { "es-MX": "Otro título" },
    });
    escribirManifiesto(dir, m);
    const msg = mensajeDe(dir, "I-26_SINGLETON_ROLE_DUPLICATE");
    expect(msg).toContain("template.json#/sections/0/blocks/4");
    expect(msg).toContain("ese rol es singleton");
  });

  it("`defaults.json` que declara otra versión que el manifiesto", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    const d = JSON.parse(readFileSync(join(dir, "defaults.json"), "utf8")) as J;
    d["templateVersion"] = "2.0.0";
    writeFileSync(join(dir, "defaults.json"), JSON.stringify(d, null, 2) + "\n", "utf8");
    expect(mensajeDe(dir, "TPL_PACKAGE_DEFAULTS_MISMATCH"))
      .toContain('Pon `"templateSlug": "xv-jardin"` y `"templateVersion": "1.0.0"`');
  });

  it("hay ayuda escrita para TODOS los códigos que `validateManifest` puede emitir", () => {
    // Si alguien añade una invariante al manifiesto y no escribe su ayuda, esta prueba lo dice.
    const emitidos = [
      "I-01_RANGE_END_BEFORE_START", "I-02_CHOICE_UNKNOWN_OPTION", "I-03_ITEM_ID_DUPLICATE",
      "I-04_GROUP_SIZE_OUT_OF_BOUNDS", "I-05_BUSINESS_FIELD_MISSING", "I-06_BUSINESS_TYPE_MISMATCH",
      "I-07_GROUP_MIN_GT_MAX", "I-08_DEFAULT_VARIANT_UNKNOWN", "I-09_THEME_DEFAULT_UNKNOWN",
      "I-10_DEFAULT_KEY_UNKNOWN", "I-13_BLOCK_ID_DUPLICATE", "I-14_SECTION_KEY_DUPLICATE",
      "I-15_BLOCK_KIND_MISMATCH", "I-16_TEXT_TOO_LONG", "I-18_ITEM_BLOCK_UNKNOWN",
      "I-22_ITEM_BLOCK_SOURCE_NOT_USER", "I-25_GROUP_ROLE_MISMATCH", "I-26_SINGLETON_ROLE_DUPLICATE",
      "I-27_LOCALIZED_TEXT_MISSING_LOCALE", "I-28_DEFAULT_FOR_BUSINESS_BLOCK",
      "I-30_TEXT_MULTILINE_NOT_ALLOWED",
    ];
    for (const c of emitidos) expect(AYUDA_INVARIANTE[c], c).toBeTypeOf("string");
    expect(Object.keys(AYUDA_INVARIANTE).sort()).toEqual([...emitidos].sort());
  });
});

describe("check: el esquema del tema y del manifiesto", () => {
  it("un theme.json sin un token de color se explica", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    const t = JSON.parse(readFileSync(join(dir, "theme.json"), "utf8")) as J;
    delete t["palettes"][0].tokens.muted;
    escribirTema(dir, t);
    expect(mensajeDe(dir, "TPL_THEME_INVALID")).toContain("theme.json#/palettes/0/tokens/muted");
  });

  it("un manifiesto sin `slug` se explica con la forma del fichero", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    const m = leerManifiesto(dir) as J;
    delete m["slug"];
    escribirManifiesto(dir, m);
    expect(mensajeDe(dir, "TPL_MANIFEST_INVALID")).toContain("template.json es `{manifestVersion:1, slug,");
  });

  it("un tipo de bloque inventado sugiere los cercanos", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    const m = leerManifiesto(dir) as J;
    m["sections"][0].blocks[0].type = "texto";
    escribirManifiesto(dir, m);
    const msg = mensajeDe(dir, "TPL_BLOCK_TYPE_UNKNOWN");
    expect(msg).toContain('¿Quisiste decir "text"');
    expect(msg).toContain("Ejemplo mínimo de un bloque de texto:");
  });

  it("un tipo de sección inventado sugiere los cercanos", () => {
    const cerca = revisarVariantes({ sections: [{ type: "coverr", variants: [] }] });
    expect(cerca[0]!.codigo).toBe("TPL_SECTION_TYPE_UNKNOWN");
    expect(cerca[0]!.sugerencia).toContain('"cover"');
    // Y cuando no se parece a nada, remite a los 12 en vez de callarse.
    const lejos = revisarVariantes({ sections: [{ type: "portada", variants: [] }] });
    expect(lejos[0]!.sugerencia).toBe("¿Quisiste decir alguno de los 12?");
  });
});

describe("check: los dos avisos que el registro NO da", () => {
  it("rol fuera de su tipo de sección (ADR-4-0B-04) es aviso, y `--estricto` lo hace fallar", () => {
    const hs = revisarRolYSeccion({
      sections: [{ type: "event", blocks: [{ id: "event.familia", type: "group", role: "familyGroup" }] }],
    });
    expect(hs).toHaveLength(1);
    expect(hs[0]!.severidad).toBe("AVISO");
    expect(hs[0]!.codigo).toBe("TPL_ROLE_SECTION_MISMATCH");
    expect(hs[0]!.sugerencia).toContain("I-32 sin implementar");
  });

  it("`--estricto` convierte los avisos en fallo del check", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    const m = leerManifiesto(dir) as J;
    m["sections"][1].variants = ["portrait"];
    m["sections"][1].defaultVariant = "portrait";
    escribirManifiesto(dir, m);
    expect(check({ dir, escribir: false }).ok).toBe(true);
    expect(check({ dir, escribir: false, estricto: true }).ok).toBe(false);
    expect(mensajeDe(dir, "TPL_VARIANT_UNKNOWN"))
      .toContain("side-by-side, stacked, centered");
  });
});

describe("check: punteros", () => {
  it("encuentra el bloque y el itemBlock por su id", () => {
    const m = {
      sections: [{ blocks: [{ id: "event.cards", itemBlocks: [{ id: "title" }] }] }],
    };
    expect(punteroDeBloque(m, "event.cards")).toBe("template.json#/sections/0/blocks/0");
    expect(punteroDeBloque(m, "event.cards.title"))
      .toBe("template.json#/sections/0/blocks/0/itemBlocks/0");
    expect(punteroDeBloque(m, "no.existe")).toBeUndefined();
  });
});

describe("check: escritura de digestos", () => {
  it("no toca el paquete cuando no hay nada que corregir", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    const r = check({ dir, escribir: true });
    expect(r.escrituras).toEqual([]);
  });

  it("un paquete sin assets ni migraciones también se puede comprobar", () => {
    const dir = mkdtempSync(join(tmpdir(), "kit-min-"));
    writeFileSync(join(dir, "template.json"), "{}", "utf8");
    writeFileSync(join(dir, "theme.json"), "{}", "utf8");
    writeFileSync(join(dir, "defaults.json"), "{}", "utf8");
    const r = check({ dir });
    expect(r.ok).toBe(false);
    expect(r.hallazgos.some(h => h.codigo === "TPL_MANIFEST_INVALID")).toBe(true);
  });
});
