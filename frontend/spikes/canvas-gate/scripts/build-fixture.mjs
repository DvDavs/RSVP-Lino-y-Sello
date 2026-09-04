// Genera lib/composed.fixture.json a partir del golden REAL de packages/schema
// (golden/templates/boda-clasica-1.0.0/compuesto.json, el mismo que valida el contrato),
// reescribiendo las URL de imagen al "CDN" local (backend de 3-0a, otro origen) para que A3
// mida algo real. Reproducible: `node scripts/build-fixture.mjs`.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const GOLDEN = fileURLToPath(new URL("../../../packages/schema/golden/templates/boda-clasica-1.0.0/compuesto.json", import.meta.url));
const SALIDA = fileURLToPath(new URL("../lib/composed.fixture.json", import.meta.url));
const CDN = process.env.CDN_ORIGIN ?? "http://127.0.0.1:6003";
const BASE = `${CDN}/public/templates2-assets/templates2/template/boda-clasica/1.0.0`;
// sha256 del contenido = nombre del objeto (02 §10.1 paso 7). Los dos assets reales del paquete.
const PREVIEW = "8e22083a98052e48852458432561c95a0ffb0611f77e60901a67377b6d7866c9.png";
const RSVP_BG = "34fbabcdcaf030f55fb5fe236cd71db28c650721e70bf6ea9986e8729f37e9de.png";

const doc = JSON.parse(readFileSync(GOLDEN, "utf8"));
let n = 0;
const reescribir = (b) => {
  if (b.value?.kind === "image") {
    b.value.url = `${BASE}/${b.id === "rsvp.background" ? RSVP_BG : PREVIEW}`;
    n++;
  }
};
for (const s of doc.sections) for (const b of s.blocks) {
  if (b.type === "group") { for (const it of b.items ?? []) for (const ib of it.blocks) reescribir(ib); }
  else reescribir(b);
}
writeFileSync(SALIDA, JSON.stringify(doc, null, 2) + "\n");
console.log(`fixture escrita: ${SALIDA} (${n} URL de imagen apuntando a ${CDN})`);
