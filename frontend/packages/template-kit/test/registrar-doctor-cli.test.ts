// test/registrar-doctor-cli.test.ts — registro (con el ayudante inyectado), doctor y CLI.
//
// El registro NO se prueba contra un backend vivo: el ayudante de 4-0A es el que habla HTTP y ya
// está verificado en `evidencia/fase-4/0a/`. Lo que aquí se prueba es lo que este bloque añade:
// que no se sube nada que no pase `check`, y que cada código de respuesta se traduce a algo que
// diga qué hacer.
import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AYUDA, ejecutar, parsear, resolverDir } from "../src/cli.ts";
import { diagnosticar, formatearDoctor, type EntornoDoctor } from "../src/doctor.ts";
import { explicar, interpretar, registrar } from "../src/registrar.ts";
import { copiarPaquete, escribirManifiesto, leerManifiesto, RAIZ_REPO } from "./ayuda.ts";

type J = Record<string, any>;

describe("registrar", () => {
  it("se niega a subir un paquete que no pasa check, y enseña los hallazgos", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    const m = leerManifiesto(dir) as J;
    m["sections"][1].blocks[1].role = "celebrantName";
    escribirManifiesto(dir, m);
    const r = registrar({ dir, raiz: RAIZ_REPO, ejecutor: () => { throw new Error("no debe llamarse"); } });
    expect(r.ok).toBe(false);
    expect(r.texto).toContain("No se sube nada");
    expect(r.texto).toContain("TPL_ROLE_UNKNOWN");
  });

  it("201 created: lo dice en castellano", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    const r = registrar({
      dir, raiz: RAIZ_REPO,
      ejecutor: () => ({
        codigoSalida: 0, stderr: "",
        stdout: `POST /master/templates2/versions  (${dir})  →  HTTP 201\n{"result":"created","templateVersionId":"tv_1"}`,
      }),
    });
    expect(r.ok).toBe(true);
    expect(r.http).toBe(201);
    expect(r.resultado).toBe("created");
    expect(r.texto).toContain("201 created — la versión se ha publicado.");
  });

  it("200 noop_same_hash: es el resultado CORRECTO de repetir el registro (ADR-008)", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    const r = registrar({
      dir, raiz: RAIZ_REPO,
      ejecutor: () => ({ codigoSalida: 0, stderr: "", stdout: 'HTTP 200\n{"result":"noop_same_hash"}' }),
    });
    expect(r.ok).toBe(true);
    expect(r.texto).toContain("no se ha hecho nada");
    expect(r.texto).toContain("no un fallo");
  });

  it("409 dice exactamente qué hacer: subir la versión", () => {
    expect(explicar(409, undefined, "TPL_VERSION_HASH_MISMATCH")).toContain("SUBE LA VERSIÓN");
    expect(explicar(409, undefined, "TPL_VERSION_HASH_MISMATCH")).toContain("migrations/<anterior>-to-<nueva>.json");
  });

  it("los 422 del registro se explican uno a uno", () => {
    expect(explicar(422, undefined, "TPL_PACKAGE_ASSET_MISMATCH")).toContain("plantilla check");
    expect(explicar(422, undefined, "TPL_PACKAGE_UNEXPECTED_FILE")).toContain("P1");
    expect(explicar(422, undefined, "TPL_MANIFEST_BREAKING_CHANGE_NOT_MAJOR")).toContain("AUNQUE haya plan de migración");
    expect(explicar(422, undefined, "TPL_PACKAGE_DEFAULTS_MISMATCH")).toContain("iguala los dos campos");
    expect(explicar(422, undefined, "TPL_LO_QUE_SEA")).toContain("plantilla check");
    expect(explicar(403)).toContain("MASTER");
    expect(explicar(undefined)).toContain("plantilla doctor");
    expect(explicar(500, undefined, undefined, "boom")).toContain("no prevista");
  });

  it("interpreta la salida del ayudante aunque el cuerpo no sea JSON", () => {
    expect(interpretar({ codigoSalida: 0, stderr: "", stdout: "HTTP 201\n{no json" }))
      .toEqual({ http: 201 });
    expect(interpretar({ codigoSalida: 1, stderr: "", stdout: "sin nada" })).toEqual({});
  });

  it("si no encuentra el ayudante, lo dice con la ruta que buscó", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    const r = registrar({ dir, raiz: join(tmpdir(), "raiz-que-no-existe") });
    expect(r.ok).toBe(false);
    expect(r.texto).toContain("No encuentro el ayudante de registro");
  });

  it("`--sin-check` salta la comprobación previa (camino de depuración)", () => {
    const dir = copiarPaquete("xv-jardin/1.0.0");
    let llamado = false;
    const r = registrar({
      dir, raiz: RAIZ_REPO, sinCheck: true,
      ejecutor: () => { llamado = true; return { codigoSalida: 0, stderr: "", stdout: 'HTTP 201\n{"result":"created"}' }; },
    });
    expect(llamado).toBe(true);
    expect(r.ok).toBe(true);
  });
});

/** Entorno sintético para el doctor: ni toca el disco ni levanta nada. */
function entorno(parcial: Partial<EntornoDoctor> = {}): EntornoDoctor {
  return {
    env: { TPL_DEV_BASE: "http://127.0.0.1:6041", TPL_DEV_PORT: "6041", TPL_DEV_DB: "db", TPL_TEST_STATE_DIR: "/tmp/x", TPL_MASTER_EMAIL: "m@e.com" },
    nodeVersion: "v22.22.2",
    raiz: RAIZ_REPO,
    ejecutar: () => ({ codigo: 0, salida: "10.33.0" }),
    sondear: () => 404,
    existe: () => true,
    ...parcial,
  };
}

describe("doctor", () => {
  it("con todo en su sitio no hay nada sin resolver", () => {
    const ds = diagnosticar(entorno());
    expect(ds.filter(d => d.estado === "falta")).toEqual([]);
    expect(formatearDoctor(ds)).toContain("0 sin resolver");
  });

  it("cada cosa que falta trae su arreglo", () => {
    const ds = diagnosticar(entorno({
      env: {}, nodeVersion: "v18.0.0",
      ejecutar: () => ({ codigo: 1, salida: "" }),
      existe: () => false,
    }));
    const faltan = ds.filter(d => d.estado === "falta");
    expect(faltan.length).toBeGreaterThanOrEqual(4);
    for (const d of ds) if (d.estado !== "ok") expect(d.arreglo).not.toBe("");
    const texto = formatearDoctor(ds);
    expect(texto).toContain("corepack prepare pnpm@10.33.0");
    expect(texto).toContain("cd frontend && pnpm install");
    expect(texto).toContain("export TPL_DEV_BASE=");
    expect(texto).toContain("golpean el backend de OTRO agente");
    expect(texto).toContain("Node");
  });

  it("el backend que no contesta manda a dev-backend.sh y a seed-demo.sh", () => {
    const texto = formatearDoctor(diagnosticar(entorno({ sondear: () => undefined })));
    expect(texto).toContain("scripts/dev-backend.sh start");
    expect(texto).toContain("`scripts/seed-demo.sh` — NO es opcional");
  });

  it("recuerda que smoke.sh sólo da 19/19 tras sembrar", () => {
    expect(formatearDoctor(diagnosticar(entorno()))).toContain("4/19 sobre un clúster recién creado y 19/19");
  });

  it("NUNCA propone `playwright install` cuando no encuentra Chromium", () => {
    const ds = diagnosticar(entorno({ existe: () => false, ejecutar: () => ({ codigo: 1, salida: "" }) }));
    const chromium = ds.find(d => d.nombre.startsWith("Chromium"))!;
    expect(chromium.arreglo).toContain("Nunca ejecutes `playwright install`");
    expect(formatearDoctor(ds)).not.toContain("ejecuta playwright install");
  });

  it("encuentra Chromium por las variables explícitas y por las rutas habituales", () => {
    const porVariable = diagnosticar(entorno({
      env: { CHROMIUM_PATH: "/opt/chromium" }, existe: (r: string) => r === "/opt/chromium",
    })).find(d => d.nombre.startsWith("Chromium"))!;
    expect(porVariable.estado).toBe("ok");
    const porRuta = diagnosticar(entorno({
      env: {}, existe: (r: string) => r === "/usr/bin/chromium",
    })).find(d => d.nombre.startsWith("Chromium"))!;
    expect(porRuta.detalle).toBe("/usr/bin/chromium");
    const porBrowsersPath = diagnosticar(entorno({
      env: { PLAYWRIGHT_BROWSERS_PATH: "/ms-playwright" },
      existe: (r: string) => r === "/ms-playwright",
    })).find(d => d.nombre.startsWith("Chromium"))!;
    expect(porBrowsersPath.detalle).toContain("PLAYWRIGHT_BROWSERS_PATH=");
    const porWhich = diagnosticar(entorno({
      env: {}, existe: () => false, ejecutar: () => ({ codigo: 0, salida: "/usr/local/bin/chromium" }),
    })).find(d => d.nombre.startsWith("Chromium"))!;
    expect(porWhich.detalle).toBe("/usr/local/bin/chromium");
  });
});

describe("cli", () => {
  it("parsea `--clave valor`, `--clave=valor` y banderas sueltas", () => {
    expect(parsear(["check", "dir", "--estricto", "--secciones=cover,event", "--evento", "wedding"]))
      .toEqual({
        posicionales: ["check", "dir"],
        banderas: { estricto: true, secciones: "cover,event", evento: "wedding" },
      });
  });

  it("resuelve las rutas relativas contra INIT_CWD, no contra el directorio del paquete", () => {
    // `pnpm run` cambia el cwd al del paquete; sin esto, `pnpm plantilla check templates/x/1.0.0`
    // buscaría dentro de packages/template-kit (medido: TPL_PACKAGE_NOT_FOUND).
    expect(resolverDir("templates/x/1.0.0", { INIT_CWD: "/home/u/repo/frontend" }))
      .toBe("/home/u/repo/frontend/templates/x/1.0.0");
    expect(resolverDir("/abs/oluto", { INIT_CWD: "/otro" })).toBe("/abs/oluto");
    expect(resolverDir("rel", {})).toBe(join(process.cwd(), "rel"));
  });

  it("ignora el `--` que mete `pnpm run <script> -- <args>`", () => {
    expect(parsear(["--", "doctor"]).posicionales).toEqual(["doctor"]);
  });

  it("la ayuda lista los cinco comandos y los dos huecos de 4-1B", () => {
    for (const c of ["nueva", "check", "registrar", "doctor", "secciones", "preview", "capturas"]) {
      expect(AYUDA).toContain(`plantilla ${c}`);
    }
    expect(AYUDA).toContain("lo entrega el bloque 4-1B");
    expect(ejecutar([]).salida).toBe(AYUDA);
    expect(ejecutar(["--help"]).codigo).toBe(0);
  });

  it("un comando desconocido devuelve 2 y la ayuda", () => {
    const r = ejecutar(["inventado"]);
    expect(r.codigo).toBe(2);
    expect(r.salida).toContain('No conozco el comando "inventado"');
  });

  it("`nueva` sin evento válido dice los ocho tipos", () => {
    const r = ejecutar(["nueva", "x", "--evento", "boda"]);
    expect(r.codigo).toBe(2);
    expect(r.salida).toContain("wedding, quince, baptism, communion, confirmation, birthday, graduation, generic");
    expect(ejecutar(["nueva"]).codigo).toBe(2);
  });

  it("`nueva` con una sección inventada dice los doce tipos", () => {
    const r = ejecutar(["nueva", "x", "--evento", "wedding", "--secciones", "portada,cover"]);
    expect(r.codigo).toBe(2);
    expect(r.salida).toContain("--secciones trae tipos que no existen: portada");
  });

  it("`nueva` → `check` en verde, y el CLI lo dice", () => {
    const destino = mkdtempSync(join(tmpdir(), "kit-cli-"));
    const r = ejecutar(["nueva", "cli-demo", "--evento", "quince", "--secciones", "cover,event,rsvp",
      "--destino", destino, "--nombre", "Demo del CLI", "--descripcion", "Prueba"]);
    expect(r.codigo).toBe(0);
    expect(r.salida).toContain("check: en verde a la primera (0 errores).");
    const c = ejecutar(["check", join(destino, "cli-demo", "1.0.0")]);
    expect(c.codigo).toBe(0);
    expect(c.salida).toContain("package_hash = sha256:");
    expect(c.salida).toContain("0 error(es) · 0 aviso(s) · 0 corregido(s)");
    const silencioso = ejecutar(["check", join(destino, "cli-demo", "1.0.0"), "--silencioso"]);
    expect(silencioso.salida).toBe("0 error(es) · 0 aviso(s) · 0 corregido(s)");
  });

  it("`check` sin directorio y sobre un paquete roto devuelve código distinto de cero", () => {
    expect(ejecutar(["check"]).codigo).toBe(2);
    const dir = mkdtempSync(join(tmpdir(), "kit-roto-"));
    writeFileSync(join(dir, "template.json"), "{}", "utf8");
    const r = ejecutar(["check", dir]);
    expect(r.codigo).toBe(1);
    expect(r.salida).toContain("TPL_PACKAGE_MISSING_FILE");
  });

  it("`registrar` sin directorio devuelve 2", () => {
    expect(ejecutar(["registrar"]).codigo).toBe(2);
  });

  it("`secciones` imprime el catálogo, y con un tipo imprime sólo ese", () => {
    const todas = ejecutar(["secciones"]);
    expect(todas.codigo).toBe(0);
    expect(todas.salida).toContain("cover — Portada");
    expect(todas.salida).toContain("footer — Pie");
    const una = ejecutar(["secciones", "event"]);
    expect(una.salida).toContain("event — ");
    expect(una.salida).toContain("rol eventCards");
    expect(una.salida).not.toContain("cover — Portada");
    expect(ejecutar(["secciones", "portada"]).codigo).toBe(2);
  });

  it("`preview` y `capturas` dicen que los entrega 4-1B, con código 2", () => {
    for (const c of ["preview", "capturas"]) {
      const r = ejecutar([c, "un/directorio"]);
      expect(r.codigo).toBe(2);
      expect(r.salida).toContain("lo entrega el bloque 4-1B");
      expect(r.salida).toContain("un/directorio");
    }
  });

  it("`nueva` sobre un destino imposible informa del error en vez de reventar", () => {
    const r = ejecutar(["nueva", "x", "--evento", "wedding", "--destino", "/proc/no-se-puede"]);
    expect(r.codigo).toBe(1);
    expect(r.salida).toContain("No he podido generar el andamio");
  });
});
