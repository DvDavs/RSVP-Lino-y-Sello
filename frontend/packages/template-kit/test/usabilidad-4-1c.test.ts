// test/usabilidad-4-1c.test.ts — las correcciones que destapó la prueba cronometrada (bitácora 4-5).
//
// Cada `it` reproduce UN punto exacto donde la prueba de usabilidad se atascó, y compara la CADENA
// ENTERA del mensaje (no un `toContain`): el formato de tres líneas es contrato y la guía lo cita
// literalmente. Los cuatro puntos son:
//   1. `richText` sin forma documentada: el mensaje de `defaults` no traía el ejemplo del valor
//      (bitácora 4-5 §4, «dos rondas de tanteo»; el bloqueo que hundió el veredicto).
//   2. El `label` del andamio, escrito con la frase de ayuda del catálogo, se publica en la
//      invitación (bitácora 4-5 §6, encontrado mirando una captura porque nada avisaba).
//   3. `itemId` y alias de asset: el alfabeto Crockford sin I, L, O ni U no estaba en ninguna frase,
//      sólo como expresión regular (bitácora 4-5 §5 y bitácora 4-3 §4).
//   4. `doctor` no veía un `pnpm install` a medias fuera del propio kit (bitácora 4-5 §1).
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ejecutar } from "../src/cli.ts";
import { check } from "../src/check.ts";
import { diagnosticar, type EntornoDoctor } from "../src/doctor.ts";
import { ETIQUETA_POR_ROL, escribirPaquete, etiquetaPresentable, textoDeRelleno } from "../src/nueva.ts";
import { CATALOG_SECTION_TYPES, sectionCatalog } from "@invitaciones/sections/catalog";
import {
  copiarPaquete, escribirDefaults, escribirManifiesto, leerDefaults, leerManifiesto, mensajeDe,
} from "./ayuda.ts";

type J = Record<string, any>;

const AQUI = fileURLToPath(new URL(".", import.meta.url));
const KIT = resolve(AQUI, "..");

/** Un paquete de trabajo recién generado por el andamio, fuera de `frontend/templates`. */
function andamio(secciones: string[] = ["cover", "celebrant", "family", "event", "rsvp", "footer"]): string {
  const destino = mkdtempSync(join(tmpdir(), "kit-1c-"));
  return escribirPaquete(destino, { slug: "taller", evento: "graduation", secciones }).dir;
}

// ---------------------------------------------------------------------------------------------
// 1. `richText`: el mensaje trae el ejemplo mínimo del VALOR.
// ---------------------------------------------------------------------------------------------
describe("1. defaults.json de un tipo que el autor no conoce (bitácora 4-5 §4)", () => {
  it("un `richText` escrito como si fuera un `text` explica la forma entera, con ejemplo copiable", () => {
    const dir = andamio(["cover", "celebrant"]);
    const m = leerManifiesto(dir) as J;
    // El hueco `celebrant.message` es opcional: el autor lo añade a mano, como hizo la prueba 4-5.
    m["sections"][1].blocks.push({
      id: "celebrant.message", type: "richText", role: "honoreeMessage",
      label: { "es-MX": "Mensaje" },
    });
    escribirManifiesto(dir, m);
    const d = leerDefaults(dir) as J;
    d["content"]["celebrant.message"] = { kind: "richText", value: "Gracias por acompañarme." };
    escribirDefaults(dir, d);

    expect(mensajeDe(dir, "TPL_DEFAULTS_INVALID")).toBe(
      "ERROR TPL_DEFAULTS_INVALID  defaults.json#/content/celebrant.message\n" +
      '  Unrecognized key: "value" (unrecognized_keys).\n' +
      '  Sugerencia: El bloque "celebrant.message" es de tipo `richText`: Texto con párrafos y ' +
      "marcas cerradas (negrita, cursiva, enlace); nunca HTML libre. Campos obligatorios del valor: " +
      "kind, doc. Ejemplo mínimo, copiable tal cual en defaults.json: " +
      '{"kind":"richText","doc":{"type":"doc","content":[{"type":"paragraph","content":' +
      '[{"type":"text","text":"Hola"}]}]}}. ' +
      "La forma de cualquier tipo de bloque, sin abrir código: `pnpm plantilla bloque richText`.",
    );
  });

  it("el ejemplo que da el mensaje, pegado tal cual, deja el paquete en verde (no hay que adivinar)", () => {
    const dir = andamio(["cover", "celebrant"]);
    const m = leerManifiesto(dir) as J;
    m["sections"][1].blocks.push({
      id: "celebrant.message", type: "richText", role: "honoreeMessage", label: { "es-MX": "Mensaje" },
    });
    escribirManifiesto(dir, m);
    const d = leerDefaults(dir) as J;
    // Copiado literalmente de la sugerencia de arriba, sin tocar una coma.
    d["content"]["celebrant.message"] = JSON.parse(
      '{"kind":"richText","doc":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hola"}]}]}}',
    );
    escribirDefaults(dir, d);
    const r = check({ dir, escribir: false });
    expect(r.hallazgos).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("dentro de una ficha de grupo, el mensaje resuelve el tipo del bloque de la ficha", () => {
    const dir = andamio(["cover", "event"]);
    const d = leerDefaults(dir) as J;
    d["content"]["event.cards"].items[0].values["place"] = { kind: "location", nombre: "Jardín" };
    escribirDefaults(dir, d);
    expect(mensajeDe(dir, "TPL_DEFAULTS_INVALID")).toBe(
      "ERROR TPL_DEFAULTS_INVALID  defaults.json#/content/event.cards/items/0/values/place\n" +
      '  Unrecognized key: "nombre" (unrecognized_keys).\n' +
      '  Sugerencia: El bloque "event.cards → place" es de tipo `location`: Un lugar con nombre, ' +
      "dirección opcional y enlace opcional al mapa. Campos obligatorios del valor: kind, name. " +
      'Ejemplo mínimo, copiable tal cual en defaults.json: {"kind":"location","name":"Jardín Las Rosas"}. ' +
      "La forma de cualquier tipo de bloque, sin abrir código: `pnpm plantilla bloque location`.",
    );
  });

  it("`plantilla bloque richText` enseña la forma sin abrir código, y un tipo inventado sugiere", () => {
    const r = ejecutar(["bloque", "richText"]);
    expect(r.codigo).toBe(0);
    expect(r.salida.split("\n")[0]).toBe(
      "richText — Texto con párrafos y marcas cerradas (negrita, cursiva, enlace); nunca HTML libre.",
    );
    expect(r.salida).toContain('"kind": "richText"');
    expect(r.salida).toContain('"type": "doc"');
    expect(r.salida).toContain('"type": "paragraph"');

    const malo = ejecutar(["bloque", "richtext"]);
    expect(malo.codigo).toBe(2);
    expect(malo.salida).toContain("richText");

    const lista = ejecutar(["bloque"]);
    expect(lista.codigo).toBe(0);
    expect(lista.salida.split("\n")[0]).toBe(
      "Los 14 tipos de bloque. `pnpm plantilla bloque <tipo>` da la ficha completa de uno.",
    );
    expect(lista.salida).toContain('richText — ');
  });

  it("`plantilla secciones` remata diciendo dónde se ve la forma de un tipo", () => {
    const r = ejecutar(["secciones", "story"]);
    expect(r.codigo).toBe(0);
    expect(r.salida.endsWith(
      "Cada hueco dice de qué TIPO es. Para ver qué se escribe dentro de un tipo:\n" +
      "  pnpm plantilla bloque <tipo>   (por ejemplo `pnpm plantilla bloque richText`)",
    )).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// 2. El `label` del andamio se publica.
// ---------------------------------------------------------------------------------------------
describe("2. etiquetas del andamio que se publican (bitácora 4-5 §6)", () => {
  it("el andamio escribe etiquetas presentables, NUNCA la frase de ayuda del catálogo", () => {
    // Los 90 roles del catálogo, no sólo los del andamio: así el AVISO siempre puede proponer un
    // rótulo, también para un bloque opcional que el autor añada leyendo `plantilla secciones`.
    for (const tipo of CATALOG_SECTION_TYPES) {
      for (const slot of sectionCatalog[tipo].slots) {
        const huecos = [slot, ...(slot.itemBlocks ?? [])];
        for (const h of huecos) {
          const etiqueta = etiquetaPresentable(h);
          expect(etiqueta.length, `${tipo}/${h.blockId}`).toBeLessThanOrEqual(30);
          expect(etiqueta, `${tipo}/${h.blockId}`).not.toBe("");
          // Rótulo, no frase: ≤ 4 palabras. La prosa de ayuda del catálogo («Lista repetible de
          // personas de la familia con su etiqueta», 9 palabras) no pasa por aquí ni por casualidad.
          expect(etiqueta.split(" ").length, `${tipo}/${h.blockId}`).toBeLessThanOrEqual(4);
          if (textoDeRelleno(h).split(" ").length > 4) {
            expect(etiqueta, `${tipo}/${h.blockId}`).not.toBe(textoDeRelleno(h));
          }
        }
      }
    }
    // Y `familyGroup`, el que se coló en la captura de la prueba 4-5, es exactamente el rótulo que
    // aquella autora tuvo que escribir a mano.
    expect(ETIQUETA_POR_ROL["familyGroup"]).toBe("Familia");
  });

  it("un andamio de las 12 secciones pasa `check` con 0 errores y 0 avisos", () => {
    const dir = andamio([...CATALOG_SECTION_TYPES]);
    const r = check({ dir, escribir: false });
    expect(r.hallazgos).toEqual([]);
  });

  it("una etiqueta dejada tal como la escribía el andamio viejo es un AVISO con el rótulo sugerido", () => {
    const dir = andamio(["cover", "family"]);
    const m = leerManifiesto(dir) as J;
    const grupo = m["sections"][1].blocks.find((b: J) => b["id"] === "family.members");
    grupo.label = { "es-MX": sectionCatalog.family.slots.find(s => s.blockId === "members")!.purpose.replace(/\.$/, "") };
    escribirManifiesto(dir, m);
    expect(mensajeDe(dir, "TPL_LABEL_DE_ANDAMIO")).toBe(
      "AVISO TPL_LABEL_DE_ANDAMIO  template.json#/sections/1/blocks/1/label/es-MX\n" +
      '  La etiqueta "Lista repetible de personas de la familia con su etiqueta" del bloque ' +
      '"family.members" es la frase con la que el catálogo describe ese hueco, no un texto tuyo.\n' +
      "  Sugerencia: El `label` no se queda en el editor: una sección `family` lo publica tal cual " +
      "(título del grupo y parentesco debajo de cada nombre, FamilySection.tsx:71,198). Escribe en " +
      'template.json una etiqueta corta y presentable (por ejemplo "Familia") y repite `plantilla check`.',
    );
  });

  it("el aviso es aviso, no error: el paquete sigue registrándose (y `--estricto` lo pone rojo)", () => {
    const dir = andamio(["cover", "family"]);
    const m = leerManifiesto(dir) as J;
    m["sections"][1].blocks[1].label = { "es-MX": "Lista repetible de personas de la familia con su etiqueta" };
    escribirManifiesto(dir, m);
    expect(check({ dir, escribir: false }).ok).toBe(true);
    expect(check({ dir, escribir: false, estricto: true }).ok).toBe(false);
  });

  it("una etiqueta escrita por el autor no dispara nada, ni siquiera si es corta", () => {
    const dir = andamio(["cover", "family"]);
    const m = leerManifiesto(dir) as J;
    m["sections"][1].blocks[1].label = { "es-MX": "Mi familia" };
    escribirManifiesto(dir, m);
    expect(check({ dir, escribir: false }).hallazgos).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// 3. El alfabeto de los identificadores, en una frase.
// ---------------------------------------------------------------------------------------------
describe("3. itemId y alias de asset (bitácora 4-5 §5, bitácora 4-3 §4)", () => {
  it("un `itemId` con una letra prohibida dice cuál es el alfabeto y da uno válido", () => {
    const dir = andamio(["cover", "event"]);
    const d = leerDefaults(dir) as J;
    d["content"]["event.cards"].items[0].itemId = "0ULIDINVALIDO123456789ABCD";
    escribirDefaults(dir, d);
    expect(mensajeDe(dir, "TPL_DEFAULTS_INVALID")).toBe(
      "ERROR TPL_DEFAULTS_INVALID  defaults.json#/content/event.cards/items/0/itemId\n" +
      "  Invalid string: must match pattern /^[0-9A-HJKMNP-TV-Z]{26}$/ (invalid_format).\n" +
      "  Sugerencia: Cada ficha de un grupo lleva su `itemId`: 26 caracteres en MAYÚSCULAS y dígitos " +
      "del alfabeto Crockford base32 (0123456789ABCDEFGHJKMNPQRSTVWXYZ): NO admite las letras I, L, " +
      'O ni U. Por ejemplo "07VQMDEJKM2DX903CG3FJYEZ85". Es lo que hace que al reordenar o regenerar ' +
      "no se pierda lo que escribiste en esa ficha (P2, merge por id estable), y no se ve en la invitación.",
    );
  });

  it("el `itemId` de ejemplo que propone el mensaje es válido de verdad", () => {
    const dir = andamio(["cover", "event"]);
    const d = leerDefaults(dir) as J;
    d["content"]["event.cards"].items[0].itemId = "07VQMDEJKM2DX903CG3FJYEZ85";
    escribirDefaults(dir, d);
    expect(check({ dir, escribir: false }).hallazgos).toEqual([]);
  });

  it("el alias de un asset del manifiesto explica el mismo alfabeto (bitácora 4-3 §4)", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    const m = leerManifiesto(dir) as J;
    m["assets"][0].id = "as_01HQZX8Y6K7M9N0P1Q2R3S4TU5";
    escribirManifiesto(dir, m);
    expect(mensajeDe(dir, "TPL_MANIFEST_INVALID", false)).toBe(
      "ERROR TPL_MANIFEST_INVALID  template.json#/assets/0/id\n" +
      "  Invalid string: must match pattern /^as_[0-9A-HJKMNP-TV-Z]{26}$/ (invalid_format).\n" +
      "  Sugerencia: El `id` de una entrada de `assets` es el alias con el que defaults.json " +
      "referencia esa imagen: `as_` seguido de 26 caracteres en MAYÚSCULAS y dígitos del alfabeto " +
      "Crockford base32 (0123456789ABCDEFGHJKMNPQRSTVWXYZ): NO admite las letras I, L, O ni U. " +
      'Por ejemplo "as_BX8D8RNQ55Z6VBBRGYS12ZSKHD". Lo inventas tú (no hace falta que sea un ULID ' +
      "de verdad) y tiene que ser único en el paquete.",
    );
  });
});

// ---------------------------------------------------------------------------------------------
// 4. `doctor` y el arranque sin `pnpm install`.
// ---------------------------------------------------------------------------------------------
describe("4. un `pnpm install` a medias (bitácora 4-5 §1)", () => {
  function entorno(existe: (r: string) => boolean): EntornoDoctor {
    return {
      env: { TPL_DEV_BASE: "http://127.0.0.1:6099" },
      nodeVersion: "v22.22.2",
      raiz: "/repo",
      ejecutar: () => ({ codigo: 0, salida: "10.33.0" }),
      sondear: () => 200,
      existe,
    };
  }

  it("doctor mira TODO el workspace, no sólo el node_modules del kit", () => {
    const soloElKit = (r: string) => r.includes("template-kit");
    const d = diagnosticar(entorno(soloElKit)).find(x => x.nombre === "Dependencias instaladas")!;
    expect(d.estado).toBe("falta");
    expect(d.detalle).toBe(
      "falta la raíz del monorepo (frontend/node_modules), @invitaciones/schema " +
      "(frontend/packages/schema/node_modules), @invitaciones/sections (frontend/packages/sections/node_modules)",
    );
    expect(d.arreglo).toBe(
      "`cd frontend && pnpm install` (instala TODO el workspace, no sólo el kit: `plantilla` importa " +
      "@invitaciones/schema y @invitaciones/sections y arranca con tsx). Sin eso, `pnpm plantilla` " +
      "no llega ni a ejecutarse.",
    );
  });

  it("con todo instalado, la comprobación pasa y nombra las cinco rutas", () => {
    const d = diagnosticar(entorno(() => true)).find(x => x.nombre === "Dependencias instaladas")!;
    expect(d.estado).toBe("ok");
    expect(d.detalle).toBe("5 rutas del workspace instaladas (raíz, kit, tsx, schema, sections)");
  });

  it("sin node_modules, `plantilla` imprime el diagnóstico en vez de `tsx: not found`", () => {
    // El lanzador deduce las rutas de su propia ubicación: se copia a un árbol de mentira que imita
    // el monorepo SIN instalar, que es exactamente el worktree recién creado de la bitácora 4-5.
    const raiz = mkdtempSync(join(tmpdir(), "kit-1c-vacio-"));
    const bin = join(raiz, "frontend/packages/template-kit/bin");
    mkdirSync(bin, { recursive: true });
    cpSync(join(KIT, "bin/plantilla.mjs"), join(bin, "plantilla.mjs"));
    const r = spawnSync(process.execPath, [join(bin, "plantilla.mjs"), "doctor"], { encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stdout).toBe(
      "FALTA Dependencias instaladas: el monorepo no está instalado del todo, así que `plantilla` no puede arrancar\n" +
      `      - las dependencias del propio kit (${raiz}/frontend/packages/template-kit/node_modules)\n` +
      `      - el runner de TypeScript (\`tsx\`) (${raiz}/frontend/packages/template-kit/node_modules/.bin/tsx)\n` +
      `      - las dependencias de la raíz del monorepo (${raiz}/frontend/node_modules)\n` +
      `      - las dependencias de @invitaciones/schema (${raiz}/frontend/packages/schema/node_modules)\n` +
      `      - las dependencias de @invitaciones/sections (${raiz}/frontend/packages/sections/node_modules)\n` +
      "      `cd frontend && pnpm install` (instala TODO el workspace, no sólo el kit; tarda unos segundos\n" +
      "      si el store de pnpm ya está caliente). Después repite este mismo comando.\n" +
      "\n1 comprobación(es) · 1 sin resolver · 0 aviso(s)\n",
    );
  });

  it("con el workspace instalado, el lanzador despacha al CLI de verdad", () => {
    const r = spawnSync(process.execPath, [join(KIT, "bin/plantilla.mjs"), "bloque", "text"], { encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(r.stdout.split("\n")[0]).toBe(
      "text — Una línea o un párrafo de texto plano, con longitud mínima y máxima por plantilla.",
    );
  });
});

// ---------------------------------------------------------------------------------------------
// 5. El ejemplo de `--destino` de la guía, ejecutado tal como lo dice ahora.
// ---------------------------------------------------------------------------------------------
describe("5. `--destino` no lleva el slug (bitácora 4-5 §3)", () => {
  it("`--destino <dir>` escribe en <dir>/<slug>/<version>, así que el slug NO va en la ruta", () => {
    const raiz = mkdtempSync(join(tmpdir(), "kit-1c-destino-"));
    const r = escribirPaquete(raiz, { slug: "mi-boda", evento: "wedding", secciones: ["cover", "footer"] });
    expect(r.dir).toBe(join(raiz, "mi-boda", "1.0.0"));
    // Y con el slug repetido en `--destino`, el resultado es el directorio duplicado que confundió
    // a la prueba 4-5: la guía ya no lo escribe así.
    const conSlug = escribirPaquete(join(raiz, "mi-boda"), {
      slug: "mi-boda", evento: "wedding", secciones: ["cover", "footer"],
    });
    expect(conSlug.dir).toBe(join(raiz, "mi-boda", "mi-boda", "1.0.0"));
  });

  it("el fichero de ayuda del CLI dice qué cuelga de `--destino`", () => {
    const ayuda = ejecutar(["ayuda"]).salida;
    expect(ayuda).toContain("<destino>/<slug>/<version>/");
  });
});
