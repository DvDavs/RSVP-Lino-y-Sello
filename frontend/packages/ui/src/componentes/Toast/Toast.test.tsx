import { act, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Toaster, toast } from "./Toast.tsx";
import { _reiniciarTostadasParaPruebas, TOPE_COLA } from "./store.ts";

expect.extend(toHaveNoViolations);

beforeEach(() => {
  _reiniciarTostadasParaPruebas();
});
afterEach(() => {
  _reiniciarTostadasParaPruebas();
});

describe("Toast / Toaster", () => {
  it("monta una región role=status con aria-live=polite, vacía sin avisos", () => {
    const { container } = render(<Toaster />);
    const region = container.querySelector('[data-region="anuncio-tostadas"]');
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute("role", "status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveTextContent("");
  });

  it("toast() encola un aviso, visible con título en negrita y descripción", () => {
    const { container } = render(<Toaster />);
    act(() => {
      toast({ titulo: "Enlace copiado.", descripcion: "Ya puedes pegarlo en WhatsApp.", variante: "exito" });
    });
    const lista = within(screen.getByRole("region"));
    expect(lista.getByText("Enlace copiado.")).toBeInTheDocument();
    expect(lista.getByText("Ya puedes pegarlo en WhatsApp.")).toBeInTheDocument();
    const region = container.querySelector('[data-region="anuncio-tostadas"]');
    expect(region?.textContent).toContain("Enlace copiado.");
    expect(region?.textContent).toContain("Ya puedes pegarlo en WhatsApp.");
  });

  it(`la cola tiene tope (${TOPE_COLA}): al llegar una tercera se retira la más antigua`, () => {
    render(<Toaster />);
    act(() => {
      toast({ descripcion: "Primero" });
      toast({ descripcion: "Segundo" });
      toast({ descripcion: "Tercero" });
    });
    const lista = within(screen.getByRole("region"));
    expect(lista.queryByText("Primero")).not.toBeInTheDocument();
    expect(lista.getByText("Segundo")).toBeInTheDocument();
    expect(lista.getByText("Tercero")).toBeInTheDocument();
  });

  it("el botón de cerrar quita la tostada y tiene nombre accesible «Cerrar»", async () => {
    const usuario = userEvent.setup();
    render(<Toaster />);
    act(() => {
      toast({ descripcion: "Se guardaron tus cambios.", variante: "info" });
    });
    const lista = within(screen.getByRole("region"));
    const aviso = lista.getByText("Se guardaron tus cambios.").closest("li");
    expect(aviso).not.toBeNull();
    const cerrar = within(aviso as HTMLElement).getByRole("button", { name: "Cerrar" });
    await usuario.click(cerrar);
    expect(lista.queryByText("Se guardaron tus cambios.")).not.toBeInTheDocument();
  });

  it("sin violaciones de a11y con un aviso visible", async () => {
    const { container } = render(<Toaster />);
    act(() => {
      toast({ titulo: "Algo salió mal.", descripcion: "Inténtalo de nuevo.", variante: "error" });
    });
    expect(await axe(container)).toHaveNoViolations();
  });
});
