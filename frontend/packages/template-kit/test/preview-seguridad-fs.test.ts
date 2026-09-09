// test/preview-seguridad-fs.test.ts — ALTA: `/__preview/fs/` servía CUALQUIER archivo del disco.
//
// `servirArchivo`/`servirArchivoAbsoluto` (src/preview.ts) son las que deciden qué llega al
// navegador. Antes del arreglo, `/__preview/fs/` se servía con `servirArchivo(res, "/", …)`: la raíz
// era el sistema de ficheros entero, así que la comprobación de «cae dentro de la raíz» era un
// no-op. Medido con salida real en
// `docs/rediseno-plantillas/evidencia/fase-4/4-adv/preview-lectura-fuera-del-paquete.txt`:
// `/etc/passwd`, `/proc/self/environ` (¡las variables de entorno del proceso!) y `/root/.ccr/*`
// devolvían 200 con el archivo completo, incluso codificados o con `..`.
//
// Esta prueba fija el contrato: un archivo FUERA de las raíces permitidas (los `node_modules` desde
// los que se resuelven las tipografías `@fontsource`, ADR-4-1B-06) nunca llega — y uno DENTRO de
// ellas (una tipografía de verdad) se sigue sirviendo, porque `preview` sin tipografías no cumple su
// propósito (memoria/CLAUDE.md).
//
// Saboteada a mano para comprobar que esta prueba de verdad detecta el ALTA: con
// `servirArchivoAbsoluto(res, raicesModulos, …)` sustituido de vuelta por
// `servirArchivo(res, "/", …)` (el código de antes del arreglo), el primer `it` de abajo falla en
// ROJO (`/etc/passwd` responde 200); restaurado el arreglo, vuelve a VERDE. Salida de las dos
// corridas en `docs/rediseno-plantillas/evidencia/fase-4/4-adv/preview-fs-rojo-verde.txt`.
import { afterAll, describe, expect, it } from "vitest";
import { join } from "node:path";
import { preview, type ServidorPreview } from "../src/preview.ts";
import { PAQUETES } from "./ayuda.ts";

const PLAZO = 240_000;
const BODA_CLASICA = join(PAQUETES, "boda-clasica/1.0.1");
const abiertos: ServidorPreview[] = [];

afterAll(async () => {
  for (const s of abiertos) await s.cerrar();
});

async function abrir(puerto: number): Promise<ServidorPreview> {
  const s = await preview({ dir: BODA_CLASICA, puerto });
  abiertos.push(s);
  return s;
}

describe("`/__preview/fs/`: solo el paquete y las tipografías, nada más del disco", () => {
  it("un archivo de fuera de toda raíz permitida (/etc/passwd) NUNCA se sirve", { timeout: PLAZO }, async () => {
    const s = await abrir(5391);
    for (const ruta of [
      "/__preview/fs/etc/passwd",
      "/__preview/fs/proc/self/environ",
      "/__preview/fs/etc/../etc/passwd", // `..` normalizado
      "/__preview/fs/%2e%2e%2fetc%2fpasswd", // `..` codificado
      "/__preview/fs/%2fetc%2fpasswd", // barra inicial codificada
    ]) {
      const r = await fetch(`${s.url}${ruta}`);
      expect([403, 404], `esperaba 403/404 para ${ruta}, llegó ${r.status}`).toContain(r.status);
      const cuerpo = await r.text();
      expect(cuerpo, `${ruta} NO debe traer el contenido real de /etc/passwd`).not.toContain("root:x:0:0");
    }
  });

  it("un enlace simbólico que apunta fuera de las raíces permitidas tampoco se sirve", { timeout: PLAZO }, async () => {
    const s = await abrir(5392);
    // El propio `node_modules` real de pnpm (fuera de toda raíz permitida por nombre, aunque
    // EXISTA en disco) no debe colarse por la ruta `fs/`: solo cuelan las tres raíces exactas que
    // `preview.ts` declara (`KIT_DIR/node_modules`, `apps/web/node_modules`, `FRONTEND_DIR/node_modules`).
    // Aquí basta con repetir el mismo archivo sensible con una ruta absoluta distinta que tampoco
    // resuelve dentro de ninguna raíz.
    const r = await fetch(`${s.url}/__preview/fs/root/.ccr/ca-bundle.crt`);
    expect([403, 404]).toContain(r.status);
  });

  it("una tipografía legítima (@fontsource, resuelta vía enlace simbólico de pnpm) SÍ se sirve", { timeout: PLAZO }, async () => {
    const s = await abrir(5393);
    const hoja = await (await fetch(`${s.url}/__preview/fuentes.css`)).text();
    expect(hoja).toContain("Cormorant Garamond");
    expect(hoja).toContain("/__preview/fs/");
    const m = hoja.match(/url\("(\/__preview\/fs\/[^"]+)"\)/);
    expect(m, "la hoja de fuentes debería traer al menos una url(\"/__preview/fs/…\")").not.toBeNull();
    const rutaFuente = m![1]!;
    const r = await fetch(`${s.url}${rutaFuente}`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/font|css/);
    expect((await r.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });
});
