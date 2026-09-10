// Tabla.test.tsx — la tabla genérica de la consola: cuatro estados, <caption>/<th scope="col">
// accesibles, y la regla de "cero filas nunca pinta una tabla vacía".
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("el contenedor de scroll horizontal tiene role=group y nombre accesible (aria-prohibited-attr, bitacora/5-E5-F.md §3)", () => {
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
    // `aria-label` en un <div> sin `role` es inválido (rol implícito "generic", que prohíbe
    // nombrarlo) — axe lo marca `aria-prohibited-attr`, serio. Sin `role="group"` aquí,
    // `getByRole("group", ...)` no encontraría nada y esta prueba caería, exactamente lo que
    // debe pasar si el contrato de accesibilidad del componente se rompe en un refactor. No
    // "region": cada `Tabla` vive dentro de un `<section aria-labelledby>` con el MISMO nombre
    // accesible, y un `region` duplicado choca con `landmark-unique` (axe, verificado).
    const grupo = screen.getByRole("group", { name: "Invitaciones" });
    expect(grupo.getAttribute("tabindex")).toBe("0");
    expect(grupo.contains(screen.getByRole("table"))).toBe(true);
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

describe("Tabla — pista de desborde horizontal (defecto 3 de 5-E5-J)", () => {
  // AVISO DE ALCANCE, léelo antes de fiarte de estas dos pruebas: jsdom NO CALCULA LAYOUT.
  // `scrollWidth`, `clientWidth` y `getBoundingClientRect()` valen 0 siempre, así que aquí es
  // IMPOSIBLE comprobar el defecto de verdad («a 768 px la columna Acciones queda fuera de vista»):
  // eso solo se ve con un motor que maquete, es decir, en el e2e o en una captura. Lo que estas dos
  // pruebas sí cubren es el MECANISMO: dado un contenedor que declara desborde, el velo aparece; sin
  // desborde, no. Si el velo dejara de pintarse o de medirse, caen. Si el ancho de las columnas
  // creciera hasta desbordar a 768 px otra vez, NO caen — para eso hace falta la comprobación en
  // navegador que propone `bitacora/5-E5-J.md §«qué no es cazable en jsdom»`.
  function fingirDesborde(scrollWidth: number, clientWidth: number): void {
    for (const propiedad of ["scrollWidth", "clientWidth"] as const) {
      Object.defineProperty(HTMLElement.prototype, propiedad, {
        configurable: true,
        get(this: HTMLElement) {
          return this.getAttribute("role") === "group" ? (propiedad === "scrollWidth" ? scrollWidth : clientWidth) : 0;
        },
      });
    }
  }

  // Se sobreescribe `HTMLElement.prototype`: hay que devolverlo, o la siguiente prueba del fichero
  // heredaría el desborde fingido.
  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, "scrollWidth");
    Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
  });

  function pintar() {
    return render(
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
  }

  it("sin desborde no hay velo: la pista no es un adorno permanente", () => {
    fingirDesborde(600, 600);
    pintar();
    expect(screen.queryByTestId("tabla-desborde-derecha")).toBeNull();
  });

  it("con desborde aparece el velo, decorativo y fuera del árbol accesible", () => {
    fingirDesborde(1200, 600);
    pintar();
    const velo = screen.getByTestId("tabla-desborde-derecha");
    expect(velo.getAttribute("aria-hidden")).toBe("true");
    expect(velo.className).toMatch(/pointer-events-none/);

    // Lo que NO puede cambiar (arreglo de accesibilidad de 5-E5-H): el contenedor desplazable sigue
    // siendo el mismo `role="group"` con nombre accesible y alcanzable por teclado, y el desborde
    // sigue viviendo dentro de la tabla — la página nunca se desplaza en horizontal.
    const grupo = screen.getByRole("group", { name: "Invitaciones" });
    expect(grupo.getAttribute("tabindex")).toBe("0");
    expect(grupo.className).toMatch(/overflow-x-auto/);
    expect(grupo.contains(velo)).toBe(false);
    expect(grupo.parentElement?.className).toMatch(/relative/);
  });
});
