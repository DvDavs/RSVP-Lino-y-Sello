// packages/ui/src/componentes/Skeleton.test.tsx — cubre `11 §5` fila «Skeleton»: `aria-busy` en el
// contenedor, `aria-hidden` en las barras, y las dos variantes (bloque, texto).
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "./Skeleton.tsx";

describe("Skeleton", () => {
  it("variante bloque: el contenedor lleva aria-busy y la barra es aria-hidden", () => {
    const { container } = render(<Skeleton />);
    const contenedor = container.firstElementChild as HTMLElement;
    expect(contenedor).toHaveAttribute("aria-busy", "true");
    expect(contenedor).toHaveAttribute("aria-label", "Cargando");
    const barra = contenedor.querySelector(".ui-skeleton");
    expect(barra).toHaveAttribute("aria-hidden", "true");
  });

  it("variante bloque: `alto` y `ancho` viajan como longitudes (número → px)", () => {
    const { container } = render(<Skeleton alto={160} ancho={240} />);
    const contenedor = container.firstElementChild as HTMLElement;
    expect(contenedor.style.width).toBe("240px");
    const barra = contenedor.querySelector(".ui-skeleton") as HTMLElement;
    expect(barra.style.getPropertyValue("--ui-skeleton-alto")).toBe("160px");
  });

  it("variante texto: pinta `lineas` barras y la última al 60 % de ancho", () => {
    const { container } = render(<Skeleton variante="texto" lineas={3} />);
    const contenedor = container.firstElementChild as HTMLElement;
    expect(contenedor).toHaveAttribute("aria-busy", "true");
    const barras = [...contenedor.querySelectorAll(".ui-skeleton--linea")];
    expect(barras).toHaveLength(3);
    for (const barra of barras) expect(barra).toHaveAttribute("aria-hidden", "true");
    expect((barras[0] as HTMLElement).style.getPropertyValue("--ui-skeleton-ancho")).toBe("100%");
    expect((barras[2] as HTMLElement).style.getPropertyValue("--ui-skeleton-ancho")).toBe("60%");
  });

  it("variante texto con una sola línea: no se acorta (no hay «penúltima» que la distinga)", () => {
    const { container } = render(<Skeleton variante="texto" lineas={1} />);
    const barra = container.querySelector(".ui-skeleton--linea") as HTMLElement;
    expect(barra.style.getPropertyValue("--ui-skeleton-ancho")).toBe("100%");
  });

  it("`etiqueta` sustituye el nombre accesible por defecto", () => {
    const { container } = render(<Skeleton etiqueta="Cargando confirmaciones" />);
    expect(container.firstElementChild).toHaveAttribute("aria-label", "Cargando confirmaciones");
  });

  it("sin un solo hex: todo color sale de --ui-*", () => {
    const { container } = render(
      <>
        <Skeleton />
        <Skeleton variante="texto" />
      </>,
    );
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
