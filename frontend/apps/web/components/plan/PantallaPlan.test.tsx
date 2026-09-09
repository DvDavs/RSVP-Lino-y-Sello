// components/plan/PantallaPlan.test.tsx — los estados del wireframe de `/editor/[invitationId]/plan`
// (`12-producto-completo.md` §3): carga, error+reintentar, sin sesión (nunca entró / caducada),
// sin pago (oferta, selección, pagar y publicar, PAY_NOT_CONFIGURED, sin pago en línea), con pago
// (con y sin `plan`), historial (vacío y con filas). El fetch real lo cubre `lib/pagos/cliente.ts`
// (de B1); aquí se mockea ese módulo, igual que `PantallaPrecios.test.tsx`.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PantallaPlan } from "./PantallaPlan.tsx";
import { clearAuthToken, setAuthToken } from "@/lib/api-client";
import { es_MX } from "@/lib/i18n";
import { ErrorDePago } from "@/lib/pagos/tipos";
import type { CatalogoDePlanes, PlanDeInvitacion } from "@/lib/pagos/tipos";

const { SessionError } = await import("@/lib/errors");

const parametros = vi.hoisted(() => new URLSearchParams());
vi.mock("next/navigation", () => ({
  useSearchParams: () => parametros,
}));

const obtenerPlanDeInvitacion = vi.hoisted(() => vi.fn());
const obtenerCatalogo = vi.hoisted(() => vi.fn());
const crearCheckout = vi.hoisted(() => vi.fn());
vi.mock("@/lib/pagos/cliente", () => ({ obtenerPlanDeInvitacion, obtenerCatalogo, crearCheckout }));

const pagoEnLineaDisponible = vi.hoisted(() => vi.fn(() => true));
const correoDeSoporteDelEntorno = vi.hoisted(() => vi.fn((): string | null => "soporte@linoysello.mx"));
vi.mock("@/lib/env", () => ({ pagoEnLineaDisponible, correoDeSoporteDelEntorno }));

const CATALOGO: CatalogoDePlanes = {
  moneda: "MXN",
  pagoEnLinea: true,
  planes: [
    { codigo: "sencillo", nombre: "Sencillo", descripcion: "", precioCentavos: 49900, moneda: "MXN", invitadosMax: 60, incluye: ["Hasta 60 invitados"], recomendado: false, orden: 10 },
    { codigo: "fiesta", nombre: "Fiesta", descripcion: "", precioCentavos: 89900, moneda: "MXN", invitadosMax: 150, incluye: ["Hasta 150 invitados", "Enlace propio"], recomendado: true, orden: 20 },
    { codigo: "grande", nombre: "Grande", descripcion: "", precioCentavos: 149900, moneda: "MXN", invitadosMax: null, incluye: ["Sin límite"], recomendado: false, orden: 30 },
  ],
};

function planSinPagar(pagos: PlanDeInvitacion["pagos"] = []): PlanDeInvitacion {
  return { invitationId: 12, pagada: false, nombreEvento: "Boda de Ana y Luis", plan: null, pagadoEn: null, pagos, pagoEnLinea: true };
}

function planPagado(over: Partial<PlanDeInvitacion> = {}): PlanDeInvitacion {
  return {
    invitationId: 12,
    pagada: true,
    nombreEvento: "Boda de Ana y Luis",
    plan: { codigo: "fiesta", nombre: "Fiesta", precioCentavos: 89900, moneda: "MXN", invitadosMax: 150, incluye: ["Hasta 150 invitados", "Enlace propio"] },
    pagadoEn: "2026-03-03T18:22:10Z",
    pagos: [
      { id: 7, estado: "PAGADO", planCodigo: "fiesta", planNombre: "Fiesta", importeCentavos: 89900, moneda: "MXN", creadoEn: "2026-03-03T18:20:00Z", pagadoEn: "2026-03-03T18:22:10Z", comprobanteUrl: "https://stripe.example/recibo/1" },
    ],
    pagoEnLinea: true,
    ...over,
  };
}

beforeEach(() => {
  obtenerPlanDeInvitacion.mockReset();
  obtenerCatalogo.mockReset();
  crearCheckout.mockReset();
  pagoEnLineaDisponible.mockReset();
  pagoEnLineaDisponible.mockReturnValue(true);
  correoDeSoporteDelEntorno.mockReset();
  correoDeSoporteDelEntorno.mockReturnValue("soporte@linoysello.mx");
  obtenerCatalogo.mockResolvedValue(CATALOGO);
  for (const clave of [...parametros.keys()]) parametros.delete(clave);
  clearAuthToken();
  vi.stubGlobal("location", { ...window.location, assign: vi.fn() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("carga", () => {
  it("enseña el skeleton mientras la petición no responde", async () => {
    obtenerPlanDeInvitacion.mockReturnValue(new Promise(() => {}));
    render(<PantallaPlan invitationId="12" />);
    expect(screen.getByTestId("plan-cargando")).not.toBeNull();
  });
});

describe("error", () => {
  it("tarjeta con Reintentar y el correo de soporte; reintentar vuelve a pedir el plan", async () => {
    const usuario = userEvent.setup();
    obtenerPlanDeInvitacion.mockRejectedValueOnce(new Error("fallo de red")).mockResolvedValueOnce(planSinPagar());
    render(<PantallaPlan invitationId="12" />);

    await waitFor(() => expect(screen.getByTestId("plan-error")).not.toBeNull());
    expect(screen.getByText(/soporte@linoysello\.mx/)).not.toBeNull();

    await usuario.click(screen.getByTestId("plan-reintentar"));
    await waitFor(() => expect(screen.getByTestId("plan-sin-pago")).not.toBeNull());
    expect(obtenerPlanDeInvitacion).toHaveBeenCalledTimes(2);
  });

  it("sin correo de soporte, remite a /ayuda", async () => {
    correoDeSoporteDelEntorno.mockReturnValue(null);
    obtenerPlanDeInvitacion.mockRejectedValue(new Error("fallo de red"));
    render(<PantallaPlan invitationId="12" />);
    await waitFor(() => expect(screen.getByTestId("plan-error")).not.toBeNull());
    const enlace = screen.getByText(es_MX.panel.plan.error.verAyuda);
    expect(enlace.getAttribute("href")).toBe("/ayuda");
  });
});

describe("sin sesión", () => {
  it("nunca entró: el mensaje es «hay que entrar» y el enlace vuelve a esta pantalla", async () => {
    obtenerPlanDeInvitacion.mockRejectedValue(new SessionError(401, ""));
    render(<PantallaPlan invitationId="12" />);

    await waitFor(() => expect(screen.getByTestId("plan-ir-a-acceso")).not.toBeNull());
    expect(screen.getByText(es_MX.panel.plan.sinSesion.hayQueEntrar)).not.toBeNull();
    const enlace = screen.getByTestId("plan-ir-a-acceso");
    expect(enlace.getAttribute("href")).toBe(`/acceso?volver=${encodeURIComponent("/editor/12/plan")}`);
  });

  it("sesión caducada (había token): el mensaje es «tu sesión terminó», motivo=sesion y se limpia el token", async () => {
    setAuthToken("token-de-prueba");
    obtenerPlanDeInvitacion.mockRejectedValue(new SessionError(401, ""));
    render(<PantallaPlan invitationId="12" />);

    await waitFor(() => expect(screen.getByTestId("plan-ir-a-acceso")).not.toBeNull());
    expect(screen.getByText(es_MX.panel.plan.sinSesion.sesionTerminada)).not.toBeNull();
    expect(screen.getByTestId("plan-ir-a-acceso").getAttribute("href")).toContain("&motivo=sesion");

    const { getAuthToken } = await import("@/lib/api-client");
    expect(getAuthToken()).toBeNull();
  });
});

describe("sin pago — la oferta", () => {
  it("pinta el estado vacío con la recomendada preseleccionada, y pagar llama a crearCheckout y redirige", async () => {
    const usuario = userEvent.setup();
    obtenerPlanDeInvitacion.mockResolvedValue(planSinPagar());
    crearCheckout.mockResolvedValue({ checkoutUrl: "https://checkout.stripe.com/cs_test_x", sessionId: "cs_test_x", paymentId: 1 });

    render(<PantallaPlan invitationId="12" />);
    await waitFor(() => expect(screen.getByTestId("plan-sin-pago")).not.toBeNull());

    expect(screen.getByTestId("plan-opcion-sencillo")).not.toBeNull();
    expect(screen.getByTestId("plan-opcion-fiesta")).not.toBeNull();
    expect(screen.getByTestId("plan-opcion-grande")).not.toBeNull();
    expect(screen.getByText("$899.00")).not.toBeNull();

    await usuario.click(screen.getByTestId("plan-pagar"));
    await waitFor(() => expect(crearCheckout).toHaveBeenCalledWith(12, "fiesta"));
    await waitFor(() => expect(window.location.assign).toHaveBeenCalledWith("https://checkout.stripe.com/cs_test_x"));
  });

  it("?plan=<codigo> preselecciona esa opción en vez de la recomendada", async () => {
    parametros.set("plan", "grande");
    obtenerPlanDeInvitacion.mockResolvedValue(planSinPagar());
    crearCheckout.mockResolvedValue({ checkoutUrl: "https://checkout.stripe.com/cs_grande", sessionId: "cs_grande", paymentId: 2 });

    const usuario = userEvent.setup();
    render(<PantallaPlan invitationId="12" />);
    await waitFor(() => expect(screen.getByTestId("plan-pagar")).not.toBeNull());

    await usuario.click(screen.getByTestId("plan-pagar"));
    await waitFor(() => expect(crearCheckout).toHaveBeenCalledWith(12, "grande"));
  });

  it("PAY_NOT_CONFIGURED al pagar: nunca un botón muerto, se pinta la nota honesta", async () => {
    const usuario = userEvent.setup();
    obtenerPlanDeInvitacion.mockResolvedValue(planSinPagar());
    crearCheckout.mockRejectedValue(new ErrorDePago("PAY_NOT_CONFIGURED", 503, "sin clave de Stripe"));

    render(<PantallaPlan invitationId="12" />);
    await waitFor(() => expect(screen.getByTestId("plan-pagar")).not.toBeNull());

    await usuario.click(screen.getByTestId("plan-pagar"));
    await waitFor(() => expect(screen.getByTestId("plan-sin-pago-en-linea")).not.toBeNull());
    expect(screen.queryByTestId("plan-pagar")).toBeNull();
  });

  it("sin pago en línea desde el inicio (catálogo o entorno): no hay botón de pagar", async () => {
    obtenerPlanDeInvitacion.mockResolvedValue(planSinPagar());
    obtenerCatalogo.mockResolvedValue({ ...CATALOGO, pagoEnLinea: false });

    render(<PantallaPlan invitationId="12" />);
    await waitFor(() => expect(screen.getByTestId("plan-sin-pago-en-linea")).not.toBeNull());
    expect(screen.queryByTestId("plan-pagar")).toBeNull();
    expect(screen.getByTestId("plan-ver-planes")).not.toBeNull();
  });

  it("pagoEnLineaDisponible()=false (falta la clave publicable) también apaga el pago", async () => {
    pagoEnLineaDisponible.mockReturnValue(false);
    obtenerPlanDeInvitacion.mockResolvedValue(planSinPagar());

    render(<PantallaPlan invitationId="12" />);
    await waitFor(() => expect(screen.getByTestId("plan-sin-pago-en-linea")).not.toBeNull());
    expect(screen.queryByTestId("plan-pagar")).toBeNull();
  });
});

describe("con pago", () => {
  it("tarjeta con insignia «Pagado», fecha e importe, y el comprobante cuando existe", async () => {
    obtenerPlanDeInvitacion.mockResolvedValue(planPagado());
    render(<PantallaPlan invitationId="12" />);

    await waitFor(() => expect(screen.getByTestId("plan-con-pago")).not.toBeNull());
    const tarjeta = within(screen.getByTestId("plan-con-pago"));
    expect(tarjeta.getByText("Plan Fiesta")).not.toBeNull();
    expect(tarjeta.getByText(es_MX.panel.plan.pagado.badgePagado)).not.toBeNull();
    expect(tarjeta.getByText(/3 de marzo de 2026/)).not.toBeNull();
    expect(tarjeta.getByText(/\$899\.00/)).not.toBeNull();

    const comprobante = screen.getByTestId("plan-ver-comprobante");
    expect(comprobante.getAttribute("href")).toBe("https://stripe.example/recibo/1");
    expect(comprobante.getAttribute("target")).toBe("_blank");

    expect(screen.getByTestId("plan-ir-al-editor").getAttribute("href")).toBe("/editor/12");
  });

  it("plan=null (marcada a mano): «Plan activo», sin importe, sin comprobante", async () => {
    obtenerPlanDeInvitacion.mockResolvedValue(planPagado({ plan: null, pagos: [] }));
    render(<PantallaPlan invitationId="12" />);

    await waitFor(() => expect(screen.getByTestId("plan-con-pago")).not.toBeNull());
    expect(screen.getByText(es_MX.panel.plan.pagado.planActivo)).not.toBeNull();
    expect(screen.getByText(es_MX.panel.plan.pagado.sinDatosDePlan)).not.toBeNull();
    expect(screen.queryByTestId("plan-ver-comprobante")).toBeNull();
  });
});

describe("historial de pagos", () => {
  it("vacío: «Todavía no hay pagos registrados.»", async () => {
    obtenerPlanDeInvitacion.mockResolvedValue(planSinPagar([]));
    render(<PantallaPlan invitationId="12" />);
    await waitFor(() => expect(screen.getByTestId("plan-historial")).not.toBeNull());
    expect(screen.getByTestId("plan-historial-vacio").textContent).toBe(es_MX.panel.plan.historial.vacio);
  });

  it("con filas: fecha, plan, importe y Badge por estado, aunque la invitación no esté pagada", async () => {
    obtenerPlanDeInvitacion.mockResolvedValue(
      planSinPagar([
        { id: 1, estado: "FALLIDO", planCodigo: "fiesta", planNombre: "Fiesta", importeCentavos: 89900, moneda: "MXN", creadoEn: "2026-02-01T10:00:00Z", pagadoEn: null, comprobanteUrl: null },
      ]),
    );
    render(<PantallaPlan invitationId="12" />);
    await waitFor(() => expect(screen.getByTestId("plan-historial-fila-1")).not.toBeNull());
    const fila = screen.getByTestId("plan-historial-fila-1");
    expect(within(fila).getByText("Fiesta")).not.toBeNull();
    expect(within(fila).getByText(es_MX.panel.plan.historial.estados.FALLIDO)).not.toBeNull();
    expect(screen.queryByTestId("plan-historial-vacio")).toBeNull();
  });
});
