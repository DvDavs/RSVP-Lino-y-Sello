// packages/sections/src/types.ts — tipos compartidos entre registry.ts y blocks/*, en un módulo
// propio (no dentro de registry.ts) para que blocks/types.ts pueda importarlos sin depender en
// tiempo de ejecución de registry.ts (que sí importa los componentes de bloque). `registry.ts`
// re-exporta `RenderMode`/`BlockRef` para que su superficie pública siga siendo la de `04 §5.2`.

/** Modo de render. Determina si se montan overlays y listeners; nada visual cambia (04 §5.1). */
export type RenderMode = "canvas" | "public";

/** Referencia estable a un bloque: los grupos necesitan (blockId, itemId, itemBlockId).
 *  Misma forma que `BlockRef` de `@invitaciones/schema/canvas` (canvas-protocol.ts:32-38) —
 *  deliberadamente NO importada de ahí: ese entrypoint es superficie de protocolo postMessage
 *  (propiedad de `apps/web/lib/canvas-*`), y `packages/sections` no debe depender de él (separa
 *  "qué bloque es este" de "cómo se lo cuento al padre por postMessage"). Estructuralmente
 *  compatibles por construcción: cualquier `BlockRef` de aquí es asignable a uno de `canvas`. */
export interface BlockRef {
  readonly sectionKey: string;
  readonly blockId: string; // id del bloque o del grupo
  readonly itemId?: string; // ULID del ítem, si el bloque vive dentro de un grupo
  readonly itemBlockId?: string; // id relativo del bloque dentro del ítem
}

/** Códigos de aviso no fatal (mismo enum que `RenderWarningMessage.code` en canvas-protocol.ts:194). */
export type RenderWarningCode = "unknown-variant" | "unmapped-role" | "missing-font";

export interface RenderWarning {
  readonly code: RenderWarningCode;
  readonly detail: string;
}

/** Reporta un aviso no fatal. En mode="canvas" el padre lo recibe por postMessage
 *  (`apps/web/lib/canvas-bridge.ts`, fuera de este paquete); packages/sections no sabe hacer
 *  postMessage y no lo necesita — solo invoca este callback si se le da uno. Sin callback (p. ej.
 *  mode="public", donde nunca hay nadie escuchando) el aviso se pierde en silencio A PROPÓSITO:
 *  el render público no debe fallar ni imprimir ruido por un hueco de mapeo de rol.
 */
export type ReportWarning = (warning: RenderWarning) => void;
