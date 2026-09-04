// components/editor/CanvasFrame.test.tsx — el iframe aislado y su degradación (04 §8.4, §8.8).
//
// jsdom no ejecuta el documento del iframe, así que aquí NO se prueba el saludo (eso está en
// `lib/canvas-bridge.test.ts` con los dos lados reales, y de punta a punta en `e2e/`). Lo que sí se
// prueba es lo que un fallo de configuración rompería en silencio: el `sandbox` sin
// `allow-same-origin` y la salida de degradación a `/preview/{id}`.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { CanvasFrame } from "./CanvasFrame.tsx";
import { useEditorStore } from "@/lib/store";

beforeEach(() => {
  useEditorStore.getState().reset();
});

describe("CanvasFrame", () => {
  it("monta el iframe con `sandbox=allow-scripts` y SIN `allow-same-origin` (ADR-018/031)", () => {
    render(<CanvasFrame invitationId="5" />);
    const marco = screen.getByTitle("Vista previa de la invitación");
    expect(marco.getAttribute("sandbox")).toBe("allow-scripts");
    expect(marco.getAttribute("sandbox")).not.toContain("allow-same-origin");
    expect(marco.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(marco.getAttribute("src")).toBe("/editor/5/canvas");
    // Mientras no llegue el `READY`, el lienzo está ocupado.
    expect(marco.getAttribute("aria-busy")).toBe("true");
  });

  it("la vista móvil cambia el ancho del elemento (04 §7.4)", () => {
    useEditorStore.setState({ viewport: "mobile" });
    render(<CanvasFrame invitationId="5" />);
    const marco = screen.getByTitle("Vista previa de la invitación");
    expect(marco.getAttribute("data-viewport")).toBe("mobile");
    expect(marco.className).toContain("w-[390px]");
  });

  it("tras DOS intentos fallidos degrada: el panel sigue y se ofrece /preview (04 §8.8)", () => {
    useEditorStore.setState({ canvas: { status: "error", height: 0, buildId: null, attempts: 2 } });
    render(<CanvasFrame invitationId="5" />);
    expect(screen.queryByTitle("Vista previa de la invitación")).toBeNull();
    expect(screen.getByRole("alert")).toBeTruthy();
    const enlace = screen.getByRole("link", { name: "Ver vista previa" });
    expect(enlace.getAttribute("href")).toBe("/preview/5");
    expect(enlace.getAttribute("target")).toBe("_blank");
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
  });

  it("con un solo fallo NO degrada todavía: el padre recarga el iframe una vez (04 §9.2)", () => {
    useEditorStore.setState({ canvas: { status: "error", height: 0, buildId: null, attempts: 1 } });
    render(<CanvasFrame invitationId="5" />);
    expect(screen.getByTitle("Vista previa de la invitación")).toBeTruthy();
  });
});
