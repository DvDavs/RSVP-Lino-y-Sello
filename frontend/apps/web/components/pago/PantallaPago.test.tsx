// components/pago/PantallaPago.test.tsx — los estados del wireframe de `/pago`
// (`12-producto-completo.md` §5): cancelado (sin `inv`, con `cancelado=1`), esperando→confirmado
// tras sondeos, esperando→tardando tras 60 s, confirmado directo, sin sesión, error+reintentar y
// que `?sesion` sin `pagada` NUNCA se toma por pagado. `obtenerPlanDeInvitacion` va mockeada (mismo
// patrón que `PantallaPrecios.test.tsx` con `@/lib/pagos/cliente`); el fetch real lo cubre
// `lib/pagos/cliente.test.ts`.
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PantallaPago } from "./PantallaPago.tsx";
import { es_MX } from "@/lib/i18n";
import { SessionError } from "@/lib/errors";
import { ErrorDePago } from "@/lib/pagos/tipos";
import type { PlanDeInvitacion } from "@/lib/pagos/tipos";

const parametros = vi.hoisted(() => new URLSearchParams());
vi.mock("next/navigation", () => ({
  useSearchParams: () => parametros,
}));

const obtenerPlanDeInvitacion = vi.hoisted(() => vi.fn());
vi.mock("@/lib/pagos/cliente", () => ({ obtenerPlanDeInvitacion }));

const correoDeSoporteDelEntorno = vi.hoisted(() => vi.fn(() => null as string | null));
vi.mock("@/lib/env", () => ({ correoDeSoporteDelEntorno }));

function setParametros(valores: Record<string, string>) {
  for (const clave of [...parametros.keys()]) parametros.delete(clave);
  for (const [clave, valor] of Object.entries(valores)) parametros.set(clave, valor);
}

const PLAN_NO_PAGADO: PlanDeInvitacion = {
  invitationId: 12,
  pagada: false,
  nombreEvento: null,
  plan: null,
  pagadoEn: null,
  pagos: [],
  pagoEnLinea: true,
};

const PLAN_PAGADO: PlanDeInvitacion = {
  invitationId: 12,
  pagada: true,
  nombreEvento: "Boda de Ana y Luis",
  plan: {
    codigo: "fiesta",
    nombre: "Fiesta",
    precioCentavos: 89900,
    moneda: "MXN",
    invitadosMax: 150,
    incluye: ["Hasta 150 invitados"],
  },
  pagadoEn: "2026-03-03T18:22:10Z",
  pagos: [
    {
      id: 7,
      estado: "PAGADO",
      planCodigo: "fiesta",
      planNombre: "Fiesta",
      importeCentavos: 89900,
      moneda: "MXN",
      creadoEn: "2026-03-03T18:20:00Z",
      pagadoEn: "2026-03-03T18:22:10Z",
      comprobanteUrl: null,
    },
  ],
  pagoEnLinea: true,
};

beforeEach(() => {
  obtenerPlanDeInvitacion.mockReset();
  correoDeSoporteDelEntorno.mockReset();
  correoDeSoporteDelEntorno.mockReturnValue(null);
  setParametros({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe("cancelado", () => {
  it("sin inv en la URL: estado cancelado, sin consultar el backend", async () => {
    render(<PantallaPago />);
    expect(await screen.findByTestId("pago-cancelado")).not.toBeNull();
    expect(screen.getByText(es_MX.sitio.pago.cancelado.titulo)).not.toBeNull();
    expect(obtenerPlanDeInvitacion).not.toHaveBeenCalled();

    const volver = screen.getByTestId("pago-volver-a-intentar");
    expect(volver.getAttribute("href")).toBe("/editor");
  });

  it("con cancelado=1: estado cancelado aunque haya inv, sin consultar el backend", async () => {
    setParametros({ inv: "12", cancelado: "1" });
    render(<PantallaPago />);
    expect(await screen.findByTestId("pago-cancelado")).not.toBeNull();
    expect(obtenerPlanDeInvitacion).not.toHaveBeenCalled();

    const volver = screen.getByTestId("pago-volver-a-intentar");
    expect(volver.getAttribute("href")).toBe("/editor/12/plan");
  });

  it("con inv y sesion, pero pagada=false y SIN sesion en la URL: no hay nada que esperar, se enseña cancelado", async () => {
    setParametros({ inv: "12" });
    obtenerPlanDeInvitacion.mockResolvedValue(PLAN_NO_PAGADO);
    render(<PantallaPago />);
    expect(await screen.findByTestId("pago-cancelado")).not.toBeNull();
  });
});

describe("confirmado directo", () => {
  it("pagada=true de entrada: estado confirmado con el plan y el evento del backend", async () => {
    setParametros({ inv: "12", sesion: "cs_123" });
    obtenerPlanDeInvitacion.mockResolvedValue(PLAN_PAGADO);
    render(<PantallaPago />);

    expect(await screen.findByTestId("pago-confirmado")).not.toBeNull();
    expect(screen.getByText(es_MX.sitio.pago.confirmado.conEvento("Fiesta", "Boda de Ana y Luis"))).not.toBeNull();
    expect(screen.getByText("$899.00")).not.toBeNull();

    expect(screen.getByTestId("pago-ir-invitacion").getAttribute("href")).toBe("/editor/12");
    expect(screen.getByTestId("pago-ver-plan").getAttribute("href")).toBe("/editor/12/plan");
  });

  it("pagada=true sin plan (invitación marcada a mano): «Tu plan está activo», sin reventar", async () => {
    setParametros({ inv: "12", sesion: "cs_123" });
    obtenerPlanDeInvitacion.mockResolvedValue({ ...PLAN_PAGADO, plan: null, pagos: [] });
    render(<PantallaPago />);

    expect(await screen.findByTestId("pago-confirmado")).not.toBeNull();
    expect(screen.getByText(es_MX.sitio.pago.confirmado.sinPlan)).not.toBeNull();
  });

  it("pinta el enlace al comprobante cuando la URL es https", async () => {
    setParametros({ inv: "12", sesion: "cs_123" });
    obtenerPlanDeInvitacion.mockResolvedValue({
      ...PLAN_PAGADO,
      pagos: [{ ...PLAN_PAGADO.pagos[0], comprobanteUrl: "https://pay.stripe.com/receipts/abc" }],
    });
    render(<PantallaPago />);

    const enlace = await screen.findByRole("link", { name: es_MX.sitio.pago.confirmado.verComprobante });
    expect(enlace.getAttribute("href")).toBe("https://pay.stripe.com/receipts/abc");
    expect(enlace.getAttribute("rel")).toContain("noreferrer");
  });

  it("un comprobanteUrl que no es https NO se pinta como enlace (nada de javascript:)", async () => {
    setParametros({ inv: "12", sesion: "cs_123" });
    obtenerPlanDeInvitacion.mockResolvedValue({
      ...PLAN_PAGADO,
      pagos: [{ ...PLAN_PAGADO.pagos[0], comprobanteUrl: "javascript:alert(1)" }],
    });
    render(<PantallaPago />);

    expect(await screen.findByTestId("pago-confirmado")).not.toBeNull();
    expect(screen.queryByRole("link", { name: es_MX.sitio.pago.confirmado.verComprobante })).toBeNull();
  });

  it("mueve el foco al título al confirmarse", async () => {
    setParametros({ inv: "12", sesion: "cs_123" });
    obtenerPlanDeInvitacion.mockResolvedValue(PLAN_PAGADO);
    render(<PantallaPago />);

    await waitFor(() => expect(screen.getByTestId("pago-confirmado")).not.toBeNull());
    const titulo = screen.getByText(es_MX.sitio.pago.confirmado.titulo);
    await waitFor(() => expect(document.activeElement).toBe(titulo));
  });
});

describe("sin sesión (SessionError)", () => {
  it("manda a /acceso?volver=… (el parámetro que AsistenteAcceso lee de verdad) en vez de pintar el pago", async () => {
    setParametros({ inv: "12", sesion: "cs_123" });
    obtenerPlanDeInvitacion.mockRejectedValue(new SessionError(401, ""));
    render(<PantallaPago />);

    expect(await screen.findByTestId("pago-sin-sesion")).not.toBeNull();
    const boton = screen.getByRole("link", { name: es_MX.sitio.pago.sinSesion.entrar });
    expect(boton.getAttribute("href")).toBe(`/acceso?volver=${encodeURIComponent("/pago?inv=12&sesion=cs_123")}`);
  });
});

describe("error + reintentar", () => {
  it("ErrorDePago: «No pudimos consultar tu pago» y Reintentar vuelve a pedir el estado", async () => {
    setParametros({ inv: "12", sesion: "cs_123" });
    obtenerPlanDeInvitacion.mockRejectedValueOnce(new ErrorDePago("PAY_DESCONOCIDO", 500, "fallo"));
    obtenerPlanDeInvitacion.mockResolvedValueOnce(PLAN_PAGADO);
    render(<PantallaPago />);

    expect(await screen.findByTestId("pago-error")).not.toBeNull();
    expect(screen.getByText(es_MX.sitio.pago.error.titulo)).not.toBeNull();

    await userEvent.click(screen.getByTestId("pago-reintentar"));

    expect(await screen.findByTestId("pago-confirmado")).not.toBeNull();
    expect(obtenerPlanDeInvitacion).toHaveBeenCalledTimes(2);
  });
});

describe("esperando (sondeo)", () => {
  it("?sesion sin pagada nunca se toma por pagado: se queda esperando, no confirmado", async () => {
    setParametros({ inv: "12", sesion: "cs_123" });
    obtenerPlanDeInvitacion.mockResolvedValue(PLAN_NO_PAGADO);
    render(<PantallaPago />);

    expect(await screen.findByTestId("pago-esperando")).not.toBeNull();
    expect(screen.queryByTestId("pago-confirmado")).toBeNull();
  });

  it("pasa a confirmado en cuanto un sondeo trae pagada=true", async () => {
    vi.useFakeTimers();
    setParametros({ inv: "12", sesion: "cs_123" });
    obtenerPlanDeInvitacion
      .mockResolvedValueOnce(PLAN_NO_PAGADO)
      .mockResolvedValueOnce(PLAN_NO_PAGADO)
      .mockResolvedValueOnce(PLAN_PAGADO);

    render(<PantallaPago />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId("pago-esperando")).not.toBeNull();

    // dos sondeos (6 s) siguen esperando; el tercero (9 s) trae pagada=true.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000);
    });

    expect(screen.getByTestId("pago-confirmado")).not.toBeNull();
    expect(obtenerPlanDeInvitacion).toHaveBeenCalledTimes(3);
  });

  it("pasado el minuto sin confirmarse, muestra el bloque de «tardando» y deja de sondear", async () => {
    vi.useFakeTimers();
    setParametros({ inv: "12", sesion: "cs_123" });
    correoDeSoporteDelEntorno.mockReturnValue("soporte@linoysello.mx");
    obtenerPlanDeInvitacion.mockResolvedValue(PLAN_NO_PAGADO);

    render(<PantallaPago />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId("pago-esperando")).not.toBeNull();
    expect(screen.queryByTestId("pago-tardando")).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(screen.getByTestId("pago-tardando")).not.toBeNull();
    expect(screen.getByText(es_MX.sitio.pago.tardando.titulo)).not.toBeNull();
    expect(screen.getByText("soporte@linoysello.mx")).not.toBeNull();
    expect(screen.getByTestId("pago-ver-plan").getAttribute("href")).toBe("/editor/12/plan");

    const llamadasTrasTardar = obtenerPlanDeInvitacion.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    // el sondeo se detuvo: ninguna llamada nueva tras marcar "tardando".
    expect(obtenerPlanDeInvitacion.mock.calls.length).toBe(llamadasTrasTardar);
  });

  it("el estado de espera va en una región `aria-live`, no muda", async () => {
    setParametros({ inv: "12", sesion: "cs_123" });
    obtenerPlanDeInvitacion.mockResolvedValue(PLAN_NO_PAGADO);
    render(<PantallaPago />);

    const espera = await screen.findByTestId("pago-esperando");
    const region = espera.querySelector('[aria-live="polite"]');
    expect(region).not.toBeNull();
    expect(region?.textContent).toContain(es_MX.sitio.pago.esperando.cuerpo);
  });

  it("tras agotarse el minuto, «volver a intentarlo» vuelve a preguntar y puede confirmar", async () => {
    vi.useFakeTimers();
    setParametros({ inv: "12", sesion: "cs_123" });
    obtenerPlanDeInvitacion.mockResolvedValue(PLAN_NO_PAGADO);

    render(<PantallaPago />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(screen.getByTestId("pago-tardando")).not.toBeNull();

    obtenerPlanDeInvitacion.mockResolvedValue(PLAN_PAGADO);
    await act(async () => {
      screen.getByTestId("pago-comprobar-de-nuevo").click();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByTestId("pago-confirmado")).not.toBeNull();
  });
});
