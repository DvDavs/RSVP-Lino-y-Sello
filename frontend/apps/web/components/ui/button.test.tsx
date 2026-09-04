import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button.tsx";

describe("Button (04 §18: aria-busy, nunca solo un spinner)", () => {
  it("es un <button> nativo con rol accesible", () => {
    render(<Button>Publicar</Button>);
    expect(screen.getByRole("button", { name: "Publicar" })).toBeTruthy();
  });

  it("aria-busy=true y disabled cuando busy, sin depender solo de un icono", () => {
    render(<Button busy>Guardando</Button>);
    const boton = screen.getByRole("button", { name: "Guardando" }) as HTMLButtonElement;
    expect(boton.getAttribute("aria-busy")).toBe("true");
    expect(boton.disabled).toBe(true);
  });

  it("dispara onClick al activarlo con teclado (Enter) — patrón ARIA button", async () => {
    const alHacerClic = vi.fn();
    render(<Button onClick={alHacerClic}>Ir</Button>);
    const boton = screen.getByRole("button", { name: "Ir" });
    boton.focus();
    await userEvent.keyboard("{Enter}");
    expect(alHacerClic).toHaveBeenCalledTimes(1);
  });
});
