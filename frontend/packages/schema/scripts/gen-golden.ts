// packages/schema/scripts/gen-golden.ts — entrypoint único: `pnpm --filter @invitaciones/schema run gen:golden`.
// Regenera TODOS los golden files (contratos.md §3/§6, ADR-1R-D-09: generados, nunca a mano).
import { genGoldenTemplates } from "./gen-golden-templates.ts";

console.log("== golden/templates ==");
for (const { dir, matched } of genGoldenTemplates())
  console.log(`  ${dir}: ${matched ? "OK (coincide con diseno/ejemplos)" : "AVISO: no coincide con diseno/ejemplos"}`);

console.log("== golden/invariants ==");
await import("./gen-golden-invariants.ts");

console.log("== golden/blocks ==");
await import("./gen-golden-blocks.ts");

console.log("== golden/operations ==");
await import("./gen-golden-operations.ts");

console.log("== golden/migrations ==");
await import("./gen-golden-migrations.ts");

console.log("gen:golden — listo.");
