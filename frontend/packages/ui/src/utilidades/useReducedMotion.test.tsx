// useReducedMotion.test.tsx — el hook que apaga el movimiento que CSS no puede apagar solo.
import type { JSX } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useReducedMotion } from "./useReducedMotion.ts";

type Escucha = (evento: MediaQueryListEvent) => void;

/** `matchMedia` de mentira con un interruptor que se puede mover a mitad de vida. */
function instalarMatchMedia(inicial: boolean): { cambiar: (v: boolean) => void; consultas: string[] } {
  let valor = inicial;
  const escuchas = new Set<Escucha>();
  const consultas: string[] = [];
  vi.stubGlobal("matchMedia", (consulta: string) => {
    consultas.push(consulta);
    return {
      get matches() {
        return valor;
      },
      media: consulta,
      addEventListener: (_: string, cb: Escucha) => escuchas.add(cb),
      removeEventListener: (_: string, cb: Escucha) => escuchas.delete(cb),
    } as unknown as MediaQueryList;
  });
  return {
    consultas,
    cambiar: (v: boolean) => {
      valor = v;
      for (const cb of escuchas) cb({ matches: v } as MediaQueryListEvent);
    },
  };
}

function Sonda(): JSX.Element {
  return <span data-testid="sonda">{useReducedMotion() ? "reduce" : "no-preference"}</span>;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useReducedMotion()", () => {
  it("consulta exactamente `prefers-reduced-motion: reduce`", () => {
    const mm = instalarMatchMedia(false);
    render(<Sonda />);
    expect(mm.consultas).toContain("(prefers-reduced-motion: reduce)");
  });

  it("devuelve el valor del sistema desde el PRIMER render (sin un frame animado de más)", () => {
    instalarMatchMedia(true);
    render(<Sonda />);
    expect(screen.getByTestId("sonda")).toHaveTextContent("reduce");
  });

  it("reacciona cuando la preferencia cambia en caliente", () => {
    const mm = instalarMatchMedia(false);
    render(<Sonda />);
    expect(screen.getByTestId("sonda")).toHaveTextContent("no-preference");
    act(() => mm.cambiar(true));
    expect(screen.getByTestId("sonda")).toHaveTextContent("reduce");
  });

  it("se desuscribe al desmontar", () => {
    const quitar = vi.fn();
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: quitar,
    }));
    const { unmount } = render(<Sonda />);
    unmount();
    expect(quitar).toHaveBeenCalledTimes(1);
  });

  describe("sin `matchMedia` (servidor, navegadores viejos)", () => {
    beforeEach(() => {
      vi.stubGlobal("matchMedia", undefined);
    });

    it("no revienta y asume `no-preference`", () => {
      render(<Sonda />);
      expect(screen.getByTestId("sonda")).toHaveTextContent("no-preference");
    });
  });
});
