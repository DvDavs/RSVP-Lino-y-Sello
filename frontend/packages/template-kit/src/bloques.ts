// packages/template-kit/src/bloques.ts — `plantilla bloque [<tipo>]`: la forma de un tipo de bloque.
//
// Por qué existe: la prueba cronometrada de la bitácora 4-5 (§4 y «cosas que tuve que adivinar» #1)
// se atascó en un bloque `richText` porque su forma —`doc` con párrafos, tres niveles de anidamiento—
// no estaba escrita en ningún sitio que un autor pueda leer: ni en la guía, ni en `plantilla
// secciones` (que dice de qué TIPO es cada hueco, pero no qué se escribe dentro), ni en el mensaje de
// `check`. El vocabulario ya existía: `describeBlockType` de `@invitaciones/schema` (handoffs/4-0b.md)
// deriva de Zod la rama del `oneOf` y su ejemplo mínimo. Aquí sólo se imprime, sin transcribir nada.
import { BLOCK_TYPES, describeBlockType } from "@invitaciones/schema";

/** JSON con sangría de dos espacios, indentado dentro del bloque de texto de la terminal. */
function bonito(valor: unknown, sangria: string): string {
  return JSON.stringify(valor, null, 2).split("\n").join(`\n${sangria}`);
}

/** Ficha de UN tipo de bloque: qué es, qué se escribe en defaults.json y qué en template.json. */
export function fichaDeBloque(tipo: string): string {
  const info = describeBlockType(tipo);
  const lineas: string[] = [
    `${info.type} — ${info.summary}`,
    "",
    `  EL VALOR, en defaults.json bajo "<blockId>" (campos obligatorios: ${info.value.required.join(", ")}${
      info.value.optional.length > 0 ? `; opcionales: ${info.value.optional.join(", ")}` : ""}):`,
    `    ${bonito(info.minimalValue, "    ")}`,
    "",
    `  EL BLOQUE, en template.json dentro de \`sections[].blocks\` (campos obligatorios: ${info.spec.required.join(", ")}):`,
    `    ${bonito(info.minimalSpec, "    ")}`,
    "",
    `  Roles que admiten este tipo: ${info.roles.length > 0 ? info.roles.join(", ") : "(ninguno declarado)"}.`,
  ];
  return lineas.join("\n");
}

/** Los 14 tipos, con su resumen y el valor mínimo en una línea. */
export function listaDeBloques(): string {
  const lineas: string[] = [
    `Los ${BLOCK_TYPES.length} tipos de bloque. \`pnpm plantilla bloque <tipo>\` da la ficha completa de uno.`,
    "",
  ];
  for (const t of BLOCK_TYPES) {
    const info = describeBlockType(t);
    lineas.push(`${t} — ${info.summary}`);
    lineas.push(`  valor mínimo: ${JSON.stringify(info.minimalValue)}`);
  }
  return lineas.join("\n");
}
