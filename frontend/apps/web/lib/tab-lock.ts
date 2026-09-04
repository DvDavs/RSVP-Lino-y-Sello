// lib/tab-lock.ts — un solo editor por navegador (`04 §12.6 (a)`, ADR-1R-F-05).
//
// PREVENCIÓN antes que resolución: el caso más común del `409 TPL_REVISION_CONFLICT` es el mismo
// cliente con dos pestañas abiertas sobre la misma invitación. `BroadcastChannel` lo elimina sin
// ninguna infraestructura de servidor: al montar, la pestaña anuncia `CLAIM`; si otra responde
// `HELD` dentro de 300 ms, la nueva entra en modo `readonly` con el aviso "Esta invitación ya está
// abierta en otra pestaña. [Editar aquí de todas formas]", que envía `TAKEOVER` y degrada a la otra.
//
// No sustituye al diálogo de conflicto (§12.6 (b)): dos NAVEGADORES distintos, o dos dispositivos,
// siguen pudiendo chocar. Es la primera de las dos capas.
export type TabRole = "editor" | "readonly";

/** Ventana de espera de un `HELD` tras el `CLAIM` (04 §12.6 (a)). */
export const CLAIM_TIMEOUT_MS = 300;

type Mensaje =
  | { t: "CLAIM"; from: string }
  | { t: "HELD"; from: string }
  | { t: "TAKEOVER"; from: string };

export interface TabLock {
  /** Rol actual de ESTA pestaña. */
  role(): TabRole;
  /** Reclama el rol de editor pese a que otra pestaña lo tenga (botón "Editar aquí de todas formas"). */
  takeover(): void;
  /** Cierra el canal. Idempotente. */
  destroy(): void;
  /** Identificador de esta pestaña; útil en pruebas y trazas. */
  readonly id: string;
}

export interface TabLockOptions {
  invitationId: number;
  /** Se invoca cada vez que cambia el rol de ESTA pestaña. */
  onRole: (role: TabRole) => void;
  /** Fábrica inyectable para pruebas; por defecto `window.BroadcastChannel`. */
  channelFactory?: (name: string) => BroadcastChannel | null;
  timeoutMs?: number;
  setTimeoutImpl?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
}

function defaultChannel(name: string): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  try {
    return new BroadcastChannel(name);
  } catch {
    return null;
  }
}

function nuevoId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

/**
 * Crea el candado. Si el navegador no tiene `BroadcastChannel` (o lo bloquea), la pestaña se queda
 * como `editor` y se sigue confiando en el diálogo de conflicto: degradar a `readonly` sin poder
 * comprobar nada dejaría al cliente sin editor por una capacidad ausente.
 */
export function createTabLock(opts: TabLockOptions): TabLock {
  const id = nuevoId();
  const nombre = `tpl-editor:${opts.invitationId}`;
  const factory = opts.channelFactory ?? defaultChannel;
  const st = opts.setTimeoutImpl ?? ((fn, ms) => setTimeout(fn, ms));
  const canal = factory(nombre);
  let role: TabRole = "editor";
  let resuelto = false;

  function cambiarRol(nuevo: TabRole): void {
    if (role === nuevo) return;
    role = nuevo;
    opts.onRole(nuevo);
  }

  function publicar(m: Mensaje): void {
    try {
      canal?.postMessage(m);
    } catch {
      /* canal cerrado durante la descarga de la página */
    }
  }

  if (canal) {
    canal.onmessage = (evento: MessageEvent) => {
      const m = evento.data as Partial<Mensaje> | null;
      if (m === null || typeof m !== "object" || typeof m.t !== "string" || m.from === id) return;
      if (m.t === "CLAIM") {
        // Solo el editor vigente responde; si esta pestaña ya es readonly, calla.
        if (role === "editor") publicar({ t: "HELD", from: id });
        return;
      }
      if (m.t === "HELD") {
        if (!resuelto) {
          resuelto = true;
          cambiarRol("readonly");
        }
        return;
      }
      if (m.t === "TAKEOVER") {
        resuelto = true;
        cambiarRol("readonly");
      }
    };
    publicar({ t: "CLAIM", from: id });
    st(() => {
      // Nadie respondió `HELD`: esta pestaña se queda de editora.
      resuelto = true;
    }, opts.timeoutMs ?? CLAIM_TIMEOUT_MS);
  } else {
    resuelto = true;
  }

  return {
    id,
    role: () => role,
    takeover(): void {
      resuelto = true;
      publicar({ t: "TAKEOVER", from: id });
      cambiarRol("editor");
    },
    destroy(): void {
      try {
        canal?.close();
      } catch {
        /* ya cerrado */
      }
    },
  };
}
