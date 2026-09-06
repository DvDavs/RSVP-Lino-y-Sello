// test/check.test.ts — el resto de `check`: árbol, migraciones, invariantes, avisos y punteros.
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AYUDA_INVARIANTE, check, familiaDeSlugFontsource, familiasAutoalojadas, familiasDeCss,
  FAMILIAS_AUTOALOJADAS_RESERVA, punteroDeBloque, remapearAFamiliaAutoalojada, revisarRolYSeccion,
  revisarVariantes, rutaPublicoCss,
} from "../src/check.ts";
import { copiarPaquete, escribirManifiesto, escribirTema, leerManifiesto, leerTema, mensajeDe, PAQUETES } from "./ayuda.ts";

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

// ---------------------------------------------------------------------------------------------
// Tipografías autoalojadas (4-6). La regresión que cierra: las 9 plantillas convertidas de F1
// heredaron las familias del legado (Great Vibes, Poppins, Sacramento, Work Sans), que el producto
// NO autoaloja, y `apps/web/test/fuentes-autoalojadas.test.ts` medía 34 pruebas rojas de 60. Aquí la
// misma compuerta actúa sobre el paquete SUELTO, antes de que entre al catálogo.
// ---------------------------------------------------------------------------------------------
describe("check: sólo familias que la superficie pública AUTOALOJA (ADR-1R-F-07, ADR-4-6-01)", () => {
  it("la lista SALE de publico.css: se lee el mismo archivo, con el mismo patrón que la prueba de apps/web", () => {
    const ruta = rutaPublicoCss();
    expect(ruta, "no se encontró apps/web/app/(public)/publico.css subiendo desde el kit").toBeDefined();
    const css = readFileSync(ruta!, "utf8");
    // El patrón es el de `apps/web/test/fuentes-autoalojadas.test.ts`: familia+peso por `@import`.
    const pares = [...css.matchAll(/@import\s+"@fontsource\/([^"/]+)\/(\d+)\.css"/g)]
      .map(m => `${m[1]}/${m[2]}`);
    expect(pares.length).toBeGreaterThan(0);
    const derivadas = familiasAutoalojadas().flatMap(f => f.weights.map(w => `${f.family}/${w}`)).sort();
    expect(derivadas).toEqual([...new Set(pares)].map(p => {
      const [slug, peso] = p.split("/") as [string, string];
      return `${familiaDeSlugFontsource(slug)}/${peso}`;
    }).sort());
  });

  it("el valor de reserva NO puede quedarse viejo en silencio: coincide con lo que publico.css declara", () => {
    expect(FAMILIAS_AUTOALOJADAS_RESERVA).toEqual(familiasAutoalojadas());
  });

  it("el parser agrupa por familia, ordena los pesos y no duplica", () => {
    const css = '@import "@fontsource/source-sans-3/600.css";\n@import "@fontsource/source-sans-3/400.css";\n'
      + '@import "@fontsource/source-sans-3/400.css";\n@import "@fontsource/inter/400.css";\n@import "algo/otro.css";';
    expect(familiasDeCss(css)).toEqual([
      { family: "Inter", weights: [400] },
      { family: "Source Sans 3", weights: [400, 600] },
    ]);
  });

  it("TODA familia del catálogo de `frontend/templates` está autoalojada (la misma compuerta, por paquete)", () => {
    const autoalojadas = new Set(familiasAutoalojadas().map(f => f.family));
    const slugs = readdirSync(PAQUETES, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
    let sets = 0;
    for (const slug of slugs) {
      const dir = join(PAQUETES, slug, "1.0.0");
      if (!existsSync(join(dir, "theme.json"))) continue;
      const tema = leerTema(dir) as J;
      for (const fs of tema["fontSets"] as J[]) {
        sets++;
        for (const rol of ["heading", "body"] as const) {
          expect(autoalojadas, `${slug} fontSets[${fs["id"]}].${rol}`).toContain((fs[rol] as J)["family"]);
        }
      }
    }
    expect(sets).toBeGreaterThan(0);
  });

  it("una familia manuscrita en el tema se RECHAZA, con el mensaje entero del kit", () => {
    const dir = copiarPaquete("bautizo-elegante/1.0.0");
    const tema = leerTema(dir) as J;
    tema["fontSets"][0].heading = { family: "Great Vibes", weights: [400, 700], source: "google" };
    escribirTema(dir, tema);
    expect(mensajeDe(dir, "TPL_FONT_NOT_SELF_HOSTED")).toBe(
      'ERROR TPL_FONT_NOT_SELF_HOSTED  theme.json#/fontSets/0/heading/family\n'
      + '  El fontSet "cormorant-garamond-inter" declara la familia "Great Vibes" en heading y la superficie pública NO la autoaloja: esa invitación se pintaría con la pila de reserva (Georgia / la sans del sistema).\n'
      + '  Sugerencia: Familias autoalojadas hoy, con sus pesos, en apps/web/app/(public)/publico.css: '
      + 'Cormorant Garamond (400, 600), Inter (400, 500), Playfair Display (400, 700), Source Sans 3 (400, 600). '
      + 'La más cercana a "Great Vibes" es "Cormorant Garamond" con pesos [400, 600] — '
      + '«Great Vibes» es una tipografía MANUSCRITA (script) y NINGUNA de las familias que el producto autoaloja lo es: '
      + 'no hay equivalente. Se sustituye por «Cormorant Garamond», la serif de titular de trazo más caligráfico y mayor '
      + 'contraste de las autoalojadas; el titular pierde la letra manuscrita y hay que restaurarlo en la fase de arte. '
      + 'Escríbela en theme.json, o autoaloja la original (`pnpm add @fontsource/great-vibes` en apps/web y su `@import` '
      + 'en publico.css): la superficie pública nunca pide una fuente a un tercero en tiempo de ejecución (ADR-1R-F-07).',
    );
  });

  it("una sans de texto fuera de la lista también se rechaza, y la sugerencia es la sans autoalojada", () => {
    const dir = copiarPaquete("bautizo-elegante/1.0.0");
    const tema = leerTema(dir) as J;
    tema["fontSets"][0].body = { family: "Poppins", weights: [400, 600], source: "google" };
    escribirTema(dir, tema);
    const m = mensajeDe(dir, "TPL_FONT_NOT_SELF_HOSTED");
    expect(m).toContain("theme.json#/fontSets/0/body/family");
    expect(m).toContain('La más cercana a "Poppins" es "Inter" con pesos [400, 500]');
    expect(m).toContain("«Poppins» es una sans geométrica");
  });

  it("el paquete tal y como sale de la conversión NO tiene ningún hallazgo de fuentes", () => {
    expect(codigos(join(PAQUETES, "bautizo-elegante/1.0.0"))).not.toContain("TPL_FONT_NOT_SELF_HOSTED");
    expect(codigos(join(PAQUETES, "xv-jardin/1.0.0"))).not.toContain("TPL_FONT_NOT_SELF_HOSTED");
  });

  it("el criterio de remapeo, familia por familia (ADR-4-6-01)", () => {
    const r = (f: string, rol: "heading" | "body" = "heading") => remapearAFamiliaAutoalojada(f, rol);
    // Script: NO hay equivalente autoalojada, y el motivo lo dice con esas palabras.
    expect(r("Great Vibes").family).toBe("Cormorant Garamond");
    expect(r("Sacramento").family).toBe("Cormorant Garamond");
    expect(r("Great Vibes").clase).toBe("script");
    expect(r("Sacramento").motivo).toContain("no hay equivalente");
    // Sans de texto.
    expect(r("Poppins", "body").family).toBe("Inter");
    expect(r("Work Sans", "body").family).toBe("Inter");
    expect(r("Open Sans", "body").family).toBe("Source Sans 3");
    // Serif de titular: old style ↔ alto contraste.
    expect(r("EB Garamond").family).toBe("Cormorant Garamond");
    expect(r("Prata").family).toBe("Playfair Display");
    // Ya autoalojada: no se remapea y los pesos son los que publico.css importa.
    expect(r("Playfair Display")).toMatchObject({ yaAutoalojada: true, family: "Playfair Display", weights: [400, 700] });
    expect(r("Inter", "body")).toMatchObject({ yaAutoalojada: true, weights: [400, 500] });
    // Familia desconocida: cae por su PAPEL, y el motivo dice que no está clasificada.
    expect(r("Fuente Inventada Xyz").family).toBe("Cormorant Garamond");
    expect(r("Fuente Inventada Xyz", "body").family).toBe("Inter");
    expect(r("Fuente Inventada Xyz").motivo).toContain("no está clasificada en la tabla del kit");
  });
});
