import { describe, expect, it, vi } from "vitest";
import { render, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { CanvasProvider, useCanvasOptional, refKey } from "../../src/canvas/CanvasContext.tsx";

function Probe() {
  const canvas = useCanvasOptional();
  return <span data-testid="probe">{canvas ? "dentro" : "fuera"}</span>;
}

describe("CanvasContext", () => {
  it("useCanvasOptional() devuelve null fuera de un CanvasProvider (nunca lanza)", () => {
    const { getByTestId } = render(<Probe />);
    expect(getByTestId("probe").textContent).toBe("fuera");
  });

  it("useCanvasOptional() devuelve el valor dentro de un CanvasProvider", () => {
    const { getByTestId } = render(
      <CanvasProvider>
        <Probe />
      </CanvasProvider>,
    );
    expect(getByTestId("probe").textContent).toBe("dentro");
  });

  it("expone selected/pending/onActivate/reportWarning con los valores dados", () => {
    const onActivate = vi.fn();
    const reportWarning = vi.fn();
    const pending = new Set(["cover.title"]);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CanvasProvider
        selected={{ sectionKey: "cover", blockId: "cover.title" }}
        onActivate={onActivate}
        pending={pending}
        reportWarning={reportWarning}
      >
        {children}
      </CanvasProvider>
    );
    const { result } = renderHook(() => useCanvasOptional(), { wrapper });

    expect(result.current?.selected).toEqual({ sectionKey: "cover", blockId: "cover.title" });
    expect(result.current?.pending).toBe(pending);
    result.current?.onActivate({ sectionKey: "cover", blockId: "cover.title" });
    expect(onActivate).toHaveBeenCalledOnce();
    result.current?.reportWarning({ code: "unmapped-role", detail: "x" });
    expect(reportWarning).toHaveBeenCalledWith({ code: "unmapped-role", detail: "x" });
  });

  it("sin onActivate explícito, usa un no-op (no lanza al invocarse)", () => {
    const wrapper = ({ children }: { children: ReactNode }) => <CanvasProvider>{children}</CanvasProvider>;
    const { result } = renderHook(() => useCanvasOptional(), { wrapper });
    expect(() => result.current?.onActivate({ sectionKey: "s", blockId: "b" })).not.toThrow();
  });
});

describe("refKey", () => {
  it("compone sectionKey/blockId/itemId/itemBlockId de forma estable", () => {
    expect(refKey({ sectionKey: "family", blockId: "family.godparents" })).toBe("family::family.godparents::::");
    expect(
      refKey({ sectionKey: "family", blockId: "family.godparents", itemId: "01J8X", itemBlockId: "person" }),
    ).toBe("family::family.godparents::01J8X::person");
  });
});
