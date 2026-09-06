// packages/template-kit/src/doctor.ts — `plantilla doctor`: qué falta y CÓMO se arregla.
//
// Un diagnóstico que sólo dice "falta X" obliga a buscar el comando en cuatro documentos. Cada
// comprobación de aquí trae su arreglo copiable, y las trampas medidas por el bloque 4-0A
// (`memoria/handoffs/4-0a.md §1 y §3`) están puestas como comprobaciones, no como prosa.
//
// REGLA DURA DEL ENTORNO: **nunca `playwright install`**. Chromium viene preinstalado y el proxy
// bloquea la descarga (CLAUDE.md, entorno remoto).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export type EstadoDiagnostico = "ok" | "falta" | "aviso";

export interface Diagnostico {
  readonly nombre: string;
  readonly estado: EstadoDiagnostico;
  /** Lo que se ha observado, con su valor real. */
  readonly detalle: string;
  /** Qué hacer. Vacío sólo cuando `estado` es "ok". */
  readonly arreglo: string;
}

export interface EntornoDoctor {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly nodeVersion: string;
  /** Raíz del repositorio. */
  readonly raiz: string;
  /** Ejecuta un comando y devuelve su salida (inyectable en pruebas). */
  readonly ejecutar: (cmd: string, args: readonly string[]) => { codigo: number; salida: string };
  /** Sondea el backend; devuelve el código HTTP o `undefined` si no contesta. */
  readonly sondear: (base: string) => number | undefined;
  readonly existe: (ruta: string) => boolean;
}

export function entornoReal(raiz: string): EntornoDoctor {
  return {
    env: process.env,
    nodeVersion: process.version,
    raiz,
    ejecutar: (cmd, args) => {
      const r = spawnSync(cmd, [...args], { encoding: "utf8" });
      return { codigo: r.status ?? 1, salida: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
    },
    sondear: base => {
      const r = spawnSync("curl", ["-sS", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "3",
        `${base}/public/i/sonda/exists`], { encoding: "utf8" });
      const codigo = Number.parseInt((r.stdout ?? "").trim(), 10);
      return Number.isFinite(codigo) && codigo > 0 ? codigo : undefined;
    },
    existe: existsSync,
  };
}

const NODE_MINIMO = 22;

export function diagnosticar(e: EntornoDoctor): readonly Diagnostico[] {
  const d: Diagnostico[] = [];
  const mayor = Number.parseInt(e.nodeVersion.replace(/^v/, "").split(".")[0] ?? "0", 10);
  d.push(mayor >= NODE_MINIMO
    ? { nombre: "Node", estado: "ok", detalle: `${e.nodeVersion} (el monorepo exige >= 22.22)`, arreglo: "" }
    : {
      nombre: "Node", estado: "falta", detalle: `${e.nodeVersion}; frontend/package.json exige >= 22.22`,
      arreglo: "Instala Node 22 o superior; con una versión menor `tsx` y `vitest` no arrancan.",
    });

  const pnpm = e.ejecutar("pnpm", ["--version"]);
  d.push(pnpm.codigo === 0
    ? { nombre: "pnpm", estado: "ok", detalle: `pnpm ${pnpm.salida}`, arreglo: "" }
    : { nombre: "pnpm", estado: "falta", detalle: "no está en el PATH",
        arreglo: "`corepack enable && corepack prepare pnpm@10.33.0 --activate` (la versión la fija `packageManager` en frontend/package.json)." });

  // Un `pnpm install` a medias no es teórico: la bitácora 4-5 §1 empezó la prueba con `tsx: not
  // found` porque el worktree no tenía node_modules. Se comprueba TODO lo que el kit necesita en
  // tiempo de ejecución, no sólo su propio directorio: la raíz del monorepo, los dos paquetes que
  // importa y el binario de `tsx`. (El caso extremo —ni siquiera `tsx`— lo atrapa antes
  // `bin/plantilla.mjs`, que no necesita nada instalado para poder decirlo.)
  const dependencias = [
    ["frontend/node_modules", "la raíz del monorepo"],
    ["frontend/packages/template-kit/node_modules", "el kit"],
    ["frontend/packages/template-kit/node_modules/.bin/tsx", "el runner de TypeScript (`tsx`)"],
    ["frontend/packages/schema/node_modules", "@invitaciones/schema"],
    ["frontend/packages/sections/node_modules", "@invitaciones/sections"],
  ] as const;
  const ausentes = dependencias.filter(([r]) => !e.existe(join(e.raiz, r)));
  d.push(ausentes.length === 0
    ? { nombre: "Dependencias instaladas", estado: "ok",
        detalle: `${dependencias.length} rutas del workspace instaladas (raíz, kit, tsx, schema, sections)`, arreglo: "" }
    : { nombre: "Dependencias instaladas", estado: "falta",
        detalle: `falta ${ausentes.map(([r, q]) => `${q} (${r})`).join(", ")}`,
        arreglo: "`cd frontend && pnpm install` (instala TODO el workspace, no sólo el kit: `plantilla` importa @invitaciones/schema y @invitaciones/sections y arranca con tsx). Sin eso, `pnpm plantilla` no llega ni a ejecutarse." });

  const base = e.env["TPL_DEV_BASE"];
  if (!base) {
    d.push({
      nombre: "TPL_DEV_BASE", estado: "falta", detalle: "sin exportar",
      arreglo: "`export TPL_DEV_BASE=http://127.0.0.1:$TPL_DEV_PORT`. Sin ella, `smoke.sh:16` y `seed-demo.sh:34` caen a :6003 y golpean el backend de OTRO agente (handoffs/4-0a.md §1).",
    });
  } else {
    const codigo = e.sondear(base);
    d.push(codigo !== undefined
      ? { nombre: "Backend", estado: "ok", detalle: `${base} responde (HTTP ${codigo} a /public/i/sonda/exists)`, arreglo: "" }
      : { nombre: "Backend", estado: "falta", detalle: `${base} no contesta`,
          arreglo: "`scripts/dev-backend.sh start` (~145 s la primera vez: compila). Después `scripts/seed-demo.sh` — NO es opcional." });
  }

  for (const v of ["TPL_DEV_PORT", "TPL_DEV_DB", "TPL_TEST_STATE_DIR"] as const) {
    d.push(e.env[v]
      ? { nombre: v, estado: "ok", detalle: `${v}=${e.env[v]}`, arreglo: "" }
      : { nombre: v, estado: "aviso", detalle: "sin exportar (se usará el valor por defecto)",
          arreglo: `Exporta ${v} con un valor tuyo: dos sesiones sin variables propias pelean por el mismo puerto y el mismo clúster (handoffs/4-0a.md §1).` });
  }

  const email = e.env["TPL_MASTER_EMAIL"] ?? "demo.master@example.com";
  d.push({
    nombre: "Cuenta MASTER", estado: e.env["TPL_MASTER_EMAIL"] ? "ok" : "aviso",
    detalle: `se usará ${email}`,
    arreglo: e.env["TPL_MASTER_EMAIL"]
      ? ""
      : "El ayudante de registro crea y promueve `demo.master@example.com` si no existe (registrar-http.sh); si quieres otra cuenta, exporta TPL_MASTER_EMAIL y TPL_MASTER_PASS.",
  });

  d.push({
    nombre: "Base sembrada", estado: "aviso",
    detalle: "no se puede comprobar desde aquí sin consultar la base",
    arreglo: "`scripts/smoke.sh` da 4/19 sobre un clúster recién creado y 19/19 sólo DESPUÉS de `scripts/seed-demo.sh` (handoffs/4-0a.md §3.1). Si el smoke falla en la ruta 2, es esto.",
  });

  const chromium = rutaDeChromium(e);
  d.push(chromium
    ? { nombre: "Chromium (Playwright)", estado: "ok", detalle: chromium, arreglo: "" }
    : { nombre: "Chromium (Playwright)", estado: "aviso",
        detalle: "no encuentro el navegador en las rutas habituales",
        arreglo: "Exporta PLAYWRIGHT_BROWSERS_PATH o CHROMIUM_PATH apuntando al Chromium PREINSTALADO. **Nunca ejecutes `playwright install`**: el proxy bloquea la descarga (CLAUDE.md)." });

  return d;
}

function rutaDeChromium(e: EntornoDoctor): string | undefined {
  const explicitas = [e.env["CHROMIUM_PATH"], e.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"]];
  for (const r of explicitas) if (r && e.existe(r)) return r;
  const base = e.env["PLAYWRIGHT_BROWSERS_PATH"];
  if (base && e.existe(base)) return `PLAYWRIGHT_BROWSERS_PATH=${base}`;
  for (const r of ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"]) {
    if (e.existe(r)) return r;
  }
  const which = e.ejecutar("which", ["chromium"]);
  return which.codigo === 0 && which.salida !== "" ? which.salida : undefined;
}

/** Informe listo para imprimir; una línea por comprobación y el arreglo debajo si falta algo. */
export function formatearDoctor(ds: readonly Diagnostico[]): string {
  const marca: Record<EstadoDiagnostico, string> = { ok: "OK   ", falta: "FALTA", aviso: "AVISO" };
  const lineas: string[] = [];
  for (const d of ds) {
    lineas.push(`${marca[d.estado]} ${d.nombre}: ${d.detalle}`);
    if (d.arreglo !== "") lineas.push(`      ${d.arreglo}`);
  }
  const faltan = ds.filter(x => x.estado === "falta").length;
  const avisos = ds.filter(x => x.estado === "aviso").length;
  lineas.push("");
  lineas.push(`${ds.length} comprobación(es) · ${faltan} sin resolver · ${avisos} aviso(s)`);
  return lineas.join("\n");
}
