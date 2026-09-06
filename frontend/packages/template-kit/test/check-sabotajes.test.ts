// test/check-sabotajes.test.ts — LA PRUEBA DE QUE `check` NO ES VACUO.
//
// Se parte de un paquete CORRECTO y publicado (`frontend/templates/xv-jardin/1.0.0`, que el propio
// kit valida con 0 hallazgos y cuyo `package_hash` coincide con el que publica
// `memoria/handoffs/4-0a.md §4`) y se rompe de CINCO maneras distintas. Cada aserción compara la
// CADENA ENTERA del mensaje, no un `toContain`: el formato de tres líneas es contrato y la guía de
// 30 minutos lo cita literalmente.
//
// Tres de los cinco sabotajes son los tres fallos MEDIDOS en `evidencia/fase-3/i08-plantilla-minima`
// (rol inventado · `group` con `constraints` · digesto de `previewImage` equivocado). El criterio de
// aceptación no es que el mensaje exista: es que baste para arreglar el paquete sin abrir código.
import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { check } from "../src/check.ts";
import {
  copiarPaquete, escribirDefaults, escribirManifiesto, escribirTema, leerDefaults, leerManifiesto,
  leerTema, mensajeDe,
} from "./ayuda.ts";

type J = Record<string, any>;

describe("check: un paquete correcto roto de cinco maneras", () => {
  it("el paquete de partida está en verde y su package_hash es el publicado en handoffs/4-0a.md §4", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    const r = check({ dir, escribir: false });
    expect(r.hallazgos).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.packageHash).toBe("sha256:128c63473c87b7f7efac12b17301bf31fdb64558c0a0b7bfc39fa0681e9bf688");
  });

  it("1) rol inventado — el primer fallo medido de I-08", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    const m = leerManifiesto(dir) as J;
    m["sections"][1].blocks[1].role = "celebrantName";
    escribirManifiesto(dir, m);
    expect(mensajeDe(dir, "TPL_ROLE_UNKNOWN")).toBe(
      'ERROR TPL_ROLE_UNKNOWN  template.json#/sections/1/blocks/1/role\n' +
      '  El rol "celebrantName" del bloque "honoree.person" no está en el catálogo cerrado de 90 roles.\n' +
      '  Sugerencia: ¿Quisiste decir "celebrantA", "celebrantsDate", "celebrantAText"? ' +
      'Roles admitidos en una sección "celebrant" con bloques "person": celebrantA, celebrantB, honoree.',
    );
  });

  it("2) `group` con `constraints` — el segundo fallo medido, el del «0 are valid»", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    const m = leerManifiesto(dir) as J;
    const s = m["sections"].find((x: J) => x["key"] === "event");
    const g = s.blocks.find((b: J) => b["type"] === "group");
    delete g.itemLabel; delete g.itemBlocks; delete g.min; delete g.max;
    g.constraints = {};
    escribirManifiesto(dir, m);
    expect(mensajeDe(dir, "TPL_BLOCK_SPEC_INVALID")).toBe(
      'ERROR TPL_BLOCK_SPEC_INVALID  template.json#/sections/3/blocks/1\n' +
      '  El bloque "event.cards" no encaja en la rama `type: "group"` del esquema.\n' +
      '  Sugerencia: bloque `type: "group"`. Faltan: itemLabel, itemBlocks. ' +
      'No admite: constraints (esta rama admite id, role, label, help, required, editable, source, ' +
      'businessField, aiEditable, type, min, max, reorderable, itemLabel, itemBlocks). ' +
      'Ejemplo mínimo: {"id":"evento.momentos","type":"group","role":"eventCards","label":{"es-MX":"Momentos"},' +
      '"itemLabel":{"es-MX":"Momento"},"itemBlocks":[{"id":"titulo","type":"text","role":"eventTitle",' +
      '"label":{"es-MX":"Título"}}]}',
    );
  });

  it("3) previewImage con el digesto equivocado — el tercer fallo medido", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    const m = leerManifiesto(dir) as J;
    m["assets"].find((x: J) => x["path"] === m["previewImage"]).sha256 = "0".repeat(64);
    escribirManifiesto(dir, m);
    // Con `--no-escribir` es un ERROR (lo que rechazaría el registro).
    expect(mensajeDe(dir, "TPL_ASSET_DIGEST_MISMATCH", false)).toBe(
      'ERROR TPL_ASSET_DIGEST_MISMATCH  template.json#/assets/3\n' +
      '  El manifiesto declara "assets/preview.webp" con sha256 0000000000000000… y 60648 bytes, ' +
      'pero el archivo real es 91672579ac235a56… y 60648 bytes.\n' +
      `  Sugerencia: Ejecuta \`pnpm plantilla check ${dir}\` sin \`--no-escribir\` y el kit mide y ` +
      'escribe el digesto correcto; no lo teclees (P5). El registro rechaza el paquete con ' +
      '422 TPL_PACKAGE_ASSET_MISMATCH.',
    );
    // Por omisión, el kit lo MIDE y lo escribe (P5): lo derivado se genera, nunca se teclea.
    expect(mensajeDe(dir, "TPL_ASSET_DIGEST_MEDIDO", true)).toBe(
      'CORREGIDO TPL_ASSET_DIGEST_MEDIDO  template.json#/assets/3\n' +
      '  Los datos declarados de "assets/preview.webp" no coincidían con el archivo real y se han medido de nuevo.\n' +
      '  Sugerencia: Escrito sha256:91672579ac235a56… bytes:60648 contentType:image/webp. ' +
      'Los digestos NUNCA se teclean (P5): los mide `plantilla check`.',
    );
    // Y tras corregirlo, el paquete vuelve a estar en verde y recupera su package_hash publicado.
    const r = check({ dir, escribir: false });
    expect(r.ok).toBe(true);
    expect(r.packageHash).toBe("sha256:128c63473c87b7f7efac12b17301bf31fdb64558c0a0b7bfc39fa0681e9bf688");
  });

  it("4) un archivo que el paquete no declara (P1: nada se ignora en silencio)", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    writeFileSync(join(dir, "notas.md"), "# apuntes\n", "utf8");
    expect(mensajeDe(dir, "TPL_PACKAGE_UNEXPECTED_FILE")).toBe(
      'ERROR TPL_PACKAGE_UNEXPECTED_FILE  notas.md#$\n' +
      '  El paquete contiene "notas.md", que no está en el árbol permitido de 01 §2.1.\n' +
      '  Sugerencia: Un paquete sólo admite template.json, theme.json, defaults.json, ' +
      'assets/<archivo> (sin subdirectorios) y migrations/<archivo>.json. Saca ese archivo del ' +
      'directorio de la versión: el registro lo rechaza con TPL_PACKAGE_UNEXPECTED_FILE.',
    );
  });

  it("5) una paleta que ya no pasa AA (se devuelve `garden.accent` al valor previo a ADR-3-2d-04)", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    const t = leerTema(dir) as J;
    t["palettes"][0].tokens.accent = "#7CA35C";
    escribirTema(dir, t);
    expect(mensajeDe(dir, "TPL_PALETTE_CONTRAST_BELOW_AA")).toBe(
      'ERROR TPL_PALETTE_CONTRAST_BELOW_AA  theme.json#/palettes/0/tokens\n' +
      '  La paleta "garden" incumple 4 de las 9 parejas de contraste WCAG 2.2 AA: ' +
      'accentInk/accent #FFFFFF/#7CA35C = 2.90:1 < 4.5:1 (texto sobre botones/insignias de acento); ' +
      'accent/bg #7CA35C/#F6FAF3 = 2.74:1 < 3.0:1 (componentes de interfaz (1.4.11)); ' +
      'accent/bg (1.4.3) #7CA35C/#F6FAF3 = 2.74:1 < 4.5:1 (enlaces y horas en texto normal); ' +
      'accent/surface (1.4.3) #7CA35C/#FFFFFF = 2.90:1 < 4.5:1 (los mismos, sobre tarjetas).\n' +
      '  Sugerencia: Oscurece la tinta, nunca bajes el umbral (contratos.md §12.4). ' +
      'Valores que sí cumplen, calculados con la misma fórmula: accent: #7CA35C → #5D7A45.',
    );
    // Las cifras 2.90 y 2.74 son EXACTAMENTE las que midió ADR-3-2d-04 para `garden`
    // («accentInk/accent 2.89:1 · accent/bg 2.74:1»): la fórmula es la misma, no una copia.
  });

  it("6) marca ajena en el contenido de demostración (ADR-4-8-01): el texto que xv-jardin llevaba de fábrica", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    const d = leerDefaults(dir) as J;
    (d["content"] as J)["footer.note"].value = "Invitaciones Digitales Agape. Todos los derechos reservados.";
    escribirDefaults(dir, d);
    expect(mensajeDe(dir, "TPL_THIRD_PARTY_BRAND")).toBe(
      'ERROR TPL_THIRD_PARTY_BRAND  defaults.json#/content/footer.note/value\n' +
      '  El contenido de demostración del bloque "footer.note" menciona el proveedor del catálogo ' +
      'antiguo («Invitaciones Digitales Agape»): "Invitaciones Digitales Agape. Todos los derechos ' +
      'reservados.".\n' +
      '  Sugerencia: Lino & Sello es la marca del producto (D-02): quita la mención al proveedor ' +
      'anterior o al negocio/persona real. Escribe un texto neutro y ficticio verosímil, por ejemplo ' +
      '"Todos los derechos reservados" en un pie, o "Hotel Los Encinos" en una recomendación.',
    );
    // Y una vez restaurado el texto de fábrica (ya saneado), el paquete vuelve a estar en verde.
    const restaurado = leerDefaults(dir) as J;
    (restaurado["content"] as J)["footer.note"].value = "Todos los derechos reservados";
    escribirDefaults(dir, restaurado);
    const r = check({ dir, escribir: false });
    expect(r.hallazgos.filter(h => h.codigo === "TPL_THIRD_PARTY_BRAND")).toEqual([]);
  });

  it("7) enlace a un dominio ajeno en el contenido de demostración (ADR-4-9-01): el Facebook personal que llevaban 10 plantillas", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    const d = leerDefaults(dir) as J;
    (d["content"] as J)["celebrant.socialLink"] = { kind: "link", href: "https://www.facebook.com/marck.luga.39" };
    escribirDefaults(dir, d);
    expect(mensajeDe(dir, "TPL_THIRD_PARTY_LINK")).toBe(
      'ERROR TPL_THIRD_PARTY_LINK  defaults.json#/content/celebrant.socialLink/href\n' +
      '  El contenido de demostración del bloque "celebrant.socialLink" enlaza a "www.facebook.com", ' +
      'un dominio ajeno al producto: "https://www.facebook.com/marck.luga.39".\n' +
      '  Sugerencia: Un enlace real puede llevar al perfil, cuenta o negocio de un tercero que no dio ' +
      'su consentimiento para aparecer en una invitación de demostración. Usa un enlace que no ' +
      'resuelva a nadie, con dominio example.com (por ejemplo ' +
      '"https://www.example.com/celebrant-sociallink"): el cliente lo sustituye por el suyo al ' +
      'personalizar la invitación.',
    );
    // Y una vez quitado el bloque de sabotaje (no estaba en el paquete de fábrica), vuelve a verde.
    const restaurado = leerDefaults(dir) as J;
    delete (restaurado["content"] as J)["celebrant.socialLink"];
    escribirDefaults(dir, restaurado);
    const r = check({ dir, escribir: false });
    expect(r.hallazgos.filter(h => h.codigo === "TPL_THIRD_PARTY_LINK")).toEqual([]);
  });

  it("8) dato bancario sin marcar como ejemplo (ADR-4-9-01): la CLABE y el titular que llevaban 10 plantillas", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    const d = leerDefaults(dir) as J;
    (d["content"] as J)["gifts.bank"] = {
      kind: "listText",
      items: ["Banco: SANTANDER", "Titular: KARLA ZARATE CRUZ", "Cuenta CLABE: 014610606106246881"],
    };
    escribirDefaults(dir, d);
    expect(mensajeDe(dir, "TPL_THIRD_PARTY_BANK_DATA")).toBe(
      'ERROR TPL_THIRD_PARTY_BANK_DATA  defaults.json#/content/gifts.bank/items/2\n' +
      '  El contenido de demostración del bloque "gifts.bank" lleva un número largo sin marcar como ' +
      'ejemplo, con pinta de CLABE, cuenta o tarjeta real: "Cuenta CLABE: 014610606106246881".\n' +
      '  Sugerencia: Usa una cifra evidentemente ficticia (ceros o una secuencia 0123…) y dilo en el ' +
      'propio texto, por ejemplo "Cuenta CLABE: 000000000000000000 (ejemplo, sustitúyela por la ' +
      'tuya)". Nunca repitas un CLABE, cuenta o tarjeta reales, aunque vengan de la migración legada.',
    );
    // Un mismo número de ejemplo, EXPLÍCITAMENTE marcado como tal, no dispara el hallazgo (criterio
    // de ADR-4-9-01: no basta con que sea ficticio, el texto tiene que decirlo).
    const marcado = leerDefaults(dir) as J;
    (marcado["content"] as J)["gifts.bank"] = {
      kind: "listText",
      items: ["Cuenta CLABE: 000000000000000000 (ejemplo, sustitúyela por la tuya)"],
    };
    escribirDefaults(dir, marcado);
    expect(check({ dir, escribir: false }).hallazgos.filter(h => h.codigo === "TPL_THIRD_PARTY_BANK_DATA")).toEqual([]);
    // Y una vez quitado el bloque de sabotaje (no estaba en el paquete de fábrica), vuelve a verde.
    const restaurado = leerDefaults(dir) as J;
    delete (restaurado["content"] as J)["gifts.bank"];
    escribirDefaults(dir, restaurado);
    const r = check({ dir, escribir: false });
    expect(r.hallazgos.filter(h => h.codigo === "TPL_THIRD_PARTY_BANK_DATA")).toEqual([]);
  });
});

describe("check: el paquete correcto sigue en verde después de cada sabotaje deshecho", () => {
  it("previewImage que no está entre los assets declarados", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    const m = leerManifiesto(dir) as J;
    m["previewImage"] = "assets/portada.webp";
    escribirManifiesto(dir, m);
    expect(mensajeDe(dir, "TPL_PREVIEW_IMAGE_NOT_DECLARED")).toBe(
      'ERROR TPL_PREVIEW_IMAGE_NOT_DECLARED  template.json#/previewImage\n' +
      '  previewImage apunta a "assets/portada.webp", que no está entre los 5 assets declarados.\n' +
      '  Sugerencia: ¿Quisiste decir "assets/portrait-a.webp"? previewImage tiene que ser exactamente ' +
      'el `path` de una entrada de `assets`.',
    );
  });
});
