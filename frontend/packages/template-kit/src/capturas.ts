// packages/template-kit/src/capturas.ts — HUECO RESERVADO PARA EL BLOQUE 4-1B.
//
// `plantilla capturas <dir>` tiene que producir las capturas de la plantilla (una por sección o por
// variante) para revisarla sin abrir el editor. Lo entrega el sub-agente 4-1B, que continúa en este
// mismo worktree; el sub-comando ya está registrado en el CLI y sale en `--help`.
//
// Contrato que 4-1A deja preparado y 4-1B debe respetar:
//   · las capturas se escriben FUERA del directorio de la versión (por ejemplo
//     `frontend/templates/<slug>/capturas/`), porque cualquier archivo no declarado dentro del
//     paquete lo rechaza el registro con `TPL_PACKAGE_UNEXPECTED_FILE` (01 §2.1, y `plantilla check`
//     ya lo comprueba: mételo dentro y el check se pone rojo);
//   · nunca ejecuta `playwright install` (Chromium está preinstalado; el proxy bloquea la descarga).

export interface OpcionesCapturas {
  readonly dir: string;
  /** Directorio de salida; por omisión, `<slug>/capturas/` fuera del paquete. */
  readonly destino?: string;
  /** Anchos a capturar (móvil y escritorio). */
  readonly anchos?: readonly number[];
}

export interface ResultadoCapturas {
  readonly ok: boolean;
  readonly salida: string;
  readonly ficheros: readonly string[];
}

/** TODO(4-1B): capturar la plantilla sección a sección. Ver la cabecera de este fichero. */
export function capturas(opts: OpcionesCapturas): ResultadoCapturas {
  return {
    ok: false,
    ficheros: [],
    salida:
      `\`plantilla capturas\` todavía no está implementado: lo entrega el bloque 4-1B de esta misma fase.\n` +
      `Hueco reservado en packages/template-kit/src/capturas.ts (firma y contrato ya escritos).\n` +
      `Paquete pedido: ${opts.dir}`,
  };
}
