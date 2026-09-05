#!/usr/bin/env node
// scripts/verify-contrast.ts — COMPUERTA de contraste. Recorre las parejas garantizadas de
// `src/semantica.ts` en las tres paletas y en los dos temas, calcula el ratio WCAG 2.x e imprime la
// tabla. Sale con 1 si alguna pareja baja de su umbral (4,5 texto normal; 3,0 gráfico declarado).
//
//   node scripts/verify-contrast.ts                       tabla completa (la de 11 §1.6)
//   node scripts/verify-contrast.ts --activa              solo la paleta activa
//   node scripts/verify-contrast.ts --json                semántica resuelta, para herramientas
//   node scripts/verify-contrast.ts --sabotear=ink=#fdf9f6   autoprueba: la compuerta DEBE caer
//
// `--sabotear` existe para demostrar que esto no es un adorno: `test/scripts.test.ts` lo ejecuta y
// exige código 1. Nunca se usa en producto.
import { PALETAS, type PaletaId } from "../src/paletas.ts";
import { PALETA_ACTIVA } from "../src/paletas.ts";
import { ROLES_COLOR, type RolColor } from "../src/semantica.ts";
import { semanticaResuelta, tablaContraste, verificarParejas, type Sabotaje } from "../src/contraste.ts";

const argv = process.argv.slice(2);

function leerSabotaje(): Sabotaje | undefined {
  const bandera = argv.find((a) => a.startsWith("--sabotear="));
  if (!bandera) return undefined;
  const sabotaje: Sabotaje = {};
  for (const par of bandera.slice("--sabotear=".length).split(",")) {
    const [rol, hex] = par.split("=");
    if (!ROLES_COLOR.includes(rol as RolColor)) {
      console.error(`Rol desconocido en --sabotear: ${rol}`);
      process.exit(2);
    }
    if (!/^#[0-9a-f]{6}$/.test(hex ?? "")) {
      console.error(`Hex inválido en --sabotear: ${hex}`);
      process.exit(2);
    }
    sabotaje[rol as RolColor] = hex;
  }
  return sabotaje;
}

const sabotaje = leerSabotaje();
const paletas = argv.includes("--activa") ? [PALETAS[PALETA_ACTIVA]] : Object.values(PALETAS);

if (argv.includes("--json")) {
  const salida: Partial<Record<PaletaId, ReturnType<typeof semanticaResuelta>>> = {};
  for (const p of paletas) salida[p.id] = semanticaResuelta(p.id);
  console.log(JSON.stringify(salida, null, 2));
  process.exit(0);
}

const resultado = verificarParejas(paletas, sabotaje);
console.log(tablaContraste(resultado));
if (sabotaje) console.log(`sabotaje aplicado: ${Object.entries(sabotaje).map(([r, h]) => `${r}=${h}`).join(", ")}`);
process.exit(resultado.fallos > 0 ? 1 : 0);
