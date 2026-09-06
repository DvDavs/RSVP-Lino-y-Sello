import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CatalogItem } from "@/lib/api-types";
import { PasoPlantilla } from "./PasoPlantilla.tsx";
import { SIN_FILTROS } from "./catalogo.ts";

const BODA: CatalogItem = {
  slug: "boda-clasica",
  version: "1.0.0",
  name: { "es-MX": "Boda clásica" },
  eventKinds: ["wedding"],
  minPlanTier: 2,
  previewUrl: "https://ejemplo.test/boda.webp",
  capabilities: ["story", "hashtags", "music"],
  status: "published",
};
const XV: CatalogItem = {
  slug: "xv-jardin",
  version: "1.0.0",
  name: { "es-MX": "XV Jardín" },
  eventKinds: ["quince"],
  minPlanTier: 1,
  previewUrl: "https://ejemplo.test/xv.webp",
  capabilities: ["hashtags"],
  status: "published",
};

function pintar(parcial: Partial<Parameters<typeof PasoPlantilla>[0]> = {}) {
  const alElegir = vi.fn();
  const alCambiarFiltros = vi.fn();
  const alElegirOtroTipo = vi.fn();
  const vista = render(
    <PasoPlantilla
      items={[BODA, XV]}
      plan={2}
      filtros={SIN_FILTROS}
      alCambiarFiltros={alCambiarFiltros}
      alElegir={alElegir}
      ocupada={null}
      elegida={null}
      alElegirOtroTipo={alElegirOtroTipo}
      {...parcial}
    />,
  );
  return { alElegir, alCambiarFiltros, alElegirOtroTipo, ...vista };
}

describe("paso 2 — Elige el punto de partida", () => {
  it("pinta una tarjeta por plantilla, con su vista previa y su nombre", () => {
    pintar();
    expect(screen.getByRole("heading", { name: "Boda clásica", level: 2 })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Vista previa de la plantilla Boda clásica" })).toBeTruthy();
    expect(screen.getByText("2 resultados")).toBeTruthy();
  });

  it("con plan suficiente, el botón usa la plantilla", async () => {
    const { alElegir } = pintar();
    await userEvent.click(screen.getByTestId("asistente-usar-boda-clasica"));
    expect(alElegir).toHaveBeenCalledWith(BODA);
  });

  it("bloqueada por plan: dice el MOTIVO y ofrece una salida real, nunca un control mudo", () => {
    pintar({ plan: 1 });
    // No hay botón de usar para la bloqueada…
    expect(screen.queryByTestId("asistente-usar-boda-clasica")).toBeNull();
    // …pero sí el motivo (dos veces: insignia y línea junto al enlace) y el enlace a los planes.
    expect(screen.getAllByText("Requiere el plan 2").length).toBeGreaterThan(0);
    const salida = screen.getByRole("link", { name: "Ver qué incluye el plan 2" });
    expect(salida.getAttribute("href")).toBe("/ayuda#planes");
    // La otra sigue usable: no se bloquea la pantalla entera.
    expect(screen.getByTestId("asistente-usar-xv-jardin")).toBeTruthy();
  });

  it("mientras una elección está en curso, el resto de tarjetas quedan inertes (`04 §7.1` paso 2)", () => {
    pintar({ ocupada: "xv-jardin" });
    const enCurso = screen.getByTestId("asistente-usar-xv-jardin");
    expect(enCurso.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText("Preparando tu invitación…")).toBeTruthy();
    expect(screen.getByTestId("asistente-usar-boda-clasica").hasAttribute("disabled")).toBe(true);
  });

  it("los filtros son los del catálogo REAL: plan y capacidades del manifiesto", async () => {
    const { alCambiarFiltros } = pintar();
    const grupo = screen.getByRole("group", { name: "Filtrar plantillas" });
    expect(grupo).toBeTruthy();
    expect(screen.getByRole("button", { name: "Todas · 2" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Incluidas en mi plan" }));
    expect(alCambiarFiltros).toHaveBeenCalledWith({ soloDeMiPlan: true, capacidad: null });
    await userEvent.click(screen.getByRole("button", { name: "Música" }));
    expect(alCambiarFiltros).toHaveBeenLastCalledWith({ soloDeMiPlan: false, capacidad: "music" });
    // Una capacidad que ninguna plantilla declara no se ofrece como filtro.
    expect(screen.queryByRole("button", { name: "Cuenta regresiva" })).toBeNull();
  });

  it("el filtro aplicado se refleja en el chip y en el número de resultados", () => {
    pintar({ filtros: { soloDeMiPlan: false, capacidad: "music" } });
    expect(screen.getByRole("button", { name: "Música" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("1 resultado")).toBeTruthy();
  });

  it("catálogo vacío para el tipo: estado vacío con salida a elegir otro tipo", async () => {
    const { alElegirOtroTipo } = pintar({ items: [] });
    expect(screen.getByRole("heading", { name: "Todavía no hay plantillas para este tipo" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Elegir otro tipo" }));
    expect(alElegirOtroTipo).toHaveBeenCalled();
  });

  it("filtros sin resultados: se ofrece quitar el filtro, no un callejón sin salida", async () => {
    const { alCambiarFiltros } = pintar({ filtros: { soloDeMiPlan: true, capacidad: "countdown" } });
    expect(screen.getByText("0 resultados")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Ningún diseño cumple ese filtro" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Quitar los filtros" }));
    expect(alCambiarFiltros).toHaveBeenLastCalledWith({ soloDeMiPlan: false, capacidad: null });
  });

  it("mientras carga pinta esqueletos, no una pantalla en blanco", () => {
    const { container } = pintar({ items: null });
    expect(container.querySelectorAll("[aria-busy='true']").length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
  });
});
