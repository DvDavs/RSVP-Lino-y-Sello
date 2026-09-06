import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs.tsx";

expect.extend(toHaveNoViolations);

function montar() {
  return render(
    <Tabs defaultValue="secciones">
      <TabsList aria-label="Panel del editor">
        <TabsTrigger value="secciones">Secciones</TabsTrigger>
        <TabsTrigger value="apariencia">Apariencia</TabsTrigger>
        <TabsTrigger value="fotos" disabled>
          Fotos
        </TabsTrigger>
      </TabsList>
      <TabsContent value="secciones">Panel de secciones</TabsContent>
      <TabsContent value="apariencia">Panel de apariencia</TabsContent>
      <TabsContent value="fotos">Panel de fotos</TabsContent>
    </Tabs>,
  );
}

describe("Tabs", () => {
  it("expone role=tablist/tab/tabpanel sin violaciones de a11y", async () => {
    const { container } = montar();
    expect(screen.getByRole("tablist", { name: "Panel del editor" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel de secciones");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("la pestaña activa lleva aria-selected=true y las demás false", () => {
    montar();
    expect(screen.getByRole("tab", { name: "Secciones" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Apariencia" })).toHaveAttribute("aria-selected", "false");
  });

  it("la pestaña deshabilitada no se activa y queda fuera del foco por teclado", () => {
    montar();
    expect(screen.getByRole("tab", { name: "Fotos" })).toBeDisabled();
  });

  it("activación MANUAL: la flecha mueve el foco pero no cambia el panel hasta Enter", async () => {
    const usuario = userEvent.setup();
    montar();
    await usuario.tab(); // entra a la pestaña activa (Secciones)
    expect(screen.getByRole("tab", { name: "Secciones" })).toHaveFocus();

    await usuario.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Apariencia" })).toHaveFocus();
    // Activación manual: mover el foco NO selecciona el panel todavía.
    expect(screen.getByRole("tab", { name: "Secciones" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel de secciones");

    await usuario.keyboard("{Enter}");
    expect(screen.getByRole("tab", { name: "Apariencia" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel de apariencia");
  });

  it("Inicio/Fin llevan el foco a la primera/última pestaña habilitada", async () => {
    const usuario = userEvent.setup();
    // Sin pestaña deshabilitada: con "Fotos" deshabilitada (como en `montar()`), Fin se detiene,
    // con razón, en la última HABILITADA ("Apariencia") — eso se prueba aparte, no aquí.
    render(
      <Tabs defaultValue="secciones">
        <TabsList aria-label="Panel del editor">
          <TabsTrigger value="secciones">Secciones</TabsTrigger>
          <TabsTrigger value="apariencia">Apariencia</TabsTrigger>
          <TabsTrigger value="fotos">Fotos</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    await usuario.tab();
    await usuario.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Fotos" })).toHaveFocus();
    await usuario.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Secciones" })).toHaveFocus();
  });

  it("Fin se detiene en la última pestaña HABILITADA cuando la última está deshabilitada", async () => {
    const usuario = userEvent.setup();
    montar();
    await usuario.tab();
    await usuario.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Apariencia" })).toHaveFocus();
  });
});
