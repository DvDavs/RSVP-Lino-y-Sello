// test/cli-preview-capturas.test.ts — las OPCIONES de `preview` y `capturas` tal y como se escriben
// en la terminal. Comprueba el camino completo `argv → opciones → efecto observable`, que es donde
// se rompen los comandos de verdad (una bandera mal leída no la ve ninguna prueba de unidad).
import { afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ejecutarAsync } from "../src/cli.ts";
import { tipoDe, type ServidorPreview } from "../src/preview.ts";
import { PAQUETES } from "./ayuda.ts";

const PLAZO = 240_000;
const BAUTIZO = join(PAQUETES, "bautizo-elegante/1.0.0");
const abiertos: ServidorPreview[] = [];

afterAll(async () => {
  for (const s of abiertos) await s.cerrar();
});

describe("pnpm plantilla preview, con sus opciones", () => {
  it("`--puerto`, `--paleta`, `--fuentes` y `--sin-marcadores` llegan hasta el servidor", { timeout: PLAZO }, async () => {
    const r = await ejecutarAsync([
      "preview", BAUTIZO, "--puerto", "5381", "--paleta", "violeta",
      "--fuentes", "cormorant-garamond-inter", "--sin-marcadores",
    ]);
    expect(r.codigo).toBe(0);
    expect(r.permanece).toBe(true);
    const s = r.servidor!;
    abiertos.push(s);
    expect(s.puerto).toBe(5381);
    expect(s.url).toBe("http://127.0.0.1:5381");
    // `--sin-marcadores`: ni un hueco de imagen relleno, y la nota correspondiente desaparece.
    expect(s.estado().notas.some(n => n.includes("hueco(s) de imagen"))).toBe(false);
    expect(s.salida).not.toContain("estaba ocupado");
  });

  it("un `--puerto` que no es un número se ignora y se usa el de partida del kit", { timeout: PLAZO }, async () => {
    const r = await ejecutarAsync(["preview", BAUTIZO, "--puerto", "no-es-un-numero"]);
    expect(r.codigo).toBe(0);
    abiertos.push(r.servidor!);
    expect(r.servidor!.puerto).toBeGreaterThanOrEqual(5310);
  });

  it("la consola puede pedir otra paleta sin reiniciar: `/__preview/estado.json?paleta=`", { timeout: PLAZO }, async () => {
    const r = await ejecutarAsync(["preview", BAUTIZO, "--puerto", "5382"]);
    const s = r.servidor!;
    abiertos.push(s);
    const otra = await (await fetch(`${s.url}/__preview/estado.json?paleta=inventada&fuentes=tampoco`)).json() as {
      informe: { themeFallback: unknown };
    };
    expect(otra.informe.themeFallback).toEqual({ paletteId: "inventada", fontSetId: "tampoco" });
    // Y el estado GLOBAL no se ha movido: los demás marcos siguen viendo la paleta del paquete.
    expect(s.estado().composed?.theme.paletteId).toBe("violeta");
  });

  it("una ruta desconocida bajo /__preview/ y un asset que no existe dan 404, no un 500", { timeout: PLAZO }, async () => {
    const r = await ejecutarAsync(["preview", BAUTIZO, "--puerto", "5383"]);
    const s = r.servidor!;
    abiertos.push(s);
    expect((await fetch(`${s.url}/__preview/asset/no-existe.webp`)).status).toBe(404);
    expect((await fetch(`${s.url}/__preview/fs/no/existe.woff2`)).status).toBe(404);
    // Una ruta desconocida cae en el `next()` del middleware y la atiende Vite, que sirve la página
    // (es una SPA): 200 con HTML, nunca un 500 ni una traza.
    const desconocida = await fetch(`${s.url}/__preview/otra-cosa`);
    expect(desconocida.status).toBe(200);
    expect(desconocida.headers.get("content-type")).toContain("text/html");
  });

  it("el tipo de contenido sale de la extensión, con un valor de reserva seguro", () => {
    expect(tipoDe("/x/a.webp")).toBe("image/webp");
    expect(tipoDe("/x/a.WOFF2")).toBe("font/woff2");
    expect(tipoDe("/x/a.desconocida")).toBe("application/octet-stream");
  });
});

describe("pnpm plantilla capturas, con sus opciones", () => {
  it("`--anchos` y `--destino` mandan, y la salida imprime las rutas escritas", { timeout: PLAZO }, async () => {
    const destino = mkdtempSync(join(tmpdir(), "kit-cli-caps-"));
    const r = await ejecutarAsync(["capturas", BAUTIZO, "--destino", destino, "--anchos", "390, 768"]);
    expect(r.codigo).toBe(0);
    expect(r.salida).toContain("2 captura(s) de bautizo-elegante@1.0.0 a 390, 768 px");
    expect(r.salida).toContain(join(destino, "bautizo-elegante@1.0.0-390.png"));
    expect(r.salida).toContain(join(destino, "bautizo-elegante@1.0.0-768.png"));
    expect(readFileSync(join(destino, "bautizo-elegante@1.0.0-390.png")).length).toBeGreaterThan(1024);
  });

  it("un `--destino` dentro del paquete devuelve código 1 y el motivo, sin abrir Chromium", { timeout: PLAZO }, async () => {
    const r = await ejecutarAsync(["capturas", BAUTIZO, "--destino", join(BAUTIZO, "assets")]);
    expect(r.codigo).toBe(1);
    expect(r.salida).toContain("ERROR TPL_PACKAGE_UNEXPECTED_FILE");
  });

  it("un directorio que no existe devuelve 1 y lo explica, no una traza de pila", { timeout: PLAZO }, async () => {
    const r = await ejecutarAsync(["capturas", "/tmp/no-existe-este-paquete-4-1b"]);
    expect(r.codigo).toBe(1);
    expect(r.salida).toContain("No he podido capturar la plantilla:");
    expect(r.salida).toContain("No existe el directorio");
  });
});
