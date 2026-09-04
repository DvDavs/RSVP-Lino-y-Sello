// lib/tab-lock.test.ts — un solo editor por navegador (04 §12.6 (a), ADR-1R-F-05). Es la capa de
// PREVENCIÓN del conflicto: elimina el caso más común (dos pestañas del mismo cliente).
import { describe, expect, it, vi } from "vitest";
import { createTabLock, type TabRole } from "./tab-lock.ts";

/** Bus en memoria que imita a `BroadcastChannel`: entrega a todos MENOS al emisor. */
function busSimulado() {
  const canales: { onmessage: ((e: MessageEvent) => void) | null; cerrado: boolean }[] = [];
  function factory(): BroadcastChannel {
    const canal = {
      onmessage: null as ((e: MessageEvent) => void) | null,
      cerrado: false,
      postMessage(data: unknown) {
        for (const otro of canales) {
          if (otro !== canal && !otro.cerrado) otro.onmessage?.({ data } as MessageEvent);
        }
      },
      close() {
        canal.cerrado = true;
      },
    };
    canales.push(canal);
    return canal as unknown as BroadcastChannel;
  }
  return { factory, canales };
}

describe("candado de pestaña", () => {
  it("la primera pestaña es editora; la segunda entra en solo lectura", () => {
    const { factory } = busSimulado();
    const roles: Record<string, TabRole[]> = { a: [], b: [] };
    const a = createTabLock({ invitationId: 5, onRole: (r) => roles.a?.push(r), channelFactory: factory, setTimeoutImpl: (fn) => { fn(); return 0 as never; } });
    expect(a.role()).toBe("editor");
    const b = createTabLock({ invitationId: 5, onRole: (r) => roles.b?.push(r), channelFactory: factory, setTimeoutImpl: (fn) => { fn(); return 0 as never; } });
    expect(b.role()).toBe("readonly");
    expect(roles.b).toEqual(["readonly"]);
    expect(a.role()).toBe("editor");
    a.destroy();
    b.destroy();
  });

  it("«Editar aquí de todas formas» toma el control y degrada a la otra", () => {
    const { factory } = busSimulado();
    const rolesA: TabRole[] = [];
    const a = createTabLock({ invitationId: 5, onRole: (r) => rolesA.push(r), channelFactory: factory, setTimeoutImpl: (fn) => { fn(); return 0 as never; } });
    const b = createTabLock({ invitationId: 5, onRole: () => {}, channelFactory: factory, setTimeoutImpl: (fn) => { fn(); return 0 as never; } });
    expect(b.role()).toBe("readonly");
    b.takeover();
    expect(b.role()).toBe("editor");
    expect(a.role()).toBe("readonly");
    expect(rolesA).toEqual(["readonly"]);
    a.destroy();
    b.destroy();
  });

  it("dos invitaciones distintas no se pisan: el canal lleva el id", () => {
    const { factory, canales } = busSimulado();
    const a = createTabLock({ invitationId: 5, onRole: () => {}, channelFactory: (n) => (n === "tpl-editor:5" ? factory() : null), setTimeoutImpl: (fn) => { fn(); return 0 as never; } });
    const b = createTabLock({ invitationId: 6, onRole: () => {}, channelFactory: (n) => (n === "tpl-editor:5" ? factory() : null), setTimeoutImpl: (fn) => { fn(); return 0 as never; } });
    expect(a.role()).toBe("editor");
    expect(b.role()).toBe("editor");
    expect(canales).toHaveLength(1);
    a.destroy();
    b.destroy();
  });

  it("sin `BroadcastChannel` la pestaña sigue siendo editora (degradar sin poder comprobar sería peor)", () => {
    const lock = createTabLock({ invitationId: 5, onRole: () => {}, channelFactory: () => null });
    expect(lock.role()).toBe("editor");
    expect(() => lock.destroy()).not.toThrow();
  });

  it("un mensaje ajeno o malformado en el canal no cambia el rol", () => {
    const { factory, canales } = busSimulado();
    const lock = createTabLock({ invitationId: 5, onRole: () => {}, channelFactory: factory, setTimeoutImpl: (fn) => { fn(); return 0 as never; } });
    canales[0]?.onmessage?.({ data: null } as MessageEvent);
    canales[0]?.onmessage?.({ data: { t: 42 } } as unknown as MessageEvent);
    canales[0]?.onmessage?.({ data: { t: "HELD", from: lock.id } } as MessageEvent); // eco de sí misma
    expect(lock.role()).toBe("editor");
    lock.destroy();
  });

  it("`postMessage` sobre un canal cerrado no propaga", () => {
    const factory = () =>
      ({
        onmessage: null,
        postMessage: () => {
          throw new Error("canal cerrado");
        },
        close: () => {
          throw new Error("ya cerrado");
        },
      }) as unknown as BroadcastChannel;
    const lock = createTabLock({ invitationId: 5, onRole: () => {}, channelFactory: factory, setTimeoutImpl: (fn) => { fn(); return 0 as never; } });
    expect(() => lock.takeover()).not.toThrow();
    expect(() => lock.destroy()).not.toThrow();
  });

  it("con `BroadcastChannel` real del entorno tampoco lanza", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const lock = createTabLock({ invitationId: 99, onRole: () => {} });
    expect(["editor", "readonly"]).toContain(lock.role());
    lock.destroy();
    spy.mockRestore();
  });
});
