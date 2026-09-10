// Tabla.test.tsx — la tabla genérica de la consola: cuatro estados, <caption>/<th scope="col">
// accesibles, y la regla de "cero filas nunca pinta una tabla vacía".
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Tabla, type ColumnaTabla } from "./Tabla.tsx";

interface FilaInvitacion {
  id: string;
  invitacion: string;
  clienta: string;
  estado: string;
}

const columnas: readonly ColumnaTabla<FilaInvitacion>[] = [
  { clave: "invitacion", encabezado: "Invitación" },
  { clave: "clienta", encabezado: "Clienta" },
  { clave: "estado", encabezado: "Estado", alinear: "fin" },
];

const filas: FilaInvitacion[] = [
  { id: "1", invitacion: "Boda Ana y Luis", clienta: "Ana Torres", estado: "Publicada" },
  { id: "2", invitacion: "XV de Sofía", clienta: "M. Cruz", estado: "En edición" },
];

const vacio = {
  ilustracion: "sin-invitaciones" as const,
  titulo: "Todavía no hay invitaciones",
  texto: "Cuando alguien cree una, aparece aquí.",
};

function error() {
  return {
    titulo: "No pudimos cargar las invitaciones",
    cuerpo: "Vuelve a intentarlo en unos segundos.",
    etiquetaReintentar: "Reintentar",
    onReintentar: vi.fn(),
  };
}

function claveFila(fila: FilaInvitacion): string {
  return fila.id;
}

describe("Tabla", () => {
  it("listo: <thead> tiene th scope=col por cada columna", () => {
    render(
      <Tabla
        titulo="Invitaciones"
        columnas={columnas}
        filas={filas}
        estado="listo"
        claveFila={claveFila}
        vacio={vacio}
        error={error()}
        etiquetaCargando="Cargando"
      />,
    );
    for (const columna of columnas) {
      expect(screen.getByRole("columnheader", { name: columna.encabezado }).getAttribute("scope")).toBe("col");
    }
  });

  it("listo: pinta las filas (tabla de escritorio y tarjetas de móvil, ambas con el mismo dato)", () => {
    render(
      <Tabla
        titulo="Invitaciones"
        columnas={columnas}
        filas={filas}
        estado="listo"
        claveFila={claveFila}
        vacio={vacio}
        error={error()}
        etiquetaCargando="Cargando"
      />,
    );
    expect(screen.getAllByText("Boda Ana y Luis").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ana Torres").length).toBeGreaterThan(0);
  });

  it("cargando: pinta filas de Skeleton (ocupado, con nombre accesible), nunca un texto suelto", () => {
    render(
      <Tabla
        titulo="Invitaciones"
        columnas={columnas}
        filas={[]}
        estado="cargando"
        claveFila={claveFila}
        vacio={vacio}
        error={error()}
        etiquetaCargando="Cargando invitaciones"
      />,
    );
    const ocupados = screen.getAllByRole("status", { name: "Cargando invitaciones" });
    expect(ocupados.length).toBeGreaterThan(0);
    expect(ocupados[0]!.getAttribute("aria-busy")).toBe("true");
    // No hay ninguna fila de datos mientras carga.
    expect(screen.queryByText("Boda Ana y Luis")).toBeNull();
  });

  it("vacio: enseña el texto que se le pasó", () => {
    render(
      <Tabla
        titulo="Invitaciones"
        columnas={columnas}
        filas={[]}
        estado="vacio"
        claveFila={claveFila}
        vacio={vacio}
        error={error()}
        etiquetaCargando="Cargando"
      />,
    );
    expect(screen.getByText(vacio.titulo)).toBeTruthy();
    expect(screen.getByText(vacio.texto)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("con 0 filas y estado listo NO pinta la tabla vacía, pinta el vacío", () => {
    render(
      <Tabla
        titulo="Invitaciones"
        columnas={columnas}
        filas={[]}
        estado="listo"
        claveFila={claveFila}
        vacio={vacio}
        error={error()}
        etiquetaCargando="Cargando"
      />,
    );
    expect(screen.getByText(vacio.titulo)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("error: enseña el reintento y lo llama al pulsarlo", async () => {
    const usuario = userEvent.setup();
    const err = error();
    render(
      <Tabla
        titulo="Invitaciones"
        columnas={columnas}
        filas={filas}
        estado="error"
        claveFila={claveFila}
        vacio={vacio}
        error={err}
        etiquetaCargando="Cargando"
      />,
    );
    expect(screen.getByText(err.titulo)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    await usuario.click(screen.getByRole("button", { name: err.etiquetaReintentar }));
    expect(err.onReintentar).toHaveBeenCalledTimes(1);
  });

  it("el desbordamiento horizontal vive en un contenedor propio, con overflow-x-auto y tabIndex 0", () => {
    render(
      <Tabla
        titulo="Invitaciones"
        columnas={columnas}
        filas={filas}
        estado="listo"
        claveFila={claveFila}
        vacio={vacio}
        error={error()}
        etiquetaCargando="Cargando"
      />,
    );
    const tabla = screen.getByRole("table");
    const contenedor = tabla.closest("div");
    expect(contenedor?.className).toMatch(/overflow-x-auto/);
    expect(contenedor?.getAttribute("tabindex")).toBe("0");
  });

  it("tituloVisible=false: el título solo llega por <caption> accesible (sr-only)", () => {
    render(
      <Tabla
        titulo="Invitaciones"
        columnas={columnas}
        filas={filas}
        estado="listo"
        claveFila={claveFila}
        vacio={vacio}
        error={error()}
        etiquetaCargando="Cargando"
      />,
    );
    const caption = screen.getByText("Invitaciones", { selector: "caption" });
    expect(caption.className).toMatch(/sr-only/);
  });
});
