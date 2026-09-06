// packages/template-kit/src/preview.ts — HUECO RESERVADO PARA EL BLOQUE 4-1B.
//
// `plantilla preview <dir>` tiene que levantar el render de la plantilla y dejar una miniatura
// (`assets/preview.webp`) declarada en el manifiesto con su `sha256` y sus `bytes` MEDIDOS
// (P5: `plantilla check` ya sabe medirlos y escribirlos — llámalo al final y no toques digestos).
//
// Lo entrega el sub-agente 4-1B, que continúa en este mismo worktree. El sub-comando ya está
// registrado en el CLI y sale en `--help` para que 4-1B sólo tenga que rellenar esta función.
//
// Contrato que 4-1A deja preparado y 4-1B debe respetar:
//   · devuelve `ResultadoSubcomando` (el mismo que `check`), con `salida` ya formateada;
//   · si escribe una imagen, la deja en `<dir>/assets/` y la declara en `template.json`;
//   · nunca ejecuta `playwright install` (Chromium está preinstalado; el proxy bloquea la descarga).

export interface OpcionesPreview {
  readonly dir: string;
  /** Ancho del lienzo en píxeles CSS. */
  readonly ancho?: number;
  /** Paleta de `theme.json` con la que rendersear; por omisión, `defaultPaletteId`. */
  readonly paleta?: string;
}

export interface ResultadoPreview {
  readonly ok: boolean;
  readonly salida: string;
  /** Rutas escritas dentro del paquete. */
  readonly escrituras: readonly string[];
}

/** TODO(4-1B): generar la miniatura del paquete. Ver la cabecera de este fichero. */
export function preview(opts: OpcionesPreview): ResultadoPreview {
  return {
    ok: false,
    escrituras: [],
    salida:
      `\`plantilla preview\` todavía no está implementado: lo entrega el bloque 4-1B de esta misma fase.\n` +
      `Hueco reservado en packages/template-kit/src/preview.ts (firma y contrato ya escritos).\n` +
      `Mientras tanto, un paquete sin \`previewImage\` es válido: el campo es opcional (01 §2.2).\n` +
      `Paquete pedido: ${opts.dir}`,
  };
}
