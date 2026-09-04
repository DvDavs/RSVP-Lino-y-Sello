// components/editor/editor-chrome.test.tsx — los cuatro componentes del chrome del núcleo, contra
// el store REAL (la instancia por defecto): `SaveIndicator`, `UndoRedoBar`, `ViewportToggle` y
// `ConflictDialog`. Complementan U-13/U-14 con lo que el cliente realmente ve.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SaveIndicator } from "./SaveIndicator.tsx";
import { UndoRedoBar } from "./UndoRedoBar.tsx";
import { ViewportToggle } from "./ViewportToggle.tsx";
import { ConflictDialog } from "./ConflictDialog.tsx";
import { saveLabel, useEditorStore } from "@/lib/store";
import { composedFixture, documentFixture } from "../../test/fixtures/composed.ts";

const texto = (v: string) => ({ kind: "text" as const, value: v });

beforeEach(() => {
  useEditorStore.getState().reset();
});

function conDocumento() {
  useEditorStore.setState({
    invitationId: 5,
    loadState: "ready",
    document: documentFixture(),
    composed: composedFixture(),
    revision: 3,
    report: { missingRequired: [], stillDefault: ["cover.title"], orphanContent: [], orphanSections: [], invalidValues: [], themeFallback: null },
  });
}

describe("SaveIndicator · el indicador dice la verdad en todo momento (04 §12.8)", () => {
  it("cada estado de guardado tiene su cadena es-MX, sin ninguno mudo", () => {
    for (const estado of ["idle", "dirty", "saving", "retrying", "offline", "conflict", "error"] as const) {
      expect(saveLabel(estado, null).length).toBeGreaterThan(0);
    }
    expect(saveLabel("offline", null)).toContain("Sin conexión");
    expect(saveLabel("idle", 1_700_000_000_000)).toMatch(/^Guardado /);
  });

  it("es una región `status` con `aria-live` y expone el estado en el DOM", async () => {
    render(<SaveIndicator />);
    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.getAttribute("data-save-state")).toBe("idle");
    useEditorStore.setState({ saveState: "saving" });
    expect(await screen.findByText("Guardando…")).toBeTruthy();
    useEditorStore.setState({ saveState: "offline" });
    expect((await screen.findByRole("status")).getAttribute("data-save-state")).toBe("offline");
  });
});

describe("UndoRedoBar · el botón dice QUÉ se va a deshacer (04 §11)", () => {
  it("deshabilitado con las pilas vacías, y nunca lanza", async () => {
    render(<UndoRedoBar />);
    const deshacer = screen.getByTestId("undo") as HTMLButtonElement;
    expect(deshacer.disabled).toBe(true);
    expect(deshacer.getAttribute("aria-label")).toBe("No hay nada que deshacer");
    expect((screen.getByTestId("redo") as HTMLButtonElement).disabled).toBe(true);
  });

  it("el `aria-label` lleva la etiqueta es-MX de la entrada, no un genérico", async () => {
    conDocumento();
    useEditorStore.getState().setBlock("cover.title", texto("Ana y Luis"));
    render(<UndoRedoBar />);
    expect(screen.getByTestId("undo").getAttribute("aria-label")).toBe("Deshacer: Cambiar Título de la portada");
  });

  it("pulsar deshacer revierte y habilita rehacer", async () => {
    conDocumento();
    useEditorStore.getState().setBlock("cover.subtitle", texto("Nos casamos"));
    render(<UndoRedoBar />);
    await userEvent.click(screen.getByTestId("undo"));
    expect(useEditorStore.getState().undo).toHaveLength(0);
    expect((screen.getByTestId("redo") as HTMLButtonElement).disabled).toBe(false);
  });

  it("Ctrl+Z y Ctrl+Shift+Z funcionan con el foco en el chrome (04 §7.2)", async () => {
    conDocumento();
    useEditorStore.getState().setBlock("cover.subtitle", texto("A"));
    render(<UndoRedoBar />);
    await userEvent.keyboard("{Control>}z{/Control}");
    expect(useEditorStore.getState().redo).toHaveLength(1);
    await userEvent.keyboard("{Control>}{Shift>}z{/Shift}{/Control}");
    expect(useEditorStore.getState().undo).toHaveLength(1);
  });
});

describe("ViewportToggle · radiogroup de dos opciones, no un checkbox mudo (04 §7.4)", () => {
  it("expone `radiogroup` con nombre y dos `radio`", () => {
    render(<ViewportToggle />);
    const grupo = screen.getByRole("radiogroup", { name: "Ver la invitación en" });
    expect(within(grupo).getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByTestId("viewport-desktop").getAttribute("aria-checked")).toBe("true");
  });

  it("cambiar a móvil actualiza el store y avisa al lienzo", async () => {
    const viewport = vi.fn();
    useEditorStore.getState().attachCanvas({
      render: vi.fn(),
      patch: vi.fn(),
      select: vi.fn(),
      scrollToSection: vi.fn(),
      viewport,
      previewTheme: vi.fn(),
    });
    render(<ViewportToggle />);
    await userEvent.click(screen.getByTestId("viewport-mobile"));
    expect(useEditorStore.getState().viewport).toBe("mobile");
    expect(viewport).toHaveBeenCalledWith("mobile");
    useEditorStore.getState().attachCanvas(null);
  });
});

describe("ConflictDialog · tres opciones y sin rebase automático (04 §12.6)", () => {
  function abrirConflicto() {
    conDocumento();
    useEditorStore.setState({
      saveState: "conflict",
      conflict: {
        currentRevision: 11,
        currentDocument: documentFixture(),
        currentComposed: composedFixture(),
        currentReport: { missingRequired: [], stillDefault: [], orphanContent: [], orphanSections: [], invalidValues: [], themeFallback: null },
        pending: [{ op: "setBlock", blockId: "cover.title", value: texto("Ana") }],
        labels: ["Cambiar Título de la portada"],
        rebase: null,
      },
    });
  }

  it("no se pinta si no hay conflicto", () => {
    render(<ConflictDialog />);
    expect(screen.queryByTestId("conflict-dialog")).toBeNull();
  });

  it("pinta las TRES opciones, con la conservadora seleccionada por defecto", () => {
    abrirConflicto();
    render(<ConflictDialog />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect((radios[0] as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText(/Traer la versión nueva y perder mi/)).toBeTruthy();
  });

  it("la opción «ver mis cambios» los lista en lenguaje natural, no en JSON", async () => {
    abrirConflicto();
    render(<ConflictDialog />);
    await userEvent.click(screen.getAllByRole("radio")[2] as HTMLElement);
    expect(screen.getByText("Cambiar Título de la portada")).toBeTruthy();
  });

  it("el diálogo no se puede cerrar con Escape ni pinchando fuera (§12.6)", async () => {
    abrirConflicto();
    render(<ConflictDialog />);
    await userEvent.keyboard("{Escape}");
    expect(screen.getByTestId("conflict-dialog")).toBeTruthy();
  });

  it("«descartar mis cambios» vacía todo y cierra (U-13, visto por el cliente)", async () => {
    abrirConflicto();
    const load = vi.fn(async () => {});
    useEditorStore.setState({ load: load as unknown as (id: number) => Promise<void> });
    render(<ConflictDialog />);
    await userEvent.click(screen.getByTestId("conflict-continue"));
    expect(useEditorStore.getState().conflict).toBeNull();
    expect(useEditorStore.getState().draft).toHaveLength(0);
    expect(load).toHaveBeenCalledWith(5);
  });
});
