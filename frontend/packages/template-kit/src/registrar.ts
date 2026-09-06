// packages/template-kit/src/registrar.ts — `plantilla registrar`: subir el paquete sin tocar Kotlin.
//
// NO reimplementa la subida. La hace `docs/rediseno-plantillas/evidencia/fase-4/0a/registrar-http.sh`
// (bloque 4-0A, verificado idempotente contra el backend vivo): consigue el JWT MASTER, manda los
// tres `.json`, TODOS los assets que declara el manifiesto (mandar de menos es
// `422 TPL_PACKAGE_ASSET_MISMATCH`) y las migraciones con su nombre de parte. Aquí se añaden las dos
// cosas que faltaban: `check` ANTES (no se sube nada que no pase) y una traducción al castellano de
// lo que significa cada código de respuesta.
//
// P4: registrar una plantilla no toca Kotlin ni reinicia nada.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { check } from "./check.ts";
import { formatearHallazgos, resumen } from "./formato.ts";

/** Salida cruda del ayudante. Se inyecta en las pruebas para no depender de un backend vivo. */
export interface SalidaDelAyudante {
  readonly codigoSalida: number;
  readonly stdout: string;
  readonly stderr: string;
}
export type Ejecutor = (guion: string, dir: string) => SalidaDelAyudante;

/** Ruta del ayudante de 4-0A, relativa a la raíz del repositorio. */
export const AYUDANTE = "docs/rediseno-plantillas/evidencia/fase-4/0a/registrar-http.sh";

export interface OpcionesRegistrar {
  readonly dir: string;
  /** Raíz del repositorio (donde vive `docs/`). Por omisión, dos niveles por encima de `frontend/`. */
  readonly raiz?: string;
  /** Salta el `check` previo. Existe sólo para depurar; el camino normal NO lo usa. */
  readonly sinCheck?: boolean;
  readonly ejecutor?: Ejecutor;
}

export interface ResultadoRegistrar {
  readonly ok: boolean;
  /** Código HTTP que devolvió el registro, si se llegó a llamar. */
  readonly http?: number;
  /** `created` | `noop_same_hash` | … tal cual lo devuelve el backend. */
  readonly resultado?: string;
  /** Código `TPL_*` del error, si lo hubo. */
  readonly codigo?: string;
  /** Explicación en castellano, lista para imprimir. */
  readonly texto: string;
}

const ejecutorReal: Ejecutor = (guion, dir) => {
  const r = spawnSync("bash", [guion, dir], { encoding: "utf8" });
  return { codigoSalida: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
};

/** Extrae el `HTTP <código>` y el cuerpo JSON de la salida del ayudante. */
export function interpretar(salida: SalidaDelAyudante): {
  http?: number; resultado?: string; codigo?: string; mensaje?: string;
} {
  const m = /HTTP\s+(\d{3})/.exec(salida.stdout);
  const http = m ? Number(m[1]) : undefined;
  const llave = salida.stdout.indexOf("{");
  let cuerpo: Record<string, unknown> = {};
  if (llave >= 0) {
    try { cuerpo = JSON.parse(salida.stdout.slice(llave)) as Record<string, unknown>; } catch { cuerpo = {}; }
  }
  return {
    ...(http !== undefined ? { http } : {}),
    ...(typeof cuerpo["result"] === "string" ? { resultado: cuerpo["result"] as string } : {}),
    ...(typeof cuerpo["code"] === "string" ? { codigo: cuerpo["code"] as string } : {}),
    ...(typeof cuerpo["message"] === "string" ? { mensaje: cuerpo["message"] as string } : {}),
  };
}

/** Qué significa cada respuesta del registro y qué hacer con ella (contratos.md §4, ADR-008/028). */
export function explicar(http: number | undefined, resultado?: string, codigo?: string, mensaje?: string): string {
  if (http === 201 || resultado === "created") {
    return "201 created — la versión se ha publicado. Es nueva en la base: ya se puede elegir desde el catálogo.";
  }
  if (http === 200 || resultado === "noop_same_hash") {
    return "200 noop_same_hash — ya estaba registrada con EXACTAMENTE el mismo `package_hash`, así que no se ha hecho nada. Es el resultado correcto de volver a registrar el mismo paquete (ADR-008), no un fallo.";
  }
  if (http === 409 || codigo === "TPL_VERSION_HASH_MISMATCH") {
    return "409 TPL_VERSION_HASH_MISMATCH — ese `slug@version` YA está publicado con otro contenido, y una versión publicada nunca se sobrescribe (ADR-008). Qué hacer: SUBE LA VERSIÓN (por ejemplo 1.0.0 → 1.0.1) en `template.json` y en `defaults.json`, y si has retirado o estrechado algo, añade `migrations/<anterior>-to-<nueva>.json`. No intentes pisar la versión publicada.";
  }
  if (http === 422) {
    const detalle = mensaje ? ` Mensaje del backend: ${mensaje}` : "";
    switch (codigo) {
      case "TPL_PACKAGE_ASSET_MISMATCH":
        return `422 TPL_PACKAGE_ASSET_MISMATCH — el sha256, los bytes o el contentType de algún asset no coinciden con el archivo subido, o falta por subir alguno de los declarados. Qué hacer: \`plantilla check <dir>\` (mide y escribe los digestos por ti) y vuelve a registrar.${detalle}`;
      case "TPL_PACKAGE_UNEXPECTED_FILE":
        return `422 TPL_PACKAGE_UNEXPECTED_FILE — el paquete trae un archivo que el manifiesto no declara. Nada se ignora en silencio (P1). Qué hacer: decláralo en \`assets\` o sácalo del directorio de la versión.${detalle}`;
      case "TPL_MANIFEST_BREAKING_CHANGE_NOT_MAJOR":
        return `422 TPL_MANIFEST_BREAKING_CHANGE_NOT_MAJOR — el diff estructural contra la versión anterior no está vacío y el bump no es mayor (ADR-028). Ojo: el registro lo rechaza AUNQUE haya plan de migración. Qué hacer: si has retirado o estrechado algo, publica una versión MAYOR (2.0.0).${detalle}`;
      case "TPL_PACKAGE_DEFAULTS_MISMATCH":
        return `422 TPL_PACKAGE_DEFAULTS_MISMATCH — \`defaults.json\` declara otro \`templateSlug\`/\`templateVersion\` que el manifiesto. Qué hacer: iguala los dos campos.${detalle}`;
      default:
        return `422 ${codigo ?? "sin código"} — el registro ha rechazado el paquete por una regla del manifiesto. Qué hacer: \`plantilla check <dir>\` y corrige lo que señale.${detalle}`;
    }
  }
  if (http === 401 || http === 403) {
    return `${http} — la cuenta con la que se ha llamado no es MASTER (ADR-033). Qué hacer: \`plantilla doctor\` para ver si hay credenciales MASTER, o exporta TPL_MASTER_EMAIL/TPL_MASTER_PASS.`;
  }
  if (http === undefined) {
    return "El ayudante no llegó a hablar con el backend (¿está levantado?, ¿está TPL_DEV_BASE exportado?). Ejecuta `plantilla doctor`.";
  }
  return `HTTP ${http}${codigo ? ` ${codigo}` : ""} — respuesta no prevista del registro.${mensaje ? ` ${mensaje}` : ""}`;
}

export function registrar(opts: OpcionesRegistrar): ResultadoRegistrar {
  const raiz = opts.raiz ?? resolve(new URL("../../../..", import.meta.url).pathname);
  const guion = resolve(raiz, AYUDANTE);

  if (!opts.sinCheck) {
    const r = check({ dir: opts.dir, escribir: true });
    if (!r.ok) {
      return {
        ok: false,
        texto: `No se sube nada: \`check\` ha encontrado errores en ${opts.dir}.\n\n` +
          `${formatearHallazgos(r.hallazgos)}\n\n${resumen(r.hallazgos)}`,
      };
    }
    if (r.escrituras.length > 0) {
      // Si `check` tuvo que corregir digestos, el paquete que se sube ya lleva la corrección.
      // Se dice, porque cambia el `package_hash` y por tanto la identidad de lo que se registra.
      // (P5: lo derivado se genera, nunca se teclea.)
    }
  }
  if (!existsSync(guion)) {
    return {
      ok: false,
      texto: `No encuentro el ayudante de registro en ${guion}. Pasa la raíz del repositorio con --raiz.`,
    };
  }
  const salida = (opts.ejecutor ?? ejecutorReal)(guion, opts.dir);
  const { http, resultado, codigo, mensaje } = interpretar(salida);
  const texto = [
    salida.stdout.trim(),
    salida.stderr.trim(),
    "",
    explicar(http, resultado, codigo, mensaje),
  ].filter(l => l !== "").join("\n");
  const ok = salida.codigoSalida === 0 && (http === 200 || http === 201);
  return { ok, ...(http !== undefined ? { http } : {}), ...(resultado ? { resultado } : {}), ...(codigo ? { codigo } : {}), texto };
}
