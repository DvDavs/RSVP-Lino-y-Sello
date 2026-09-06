// Medición con la FÓRMULA CANÓNICA existente: frontend/templates/scripts/art/color.mjs
// y la tabla de parejas canónica: frontend/templates/scripts/art/paleta-aa.mjs (PAREJAS).
import { readFileSync } from 'node:fs';
import { ratio, r2 } from '/home/user/wt/0c/frontend/templates/scripts/art/color.mjs';
import { PAREJAS } from '/home/user/wt/0c/frontend/templates/scripts/art/paleta-aa.mjs';

const FILES = process.argv.slice(2);
let fallos = 0, evaluadas = 0;
const w = (s, n) => String(s).padEnd(n);
console.log(w('árbol/paleta', 46) + w('pareja', 24) + w('hex', 18) + w('ratio', 8) + w('umbral', 8) + 'estado');
console.log('-'.repeat(112));
for (const f of FILES) {
  const theme = JSON.parse(readFileSync(f, 'utf8'));
  const etiqueta = f.replace('/home/user/wt/0c/', '');
  for (const pal of theme.palettes) {
    for (const [nombre, a, b, umbral] of PAREJAS) {
      const r = ratio(pal.tokens[a], pal.tokens[b]);
      const ok = r >= umbral;
      evaluadas++; if (!ok) fallos++;
      console.log(w(`${etiqueta.split('/').slice(-2)[0]}/${pal.id}`, 46) + w(nombre, 24) +
        w(`${pal.tokens[a]}/${pal.tokens[b]}`, 18) + w(r2(r).toFixed(2), 8) + w(umbral.toFixed(1), 8) + (ok ? 'OK' : 'FALLA'));
    }
  }
}
console.log('-'.repeat(112));
console.log(`${evaluadas} parejas evaluadas · ${fallos} FALLAN`);
