// components/precios/PantallaPrecios.test.tsx — los cinco estados del wireframe de `/precios`
// (`12-producto-completo.md` §4): con catálogo, vacío, error + reintentar, sin pago en línea y con
// `?inv=`. El fetch real lo cubre `lib/pagos/cliente.test.ts`; aquí se mockea esa función (mismo
// patrón que `AsistenteAcceso.test.tsx` con `@/lib/api-client`) para probar lo que ve la clienta.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PantallaPrecios } from "./PantallaPrecios.tsx";
import { es_MX } from "@/lib/i18n";
import { ErrorDePago } from "@/lib/pagos/tipos";
import type { CatalogoDePlanes } from "@/lib/pagos/tipos";

const parametros = vi.hoisted(() => new URLSearchParams());
vi.mock("next/navigation", () => ({
  useSearchParams: () => parametros,
}));

const obtenerCatalogo = vi.hoisted(() => vi.fn());
vi.mock("@/lib/pagos/cliente", () => ({ obtenerCatalogo }));

const pagoEnLineaDisponible = vi.hoisted(() => vi.fn(() => true));
vi.mock("@/lib/env", () => ({ pagoEnLineaDisponible }));

const CATALOGO: CatalogoDePlanes = {
  moneda: "MXN",
  pagoEnLinea: true,
  planes: [
    {
      codigo: "sencillo",
      nombre: "Sencillo",
      descripcion: "",
      precioCentavos: 49900,
      moneda: "MXN",
      invitadosMax: 60,
      incluye: ["Hasta 60 invitados", "Confirmaciones"],
      recomendado: false,
      orden: 10,
    },
    {
      codigo: "fiesta",
      nombre: "Fiesta",
      descripcion: "",
      precioCentavos: 89900,
      moneda: "MXN",
      invitadosMax: 150,
      incluye: ["Hasta 150 invitados", "Galería de fotos"],
      recomendado: true,
      orden: 20,
    },
    {
      codigo: "grande",
      nombre: "Grande",
      descripcion: "",
      precioCentavos: 149900,
      moneda: "MXN",
      invitadosMax: null,
      incluye: ["Sin límite de invitados", "Galería y música"],
      recomendado: false,
      orden: 30,
    },
  ],
};

beforeEach(() => {
  obtenerCatalogo.mockReset();
  pagoEnLineaDisponible.mockReset();
  pagoEnLineaDisponible.mockReturnValue(true);
  for (const clave of [...parametros.keys()]) parametros.delete(clave);
});

describe("con catálogo", () => {
  it("pinta las tres tarjetas, el precio del backend y la recomendada primero con su insignia", async () => {
    obtenerCatalogo.mockResolvedValue(CATALOGO);
    render(<PantallaPrecios />);

    await waitFor(() => expect(screen.getByTestId("precios-catalogo")).not.toBeNull());

    expect(screen.getByTestId("precios-plan-sencillo")).not.toBeNull();
    expect(screen.getByTestId("precios-plan-fiesta")).not.toBeNull();
    expect(screen.getByTestId("precios-plan-grande")).not.toBeNull();
    expect(screen.getByText("$899.00")).not.toBeNull();
    expect(screen.getAllByText(es_MX.sitio.precios.pagoUnico).length).toBe(3);
    expect(screen.getByText(es_MX.sitio.precios.recomendado)).not.toBeNull();

    // la recomendada (Fiesta) va primera pese a no ser la de menor `orden`.
    const codigos = screen.getAllByTestId(/^precios-plan-/).map((n) => n.getAttribute("data-testid"));
    expect(codigos[0]).toBe("precios-plan-fiesta");
  });

  it("cada botón «Elegir» lleva su propio data-testid", async () => {
    obtenerCatalogo.mockResolvedValue(CATALOGO);
    render(<PantallaPrecios />);
    await waitFor(() => expect(screen.getByTestId("precios-elegir-fiesta")).not.toBeNull());
    expect(screen.getByTestId("precios-elegir-sencillo")).not.toBeNull();
    expect(screen.getByTestId("precios-elegir-grande")).not.toBeNull();
  });
});

describe("sin invitación en la URL (?inv ausente)", () => {
  it("el botón dice «Empieza gratis» y lleva a /acceso, nunca abre un pago sin invitación", async () => {
    obtenerCatalogo.mockResolvedValue(CATALOGO);
    render(<PantallaPrecios />);
    await waitFor(() => expect(screen.getByTestId("precios-elegir-fiesta")).not.toBeNull());

    const boton = screen.getByTestId("precios-elegir-fiesta");
    expect(boton.textContent).toBe(es_MX.sitio.precios.empezarGratis);
    expect(boton.getAttribute("href")).toBe("/acceso?volver=%2Feditor");
    expect(screen.getAllByText(es_MX.sitio.precios.notaEmpezarGratis).length).toBe(3);
  });
});

describe("con ?inv=<id> (puerta de publicación)", () => {
  it("el botón lleva a /editor/<id>/plan?plan=<codigo>, con el texto «Elegir <plan>»", async () => {
    parametros.set("inv", "12");
    obtenerCatalogo.mockResolvedValue(CATALOGO);
    render(<PantallaPrecios />);
    await waitFor(() => expect(screen.getByTestId("precios-elegir-fiesta")).not.toBeNull());

    const boton = screen.getByTestId("precios-elegir-fiesta");
    expect(boton.textContent).toBe(es_MX.sitio.precios.elegir("Fiesta"));
    expect(boton.getAttribute("href")).toBe("/editor/12/plan?plan=fiesta");
  });
});

describe("sin pago en línea", () => {
  it("catalogo.pagoEnLinea=false: nota honesta y el botón lleva al contacto, aunque haya ?inv", async () => {
    parametros.set("inv", "12");
    obtenerCatalogo.mockResolvedValue({ ...CATALOGO, pagoEnLinea: false });
    render(<PantallaPrecios />);
    await waitFor(() => expect(screen.getByTestId("precios-elegir-fiesta")).not.toBeNull());

    expect(screen.getAllByText(es_MX.sitio.precios.pagoNoDisponible).length).toBe(3);
    expect(screen.getByTestId("precios-elegir-fiesta").getAttribute("href")).toBe("#contacto");
  });

  it("pagoEnLineaDisponible()=false (falta la clave publicable) también apaga el pago", async () => {
    pagoEnLineaDisponible.mockReturnValue(false);
    obtenerCatalogo.mockResolvedValue(CATALOGO);
    render(<PantallaPrecios />);
    await waitFor(() => expect(screen.getByTestId("precios-elegir-fiesta")).not.toBeNull());

    expect(screen.getAllByText(es_MX.sitio.precios.pagoNoDisponible).length).toBe(3);
    expect(screen.getByTestId("precios-elegir-fiesta").getAttribute("href")).toBe("#contacto");
  });
});

describe("vacío (catálogo sin planes)", () => {
  it("no pinta una tabla vacía: solo el bloque de contacto, sin botón de reintentar", async () => {
    obtenerCatalogo.mockResolvedValue({ moneda: "MXN", pagoEnLinea: true, planes: [] });
    render(<PantallaPrecios />);

    await waitFor(() => expect(screen.getByTestId("precios-vacio")).not.toBeNull());
    expect(screen.getByText(es_MX.sitio.precios.vacio.titulo)).not.toBeNull();
    expect(screen.queryByTestId("precios-reintentar")).toBeNull();
    expect(screen.queryByTestId("precios-catalogo")).toBeNull();
  });
});

describe("error", () => {
  it("misma salida que el vacío, más un Reintentar que vuelve a pedir el catálogo", async () => {
    obtenerCatalogo.mockRejectedValueOnce(new ErrorDePago("PAY_DESCONOCIDO", 500, "fallo de red"));
    obtenerCatalogo.mockResolvedValueOnce(CATALOGO);
    render(<PantallaPrecios />);

    await waitFor(() => expect(screen.getByTestId("precios-vacio")).not.toBeNull());
    expect(screen.getByTestId("precios-reintentar")).not.toBeNull();

    await userEvent.click(screen.getByTestId("precios-reintentar"));

    await waitFor(() => expect(screen.getByTestId("precios-catalogo")).not.toBeNull());
    expect(obtenerCatalogo).toHaveBeenCalledTimes(2);
  });
});
