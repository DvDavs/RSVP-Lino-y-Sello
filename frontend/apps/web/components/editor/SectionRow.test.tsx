// components/editor/SectionRow.test.tsx — U-18 (`04 §20.1`): una sección `required: true` NO tiene
// interruptor; la fila dice "siempre visible". Cubre también que el menú `⋮` (alternativa sin
// arrastre, 2.5.7) ofrece Subir/Bajar/Mover al principio/Mover al final.
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SectionRow, type SectionRowProps } from "./SectionRow.tsx";

function envolver(props: Partial<SectionRowProps> = {}) {
  const base: SectionRowProps = {
    fila: { key: "cover", title: "Portada", visible: true, required: false },
    seleccionada: false,
    esPrimera: false,
    esUltima: false,
    onSeleccionar: vi.fn(),
    onCambiarVisible: vi.fn(),
    onSubir: vi.fn(),
    onBajar: vi.fn(),
    onMoverAlPrincipio: vi.fn(),
    onMoverAlFinal: vi.fn(),
    ...props,
  };
  render(
    <DndContext>
      <SortableContext items={[base.fila.key]}>
        <ul>
          <SectionRow {...base} />
        </ul>
      </SortableContext>
    </DndContext>,
  );
  return base;
}

describe("SectionRow — U-18", () => {
  it("una sección normal SÍ tiene interruptor de mostrar/ocultar", () => {
    envolver({ fila: { key: "story", title: "Nuestra historia", visible: true, required: false } });
    expect(screen.getByRole("switch")).toBeTruthy();
    expect(screen.queryByText(/siempre visible/i)).toBeNull();
  });

  it("una sección required:true NO tiene interruptor y dice «siempre visible»", () => {
    envolver({ fila: { key: "cover", title: "Portada", visible: true, required: true } });
    expect(screen.queryByRole("switch")).toBeNull();
    // M-11 (`bitacora/3c-ux.md §4`): debajo de `sm` el mismo texto lo lleva el candado (para
    // lectores de pantalla) y a partir de `sm` la insignia — los dos viven en el DOM a la vez, el
    // tamaño de pantalla solo decide cuál se ve, así que hay dos coincidencias, no una.
    expect(screen.getAllByText(/siempre visible/i).length).toBeGreaterThan(0);
  });

  it("el menú ⋮ ofrece Subir/Bajar/Mover al principio/Mover al final (alternativa sin arrastre, 2.5.7)", async () => {
    const usuario = userEvent.setup();
    const props = envolver({ esPrimera: false, esUltima: false });
    await usuario.click(screen.getByRole("button", { name: /más opciones/i }));

    const subir = await screen.findByRole("menuitem", { name: "Subir" });
    await usuario.click(subir);
    expect(props.onSubir).toHaveBeenCalledTimes(1);
  });

  it("Subir/Mover al principio se deshabilitan en la primera fila; Bajar/Mover al final en la última", async () => {
    const usuario = userEvent.setup();
    envolver({ esPrimera: true, esUltima: false });
    await usuario.click(screen.getByRole("button", { name: /más opciones/i }));
    expect(screen.getByRole("menuitem", { name: "Subir" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("menuitem", { name: "Bajar" }).getAttribute("aria-disabled")).not.toBe("true");
  });
});
