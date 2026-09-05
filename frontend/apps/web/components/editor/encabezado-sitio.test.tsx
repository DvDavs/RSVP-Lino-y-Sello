// components/editor/encabezado-sitio.test.tsx — U-1, mitad de la cabecera: «Ayuda» y «Mi cuenta»
// eran `href="#"`. La clienta hizo clic en las dos y la URL solo ganó una almohadilla.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EncabezadoSitio } from "./EncabezadoSitio.tsx";
import { clearAuthToken, getAuthToken, setAuthToken } from "@/lib/api-client";

const push = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

beforeEach(() => {
  push.mockReset();
  refresh.mockReset();
  clearAuthToken();
});

describe("la cabecera no tiene ni un enlace muerto", () => {
  it("ningún enlace apunta a «#» (el defecto exacto de U-1)", () => {
    render(<EncabezadoSitio />);
    for (const enlace of screen.getAllByRole("link")) {
      expect(enlace.getAttribute("href")).not.toBe("#");
      expect(enlace.getAttribute("href")).toMatch(/^\//);
    }
  });

  it("«Ayuda» lleva a la página de ayuda de verdad", () => {
    render(<EncabezadoSitio />);
    expect(screen.getByRole("link", { name: "Ayuda" }).getAttribute("href")).toBe("/ayuda");
  });
});

describe("el control de cuenta dice lo que se puede hacer, y lo hace", () => {
  it("sin sesión ofrece «Iniciar sesión» y conserva a dónde volver", () => {
    render(<EncabezadoSitio volverA="/editor/3" />);
    expect(screen.getByRole("link", { name: "Iniciar sesión" }).getAttribute("href")).toBe(
      "/acceso?volver=%2Feditor%2F3",
    );
  });

  it("con sesión ofrece «Cerrar sesión», y al pulsarlo el token deja de existir", async () => {
    setAuthToken("jwt-de-prueba");
    render(<EncabezadoSitio />);
    const boton = await screen.findByRole("button", { name: "Cerrar sesión" });
    await userEvent.click(boton);
    expect(getAuthToken()).toBeNull();
    expect(push).toHaveBeenCalledWith("/acceso");
  });
});
