// components/sitio/portada.test.tsx — la portada, bloque a bloque. Lo que se afirma aquí es lo que
// `11 §7` promete de esta pantalla: los textos exactos, los destinos de cada acción y las tres
// reglas que no se pueden romper sin darse cuenta (ni un enlace muerto, ni un testimonio sin
// marcar, ni una foto sin registrar como pendiente).
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CabeceraSitio } from "./CabeceraSitio.tsx";
import { CtaFinal } from "./CtaFinal.tsx";
import { Hero } from "./Hero.tsx";
import { MarcoSitio } from "./MarcoSitio.tsx";
import { PasosComoFunciona } from "./PasosComoFunciona.tsx";
import { PieSitio } from "./PieSitio.tsx";
import { Planes } from "./Planes.tsx";
import { Testimonios } from "./Testimonios.tsx";
import { TIPOS_DE_EVENTO, TiposDeEvento } from "./TiposDeEvento.tsx";
import { es_MX } from "@/lib/i18n";

describe("héroe", () => {
  it("dice en un solo `h1` qué es esto y en cuánto tiempo", () => {
    render(<Hero />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(es_MX.sitio.hero.titulo);
    expect(screen.getByText(es_MX.sitio.hero.eyebrow)).not.toBeNull();
  });

  it("las dos acciones llevan a una ruta real: empezar al asistente, la otra a «Cómo funciona»", () => {
    render(<Hero />);
    expect(screen.getByRole("link", { name: es_MX.sitio.hero.empezar }).getAttribute("href")).toBe("/editor");
    expect(screen.getByRole("link", { name: es_MX.sitio.hero.verComoFunciona }).getAttribute("href")).toBe(
      "#como-funciona",
    );
  });

  it("la foto que falta queda REGISTRADA como pendiente, no disimulada", () => {
    const { container } = render(<Hero />);
    // `data-imagen-pendiente` es lo que enlaza esta pieza con `imagenes-pendientes.md` (11 §3.3).
    expect(container.querySelector('[data-imagen-pendiente="landing-hero"]')).not.toBeNull();
    expect(screen.getByText(es_MX.sitio.hero.fotoPendiente)).not.toBeNull();
  });
});

describe("cómo funciona", () => {
  it("son TRES pasos, numerados y en una lista ordenada de verdad", () => {
    render(<PasosComoFunciona />);
    const lista = screen.getByRole("list");
    expect(lista.tagName).toBe("OL");
    expect(within(lista).getAllByRole("listitem")).toHaveLength(3);
    for (const numero of ["1", "2", "3"]) expect(within(lista).getByText(numero)).not.toBeNull();
  });

  it("cada paso tiene su título y su explicación", () => {
    render(<PasosComoFunciona />);
    for (const paso of [es_MX.sitio.pasos.uno, es_MX.sitio.pasos.dos, es_MX.sitio.pasos.tres]) {
      expect(screen.getByRole("heading", { name: paso.titulo })).not.toBeNull();
      expect(screen.getByText(paso.cuerpo)).not.toBeNull();
    }
  });
});

describe("tipos de evento", () => {
  it("están los siete del catálogo y cada uno lleva su tipo al asistente", () => {
    render(<TiposDeEvento />);
    expect(TIPOS_DE_EVENTO).toHaveLength(7);
    for (const tipo of TIPOS_DE_EVENTO) {
      const enlace = screen.getByRole("link", { name: es_MX.sitio.tipos.empezarCon(tipo.nombre) });
      expect(enlace.getAttribute("href")).toBe(`/editor?tipo=${tipo.slug}`);
      // 2.5.3 «Label in Name»: el nombre accesible contiene el texto visible del cuadro.
      expect(enlace.textContent).toContain(tipo.nombre);
    }
  });
});

describe("testimonios", () => {
  it("los tres van MARCADOS como ejemplo y el bloque lo dice también en prosa", () => {
    render(<Testimonios />);
    expect(screen.getAllByText(es_MX.comun.ejemplo)).toHaveLength(3);
    expect(screen.getByText(es_MX.sitio.testimonios.aviso)).not.toBeNull();
  });

  it("sin retrato real, el avatar cae en iniciales (su estado diseñado, no un hueco)", () => {
    render(<Testimonios />);
    expect(screen.getByText(es_MX.sitio.testimonios.uno.cita)).not.toBeNull();
    expect(screen.queryByRole("img", { name: /Ana Torres/ })).toBeNull();
    expect(screen.getByText("AT")).not.toBeNull();
  });
});

describe("planes y cierre", () => {
  it("planes no inventa precios y manda a la cuenta, que es donde el plan se ve de verdad", () => {
    render(<Planes />);
    expect(screen.getByText(es_MX.sitio.planesSeccion.nota)).not.toBeNull();
    expect(screen.getByRole("link", { name: es_MX.sitio.planesSeccion.accion }).getAttribute("href")).toBe("/acceso");
  });

  it("el cierre tiene UNA acción y va al asistente", () => {
    render(<CtaFinal />);
    const enlaces = screen.getAllByRole("link");
    expect(enlaces).toHaveLength(1);
    expect(enlaces[0].getAttribute("href")).toBe("/editor");
  });
});

describe("shell del sitio", () => {
  it("la cabecera es una región de navegación con nombre y ni un enlace muerto", () => {
    render(<CabeceraSitio />);
    expect(screen.getByRole("navigation", { name: es_MX.sitio.navegacion })).not.toBeNull();
    for (const enlace of screen.getAllByRole("link")) {
      expect(enlace.getAttribute("href")).toMatch(/^[/#]/);
      expect(enlace.getAttribute("href")).not.toBe("#");
    }
  });

  it("el pie repite los destinos y firma el año que se le pasa", () => {
    render(<PieSitio anio={2026} />);
    expect(screen.getByRole("navigation", { name: es_MX.sitio.navegacionPie })).not.toBeNull();
    expect(screen.getByText(es_MX.sitio.pie.derechos(2026))).not.toBeNull();
  });

  it("el marco pone el salto al contenido y un único `main` con ese destino", () => {
    render(
      <MarcoSitio>
        <p>contenido</p>
      </MarcoSitio>,
    );
    const salto = screen.getByRole("link", { name: es_MX.sitio.saltarAlContenido });
    expect(salto.getAttribute("href")).toBe("#contenido");
    expect(screen.getByRole("main").getAttribute("id")).toBe("contenido");
  });
});
