// Piezas compartidas por los dos lados del protocolo `postMessage` v1 (`04 §9`).
// El spike importa el contrato REAL desde el entrypoint separado `@invitaciones/schema/canvas`
// (nunca desde `@invitaciones/schema`, que no lo reexporta — `04 §3`).
import {
  CANVAS_NONCE_LENGTH,
  CANVAS_PROTOCOL_TAG,
  CANVAS_PROTOCOL_VERSION,
} from "@invitaciones/schema/canvas";

export const EDITOR_ORIGIN =
  process.env.NEXT_PUBLIC_EDITOR_ORIGIN ?? "http://127.0.0.1:6100";

/** Nonce de canal del saludo: 32 caracteres (`04 §9.3`). No es un secreto criptográfico. */
export function nuevoNonce(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  const s = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return s.slice(0, CANVAS_NONCE_LENGTH);
}

/** Emisor con `seq` monótono POR DIRECCIÓN (`04 §9.1`). */
export function crearEmisor(enviar: (m: Record<string, unknown>) => void, seqInicial = 0) {
  let seq = seqInicial;
  return (cuerpo: Record<string, unknown>) => {
    const m = { p: CANVAS_PROTOCOL_TAG, v: CANVAS_PROTOCOL_VERSION, seq: seq++, ...cuerpo };
    enviar(m);
    return m;
  };
}

/** Mensaje de DIAGNÓSTICO del spike; NO forma parte del protocolo (marca distinta a propósito). */
export const DIAGNOSTICO = "inv-canvas-diagnostico" as const;
