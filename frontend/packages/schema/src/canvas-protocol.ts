// packages/schema/src/canvas-protocol.ts — protocolo `postMessage` v1 entre el chrome del editor
// (padre) y el lienzo aislado (iframe de origen opaco). Fuente normativa: `diseno/04-frontend-y-editor.md`
// §9 (ADR-1R-F-03, que enmienda la lista ilustrativa de mensajes de ADR-018).
//
// REGLAS DURAS DE ESTE ARCHIVO
//  1. **NO se reexporta desde `index.ts`** y `scripts/emit-json-schema.ts` **no lo importa**
//     (`04 §3`, `contratos.md §8`): el protocolo es superficie de la app, no contrato con Kotlin.
//     Se consume por el *entrypoint* separado `@invitaciones/schema/canvas`.
//  2. Prohibidos los refinamientos de Zod (`.refine`, `.superRefine`, `.transform`) por ADR-005: se
//     descartan en silencio al emitir JSON Schema. El protocolo no los necesita.
//  3. Nada se descarta en silencio (P1): todo mensaje entrante pasa por `classifyMessage`, que
//     devuelve SIEMPRE una categoría explícita ("ok" | "incompatible" | "foreign" | "invalid").
//  4. Ningún mensaje padre → lienzo lleva el token de sesión ni datos sin resolver (P8, `04 §8.4` C4).
//     Por eso `RENDER` viaja con `ComposedDocument` (URLs ya resueltas) y nunca con
//     `InvitationDocument` + `BusinessSnapshot`.
// ⚠ ORDEN DE IMPORTS SIGNIFICATIVO: `./canvas-runtime.ts` DEBE ir el primero. Fija `jitless` en Zod
// antes de que se construya ningún esquema; si se mueve, la sonda `new Function("")` de Zod dispara
// un `securitypolicyviolation` dentro del lienzo y el criterio A4 de la compuerta falla. Ver ese
// archivo para la evidencia medida.
import "./canvas-runtime.ts";
import { z } from "zod";
import { BlockId, SectionKey, Ident, Ulid } from "./common.ts";
import { ComposedDocument, ResolvedValue } from "./composed.ts";

/** Versión del protocolo. Un mensaje con otra versión NO se interpreta: el puente pasa a "incompatible" (§9.5). */
export const CANVAS_PROTOCOL_VERSION = 1 as const;

/** Marca de protocolo: descarta ruido de extensiones del navegador y de otros iframes (§9.1). */
export const CANVAS_PROTOCOL_TAG = "inv-canvas" as const;

/** Referencia a un bloque del documento compuesto. `itemId`/`itemBlockId` solo para bloques de grupo. */
export const BlockRef = z.strictObject({
  sectionKey: SectionKey,
  blockId: BlockId,
  itemId: Ulid.optional(),
  itemBlockId: BlockId.optional(),
});
export type BlockRef = z.infer<typeof BlockRef>;

/**
 * Sobre común (§9.1). `seq` es monótono POR DIRECCIÓN; `id`/`replyTo` solo en pares petición-respuesta
 * (por eso aquí son opcionales y se endurecen a obligatorios en `PING`/`PONG`, únicos con respuesta).
 */
const envelope = {
  p: z.literal(CANVAS_PROTOCOL_TAG),
  v: z.literal(CANVAS_PROTOCOL_VERSION),
  seq: z.number().int().min(0),
  id: z.string().max(64).optional(),
  replyTo: z.string().max(64).optional(),
} as const;

/** Longitud del nonce del saludo (§9.3 `HELLO`, §9.4 `READY`). */
export const CANVAS_NONCE_LENGTH = 32;

const Provenance = z.enum(["user", "default", "business", "fixed", "empty"]);

// ─────────────────────────────────────────────────────────────────────────────────────────────
// §9.3 — Mensajes padre → lienzo (8)
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Único mensaje enviado por `window.postMessage`; transfiere `port2` del `MessageChannel`. */
export const HelloMessage = z.strictObject({
  ...envelope,
  t: z.literal("HELLO"),
  nonce: z.string().length(CANVAS_NONCE_LENGTH),
});

/** Estado completo. Al arrancar, tras cada respuesta del servidor y tras toda operación estructural. */
export const RenderMessage = z.strictObject({
  ...envelope,
  t: z.literal("RENDER"),
  composed: ComposedDocument,
  revision: z.number().int(),
});

/** Delta para ediciones escalares optimistas: evita reenviar 100-200 KB de `ComposedDocument` por tecla. */
export const PatchMessage = z.strictObject({
  ...envelope,
  t: z.literal("PATCH"),
  entries: z
    .array(
      z.strictObject({
        ref: BlockRef,
        value: ResolvedValue.nullable(),
        provenance: Provenance,
        pending: z.boolean(),
      }),
    )
    .min(1)
    .max(50),
});

/** Resalta y desplaza al bloque activo del panel; `null` limpia la selección. */
export const SelectBlockMessage = z.strictObject({
  ...envelope,
  t: z.literal("SELECT_BLOCK"),
  ref: BlockRef.nullable(),
});

/** Al pulsar una fila de la lista de secciones. */
export const ScrollToSectionMessage = z.strictObject({
  ...envelope,
  t: z.literal("SCROLL_TO_SECTION"),
  sectionKey: SectionKey,
});

/** Flujo D: el iframe ajusta su propia raíz; el padre además cambia el ancho del elemento. */
export const SetViewportMessage = z.strictObject({
  ...envelope,
  t: z.literal("SET_VIEWPORT"),
  width: z.enum(["mobile", "desktop"]),
});

/** Vista previa efímera al pasar el ratón por un *swatch*; `null` restaura. No genera operación ni undo. */
export const PreviewThemeMessage = z.strictObject({
  ...envelope,
  t: z.literal("PREVIEW_THEME"),
  paletteId: Ident.nullable(),
  fontSetId: Ident.nullable(),
});

/** Diagnóstico y detección de lienzo colgado. Espera `PONG`, así que `id` es obligatorio. */
export const PingMessage = z.strictObject({
  ...envelope,
  t: z.literal("PING"),
  id: z.string().min(1).max(64),
});

export const CanvasInbound = z.discriminatedUnion("t", [
  HelloMessage,
  RenderMessage,
  PatchMessage,
  SelectBlockMessage,
  ScrollToSectionMessage,
  SetViewportMessage,
  PreviewThemeMessage,
  PingMessage,
]);
export type CanvasInbound = z.infer<typeof CanvasInbound>;

// ─────────────────────────────────────────────────────────────────────────────────────────────
// §9.4 — Mensajes lienzo → padre (8)
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Fin del saludo. `buildId` permite detectar que el padre quedó con un despliegue viejo (§9.5). */
export const ReadyMessage = z.strictObject({
  ...envelope,
  t: z.literal("READY"),
  protocolVersion: z.literal(CANVAS_PROTOCOL_VERSION),
  buildId: z.string().max(64),
  nonce: z.string().length(CANVAS_NONCE_LENGTH),
});

/** Abre el campo en el panel con el foco puesto (flujo A.5). */
export const BlockClickedMessage = z.strictObject({
  ...envelope,
  t: z.literal("BLOCK_CLICKED"),
  ref: BlockRef,
});

/** Sincroniza el resaltado de la lista al hacer scroll (`IntersectionObserver` dentro del iframe). */
export const SectionInViewMessage = z.strictObject({
  ...envelope,
  t: z.literal("SECTION_IN_VIEW"),
  sectionKey: SectionKey,
});

/** Medición que el padre NO puede hacer: no tiene acceso al DOM del lienzo (§8.3). */
export const CanvasResizedMessage = z.strictObject({
  ...envelope,
  t: z.literal("CANVAS_RESIZED"),
  height: z.number().int().min(0).max(200000),
});

/** Atajos capturados con el foco dentro del lienzo (§7.2). */
export const KeyCommandMessage = z.strictObject({
  ...envelope,
  t: z.literal("KEY_COMMAND"),
  command: z.enum(["undo", "redo", "save", "escape"]),
});

/** Una sección lanzó dentro de su `ErrorBoundary`: el padre avisa SIN tumbar el editor. */
export const RenderErrorMessage = z.strictObject({
  ...envelope,
  t: z.literal("RENDER_ERROR"),
  sectionKey: SectionKey.optional(),
  message: z.string().max(500),
  digest: z.string().max(64).optional(),
});

/** Incidencias no fatales; el chrome las agrupa en un aviso discreto y las registra. */
export const RenderWarningMessage = z.strictObject({
  ...envelope,
  t: z.literal("RENDER_WARNING"),
  code: z.enum(["unknown-variant", "unmapped-role", "missing-font"]),
  detail: z.string().max(200),
});

/** Respuesta a `PING`: `replyTo` obligatorio (es lo único que transporta). */
export const PongMessage = z.strictObject({
  ...envelope,
  t: z.literal("PONG"),
  replyTo: z.string().min(1).max(64),
});

export const CanvasOutbound = z.discriminatedUnion("t", [
  ReadyMessage,
  BlockClickedMessage,
  SectionInViewMessage,
  CanvasResizedMessage,
  KeyCommandMessage,
  RenderErrorMessage,
  RenderWarningMessage,
  PongMessage,
]);
export type CanvasOutbound = z.infer<typeof CanvasOutbound>;

// ─────────────────────────────────────────────────────────────────────────────────────────────
// §9.5 — Discriminación y validación
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Sonda mínima del sobre: solo `p` y `v`. Sirve para separar tres cosas que NO son lo mismo (P1):
 * ruido ajeno al protocolo, protocolo con versión incompatible, y protocolo v1 mal formado.
 * `z.object` (no `strictObject`) a propósito: la sonda no juzga el resto del mensaje.
 */
export const CanvasEnvelopeProbe = z.object({
  p: z.literal(CANVAS_PROTOCOL_TAG),
  v: z.number().int(),
});

export type CanvasMessageVerdict<T> =
  /** Mensaje del protocolo v1, válido. */
  | { readonly status: "ok"; readonly message: T }
  /** Lleva la marca `inv-canvas` pero con otra versión: el puente pasa a "incompatible" (U-15). */
  | { readonly status: "incompatible"; readonly version: number }
  /** No lleva la marca del protocolo: ruido de extensiones u otros iframes. Se registra, no se procesa. */
  | { readonly status: "foreign" }
  /** Marca y versión correctas, pero el mensaje no valida. Se rechaza entero y se registra. */
  | { readonly status: "invalid"; readonly error: z.ZodError };

function classify<S extends z.ZodType>(esquema: S, data: unknown): CanvasMessageVerdict<z.infer<S>> {
  const sobre = CanvasEnvelopeProbe.safeParse(data);
  if (!sobre.success) return { status: "foreign" };
  if (sobre.data.v !== CANVAS_PROTOCOL_VERSION) return { status: "incompatible", version: sobre.data.v };
  const r = esquema.safeParse(data);
  if (!r.success) return { status: "invalid", error: r.error };
  return { status: "ok", message: r.data as z.infer<S> };
}

/** Clasifica lo que RECIBE el lienzo (padre → lienzo). Único punto de entrada del hijo. */
export function classifyInbound(data: unknown): CanvasMessageVerdict<CanvasInbound> {
  return classify(CanvasInbound, data);
}

/** Clasifica lo que RECIBE el padre (lienzo → padre). Único punto de entrada del puente. */
export function classifyOutbound(data: unknown): CanvasMessageVerdict<CanvasOutbound> {
  return classify(CanvasOutbound, data);
}

/**
 * Desactiva el compilador JIT de Zod **en este realm**. El lienzo DEBE llamarla una vez, antes del
 * primer `classifyInbound`.
 *
 * Motivo, MEDIDO en la compuerta A1-A8 de la fase 3 (bloque 3-0b), no supuesto: para decidir si
 * puede usar su ruta rápida, Zod 4 ejecuta `Function("")` dentro de un `try/catch`. Bajo la CSP del
 * lienzo (`script-src <host> 'nonce-…'`, sin `'unsafe-eval'`) esa llamada la bloquea el navegador y
 * — aunque Zod se recupera solo y valida igual — queda registrado un evento
 * `securitypolicyviolation` (`blockedURI: "eval"`), y el criterio A4 exige CERO. El propio código de
 * Zod salta la prueba cuando `jitless` está puesto (`zod/v4/core/util.cjs:216`).
 *
 * `./canvas-runtime.ts` ya lo hace al importar este módulo, sobre la instancia de Zod que usa el
 * paquete. Esta función existe para el caso en que la APLICACIÓN traiga **otra copia** de `zod` en
 * su árbol de dependencias (dos `node_modules/zod` distintos = dos `globalConfig` distintos, cosa
 * que ocurrió en el spike de esta compuerta): entonces el lienzo debe llamarla también sobre la
 * suya. Es idempotente.
 */
export function configureZodForCanvas(): void {
  z.config({ jitless: true });
}
