// app/(public)/r/[token]/PantallaInvitado.test.tsx — los cuatro estados del wireframe (§B3.1):
// sin responder, ya respondió (en los dos sentidos), enlace que no resuelve y convocatoria
// cerrada. Además: los cupos no permitidos no se pintan, un contador nunca pasa del cupo asignado,
// y — la prueba que vigila la regla de seguridad 1 — el HTML renderizado en SERVIDOR no lleva el
// nombre del invitado.
import { renderToString } from "react-dom/server";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComposedDocument } from "@invitaciones/schema";
import { ApiError } from "@/lib/invitados/rsvp";
import type { RsvpEstado } from "@/lib/invitados/rsvp";
import { PantallaInvitado } from "./PantallaInvitado";

vi.mock("@/lib/invitados/rsvp", async () => {
  const real = await vi.importActual<typeof import("@/lib/invitados/rsvp")>("@/lib/invitados/rsvp");
  return { ...real, obtenerRsvp: vi.fn(), enviarRsvp: vi.fn() };
});
vi.mock("./renderPublico", () => ({ obtenerRenderPublico: vi.fn() }));
vi.mock("../../_componentes/RenderInvitacion", () => ({
  RenderInvitacion: () => <div data-testid="invitacion-render">invitación</div>,
}));

import { obtenerRsvp, enviarRsvp } from "@/lib/invitados/rsvp";
import { obtenerRenderPublico } from "./renderPublico";

const obtenerRsvpMock = vi.mocked(obtenerRsvp);
const enviarRsvpMock = vi.mocked(enviarRsvp);
const getPublicRenderMock = vi.mocked(obtenerRenderPublico);

const NOMBRE_INVITADO = "María Fernanda Cruz";

function estadoPendiente(extra: Partial<RsvpEstado["guest"]> = {}): RsvpEstado {
  return {
    guest: {
      fullName: NOMBRE_INVITADO,
      adults: 2,
      children: 1,
      young: 0,
      adultsConfirmed: 0,
      childrenConfirmed: 0,
      youngConfirmed: 0,
      status: "PENDING",
      hasEmail: true,
      ...extra,
    },
    event: { publicToken: "pub_abc123", childrenAllowed: true, youngAllowed: false, closed: false },
  };
}

function composedFalso(): ComposedDocument {
  return {
    theme: {
      tokens: { bg: "#FFF", surface: "#FFF", ink: "#000", accent: "#900", accentInk: "#FFF", muted: "#999" },
      fonts: { heading: { family: "Georgia", weights: [400], source: "google" }, body: { family: "Arial", weights: [400], source: "google" } },
      paletteId: "blush",
      fontSetId: "serif-elegante",
    },
    locale: "es-MX",
    sections: [],
    template: { slug: "boda-clasica", version: "1.0.0" },
    composedVersion: 1,
  } as unknown as ComposedDocument;
}

beforeEach(() => {
  vi.restoreAllMocks();
  getPublicRenderMock.mockResolvedValue({
    status: "ok",
    data: { composed: composedFalso(), publishedAt: "2026-01-01T00:00:00Z", contentHash: "sha256:abc" },
    etag: null,
  });
});

describe("regla de seguridad 1 — nada personal en el HTML de servidor", () => {
  it("renderToString del primer render (antes de cualquier useEffect) no contiene el nombre del invitado ni el token", () => {
    obtenerRsvpMock.mockResolvedValue(estadoPendiente());
    const html = renderToString(<PantallaInvitado token="token-secreto-del-invitado" />);

    expect(html).not.toContain(NOMBRE_INVITADO);
    expect(html).not.toContain("token-secreto-del-invitado");
    // El primer render SÍ es observable: es el estado "cargando", genérico.
    expect(html).toContain("Cargando tu invitación");
  });
});

describe("estado 1 — sin responder", () => {
  it("pinta la tarjeta de identidad y la decisión tras resolver el token", async () => {
    obtenerRsvpMock.mockResolvedValue(estadoPendiente());
    render(<PantallaInvitado token="tok-1" />);

    expect(screen.getByRole("status").textContent).toMatch(/cargando/i);

    expect(await screen.findByRole("heading", { level: 1, name: NOMBRE_INVITADO })).toBeTruthy();
    expect(screen.getByText(/te apartamos 2 lugares de adulto y 1 de niño/i)).toBeTruthy();
    expect(screen.getByRole("radiogroup")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /sí, ahí estaré/i })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /no podré ir/i })).toBeTruthy();
  });

  it("NO pinta el contador de niños si el invitado no tiene cupo, aunque el evento los admita", async () => {
    obtenerRsvpMock.mockResolvedValue(estadoPendiente({ children: 0 }));
    render(<PantallaInvitado token="tok-2" />);
    await screen.findByRole("heading", { level: 1, name: NOMBRE_INVITADO });

    expect(screen.getByText(/adultos/i)).toBeTruthy();
    expect(screen.queryByText("Niños")).toBeNull();
  });

  it("NO pinta el contador de jóvenes cuando el evento no los admite (aunque el invitado tuviera cupo)", async () => {
    // `youngAllowed:false` en el evento, aunque el invitado individual tuviera `young > 0` — el
    // caso real es que ambos coinciden, pero la regla de la pantalla es la del EVENTO.
    obtenerRsvpMock.mockResolvedValue({
      ...estadoPendiente({ young: 1 }),
      event: { publicToken: "pub_abc123", childrenAllowed: true, youngAllowed: false, closed: false },
    });
    render(<PantallaInvitado token="tok-3" />);
    await screen.findByRole("heading", { level: 1, name: NOMBRE_INVITADO });

    expect(screen.queryByText("Jóvenes")).toBeNull();
  });

  it("un contador nunca pasa del cupo asignado, ni por debajo de cero", async () => {
    const usuario = userEvent.setup();
    obtenerRsvpMock.mockResolvedValue(estadoPendiente({ adults: 2 }));
    render(<PantallaInvitado token="tok-4" />);
    await screen.findByRole("heading", { level: 1, name: NOMBRE_INVITADO });

    const filaAdultos = screen.getByRole("group", { name: "Adultos" });
    const mas = within(filaAdultos).getByRole("button", { name: /uno más/i });
    const menos = within(filaAdultos).getByRole("button", { name: /uno menos/i });

    // Ya arranca en 2 (el cupo completo, PENDING): un "+" más no debe subir a 3.
    await usuario.click(mas);
    expect(within(filaAdultos).getByText("2")).toBeTruthy();
    expect((mas as HTMLButtonElement).disabled).toBe(true);

    await usuario.click(menos);
    await usuario.click(menos);
    expect(within(filaAdultos).getByText("0")).toBeTruthy();
    expect((menos as HTMLButtonElement).disabled).toBe(true);
  });

  it("el botón de confirmar se deshabilita si los tres cupos quedan en cero", async () => {
    const usuario = userEvent.setup();
    obtenerRsvpMock.mockResolvedValue(estadoPendiente({ adults: 1, children: 0 }));
    render(<PantallaInvitado token="tok-5" />);
    await screen.findByRole("heading", { level: 1, name: NOMBRE_INVITADO });

    const filaAdultos = screen.getByRole("group", { name: "Adultos" });
    await usuario.click(within(filaAdultos).getByRole("button", { name: /uno menos/i }));

    const boton = screen.getByRole("button", { name: /confirmar mi asistencia/i }) as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
  });
});

describe("estado 2 — ya respondió, en los dos sentidos", () => {
  it("confirmar muestra el resumen; «Cambiar mi respuesta» vuelve al formulario; declinar y volver a confirmar también funciona", async () => {
    const usuario = userEvent.setup();
    obtenerRsvpMock.mockResolvedValue(estadoPendiente());
    render(<PantallaInvitado token="tok-6" />);
    await screen.findByRole("heading", { level: 1, name: NOMBRE_INVITADO });

    enviarRsvpMock.mockResolvedValueOnce(
      estadoPendiente({ status: "CONFIRMED", adultsConfirmed: 2, childrenConfirmed: 1 }),
    );
    await usuario.click(screen.getByRole("button", { name: /confirmar mi asistencia/i }));

    expect(await screen.findByText(/quedaste confirmada/i)).toBeTruthy();
    expect(screen.getByText(/apartamos 2 adultos y 1 niño a tu nombre/i)).toBeTruthy();

    // Cambiar de opinión: declinar.
    await usuario.click(screen.getByRole("button", { name: /cambiar mi respuesta/i }));
    expect(await screen.findByRole("radiogroup")).toBeTruthy();

    enviarRsvpMock.mockResolvedValueOnce(estadoPendiente({ status: "DECLINED" }));
    await usuario.click(screen.getByRole("radio", { name: /no podré ir/i }));
    await usuario.click(screen.getByRole("button", { name: /avisar que no podré ir/i }));

    expect(await screen.findByText(/avisamos que no podrás ir/i)).toBeTruthy();

    // Y volver a confirmar una segunda vez — "cuantas veces haga falta". Al reabrir el formulario
    // tras declinar, la decisión pre-cargada es la ÚLTIMA respuesta real ("No podré ir"): el
    // formulario de edición siempre refleja lo que el invitado contestó, igual que arriba (al
    // reabrir desde "Confirmado" ya venía marcado "Sí"). Por eso aquí se selecciona "Sí" a mano
    // antes de enviar, igual que arriba se seleccionó "No" a mano.
    await usuario.click(screen.getByRole("button", { name: /cambiar mi respuesta/i }));
    await usuario.click(await screen.findByRole("radio", { name: /sí, ahí estaré/i }));
    enviarRsvpMock.mockResolvedValueOnce(estadoPendiente({ status: "CONFIRMED", adultsConfirmed: 2, childrenConfirmed: 1 }));
    await usuario.click(screen.getByRole("button", { name: /confirmar mi asistencia/i }));

    expect(await screen.findByText(/quedaste confirmada/i)).toBeTruthy();
    expect(enviarRsvpMock).toHaveBeenCalledTimes(3);
  });
});

describe("estado 3 — enlace que no resuelve", () => {
  it("RSVP_LINK_NOT_FOUND muestra una sola pantalla genérica, sin oferta de «buscar tu invitación»", async () => {
    obtenerRsvpMock.mockRejectedValue(
      new ApiError({ timestamp: "x", statusCode: 404, code: "RSVP_LINK_NOT_FOUND", message: "Este enlace ya no funciona" }, 404),
    );
    render(<PantallaInvitado token="token-cualquiera" />);

    expect(await screen.findByText(/este enlace ya no funciona/i)).toBeTruthy();
    expect(screen.queryByText(/buscar tu invitación/i)).toBeNull();
  });

  it("un token mal formado produce la MISMA pantalla que uno inexistente (mismo code del backend)", async () => {
    obtenerRsvpMock.mockRejectedValue(
      new ApiError({ timestamp: "x", statusCode: 404, code: "RSVP_LINK_NOT_FOUND", message: "Este enlace ya no funciona" }, 404),
    );
    render(<PantallaInvitado token="!!!" />);
    expect(await screen.findByText(/este enlace ya no funciona/i)).toBeTruthy();
  });
});

describe("límite de intentos", () => {
  it("429 en la carga inicial pide esperar, sin decir si el token era válido", async () => {
    obtenerRsvpMock.mockRejectedValue(
      new ApiError({ timestamp: "x", statusCode: 429, code: "RSVP_TOO_MANY_ATTEMPTS", message: "Espera" }, 429),
    );
    render(<PantallaInvitado token="tok-7" />);

    expect(await screen.findByText(/muchos intentos seguidos/i)).toBeTruthy();
    expect(screen.queryByText(/no funciona/i)).toBeNull();
    expect(screen.queryByText(/no existe/i)).toBeNull();
  });
});

describe("estado 4 — convocatoria cerrada", () => {
  it("event.closed:true se dice ANTES de enseñar el formulario, no al fallar el envío", async () => {
    obtenerRsvpMock.mockResolvedValue({
      ...estadoPendiente(),
      event: { publicToken: "pub_abc123", childrenAllowed: true, youngAllowed: false, closed: true },
    });
    render(<PantallaInvitado token="tok-8" />);
    await screen.findByRole("heading", { level: 1, name: NOMBRE_INVITADO });

    expect(screen.getByText(/esta convocatoria ya cerró/i)).toBeTruthy();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryByRole("button", { name: /confirmar mi asistencia/i })).toBeNull();
  });
});

describe("errores desconocidos al enviar", () => {
  it("un GUEST_QUOTA_EXCEEDED al enviar se muestra en la propia tarjeta, sin tirar la pantalla entera", async () => {
    const usuario = userEvent.setup();
    obtenerRsvpMock.mockResolvedValue(estadoPendiente());
    render(<PantallaInvitado token="tok-9" />);
    await screen.findByRole("heading", { level: 1, name: NOMBRE_INVITADO });

    enviarRsvpMock.mockRejectedValueOnce(
      new ApiError({ timestamp: "x", statusCode: 422, code: "GUEST_QUOTA_EXCEEDED", message: "No puedes confirmar más" }, 422),
    );
    await usuario.click(screen.getByRole("button", { name: /confirmar mi asistencia/i }));

    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toMatch(/no puedes confirmar más lugares/i);
    // La tarjeta de decisión sigue en pie (no se reemplazó por la pantalla de error genérica).
    expect(screen.getByRole("radiogroup")).toBeTruthy();
  });
});
