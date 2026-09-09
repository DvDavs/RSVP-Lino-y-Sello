import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as apiClient from "@/lib/api-client";
import * as invitadosApi from "@/lib/invitados/api";
import { ApiError } from "@/lib/errors";
import type { GuestItem, GuestPage, GuestSummary } from "@/lib/invitados/api";
import { PantallaInvitados } from "./PantallaInvitados";

// `CompartirInvitacion` (bloque 5-3) vive dentro de esta pantalla y pide `getDocument` por su
// cuenta. Sin mock, cae al «error» de ESE bloque y pinta su PROPIO «Reintentar» — que choca con el
// `getByText("Reintentar")` (singular) de las pruebas de abajo, que son de la lista de invitados,
// no de ese bloque. Se deja en «no publicada» por defecto: es el estado que no añade ni un
// «Reintentar» ni un enlace a la pantalla, así que no interfiere con ninguna prueba de aquí.
beforeEach(() => {
  vi.spyOn(apiClient, "getDocument").mockResolvedValue({ activeRelease: null } as never);
});

// jsdom no implementa estos tres (Radix Select los usa al abrir/desplazar el panel). El paquete
// `@invitaciones/ui` los rellena en SU `test/setup.ts`; `apps/web` no lo hace todavía, así que se
// rellenan aquí, local a este archivo, en vez de tocar el `test/setup.ts` compartido (fuera del
// territorio de esta sesión).
if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

function resumen(sobrescribir: Partial<GuestSummary> = {}): GuestSummary {
  return {
    guests: { total: 49, pending: 12, confirmed: 34, declined: 3 },
    seats: {
      adults: { invited: 60, confirmed: 48 },
      children: { invited: 15, confirmed: 10 },
      young: { invited: 5, confirmed: 3 },
      totalInvited: 80,
      totalConfirmed: 61,
    },
    rules: { childrenAllowed: true, youngAllowed: false },
    ...sobrescribir,
  };
}

function invitado(sobrescribir: Partial<GuestItem> = {}): GuestItem {
  return {
    id: 1,
    fullName: "María Fernanda Cruz",
    email: null,
    phone: null,
    tableNumber: null,
    adults: 2,
    children: 1,
    young: 0,
    adultsConfirmed: 0,
    childrenConfirmed: 0,
    youngConfirmed: 0,
    status: "PENDING",
    message: null,
    updatedAt: null,
    ...sobrescribir,
  };
}

function pagina(content: readonly GuestItem[], sobrescribir: Partial<GuestPage> = {}): GuestPage {
  return { content, page: 0, size: 25, totalElements: content.length, totalPages: 1, ...sobrescribir };
}

describe("PantallaInvitados — los tres estados", () => {
  it("CARGA: enseña el esqueleto mientras llega el primer resumen", async () => {
    let resolver: (() => void) | undefined;
    const traerResumen = vi
      .spyOn(invitadosApi, "getGuestsSummary")
      .mockImplementation(() => new Promise((resuelve) => { resolver = () => resuelve(resumen()); }));
    vi.spyOn(invitadosApi, "listGuests").mockResolvedValue(pagina([]));
    render(<PantallaInvitados invitationId={7} />);
    expect((await screen.findAllByRole("status", { name: "Cargando invitados" })).length).toBeGreaterThan(0);
    // El resumen se pide tras el debounce de la búsqueda (300 ms): se espera a que la petición
    // exista de verdad antes de resolverla, o no habría nada que resolver todavía.
    await waitFor(() => expect(traerResumen).toHaveBeenCalled());
    resolver?.();
    await waitFor(() => expect(screen.queryAllByRole("status", { name: "Cargando invitados" })).toHaveLength(0));
  });

  it("ERROR (primera carga): tarjeta con Reintentar, sin tabla previa que borrar", async () => {
    vi.spyOn(invitadosApi, "getGuestsSummary").mockRejectedValue(
      new ApiError({ timestamp: "t", statusCode: 500, code: "INVITATION_NOT_FOUND", message: "No encontramos la invitación." }, 500),
    );
    vi.spyOn(invitadosApi, "listGuests").mockResolvedValue(pagina([]));
    render(<PantallaInvitados invitationId={7} />);
    expect(await screen.findByText("No encontramos la invitación.")).toBeTruthy();
    const reintentar = screen.getByText("Reintentar");
    expect(reintentar).toBeTruthy();

    vi.spyOn(invitadosApi, "getGuestsSummary").mockResolvedValue(resumen());
    const usuario = userEvent.setup();
    await usuario.click(reintentar);
    await waitFor(() => expect(screen.getByText("Confirmados")).toBeTruthy());
  });

  it("VACÍO: sin invitados, muestra las dos acciones del wireframe", async () => {
    vi.spyOn(invitadosApi, "getGuestsSummary").mockResolvedValue(resumen());
    vi.spyOn(invitadosApi, "listGuests").mockResolvedValue(pagina([]));
    render(<PantallaInvitados invitationId={7} />);
    expect(await screen.findByText("Todavía no tienes invitados")).toBeTruthy();
    expect(screen.getAllByText("Agregar invitado").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pegar una lista").length).toBeGreaterThan(0);
  });
});

describe("PantallaInvitados — búsqueda y filtro van al backend", () => {
  it("escribir en «Buscar por nombre» llama a listGuests con search (no filtra en cliente)", async () => {
    vi.spyOn(invitadosApi, "getGuestsSummary").mockResolvedValue(resumen());
    const listar = vi.spyOn(invitadosApi, "listGuests").mockResolvedValue(pagina([invitado()]));
    const usuario = userEvent.setup();
    render(<PantallaInvitados invitationId={7} />);
    // Ancla de espera: la lista ya está pintada. El nombre accesible del disparador de edición es
    // «Editar a <nombre>» (dice QUÉ hace, `TablaInvitados.test.tsx`), y en jsdom se pintan a la vez
    // la tabla y las tarjetas — de ahí `findAllByRole` con expresión regular sobre el nombre.
    await screen.findAllByRole("button", { name: /María Fernanda Cruz/ });

    await usuario.type(screen.getByLabelText("Buscar por nombre"), "Rocío");

    await waitFor(
      () => expect(listar).toHaveBeenCalledWith(7, expect.objectContaining({ search: "Rocío" })),
      { timeout: 2000 },
    );
  });

  it("cambiar el filtro de estado llama a listGuests con status", async () => {
    vi.spyOn(invitadosApi, "getGuestsSummary").mockResolvedValue(resumen());
    const listar = vi.spyOn(invitadosApi, "listGuests").mockResolvedValue(pagina([invitado()]));
    const usuario = userEvent.setup();
    render(<PantallaInvitados invitationId={7} />);
    // Ancla de espera: la lista ya está pintada. El nombre accesible del disparador de edición es
    // «Editar a <nombre>» (dice QUÉ hace, `TablaInvitados.test.tsx`), y en jsdom se pintan a la vez
    // la tabla y las tarjetas — de ahí `findAllByRole` con expresión regular sobre el nombre.
    await screen.findAllByRole("button", { name: /María Fernanda Cruz/ });

    const disparador = screen.getByRole("combobox", { name: "Filtrar por estado" });
    disparador.focus();
    await usuario.keyboard("{Enter}");
    await usuario.click(await screen.findByRole("option", { name: "Confirmados" }));

    await waitFor(
      () => expect(listar).toHaveBeenCalledWith(7, expect.objectContaining({ status: "CONFIRMED" })),
      { timeout: 2000 },
    );
  });
});

describe("PantallaInvitados — cupos de niños/jóvenes en el alta", () => {
  it("con youngAllowed=false, «Agregar invitado» no ofrece el campo Jóvenes", async () => {
    vi.spyOn(invitadosApi, "getGuestsSummary").mockResolvedValue(resumen({ rules: { childrenAllowed: true, youngAllowed: false } }));
    vi.spyOn(invitadosApi, "listGuests").mockResolvedValue(pagina([invitado()]));
    const usuario = userEvent.setup();
    render(<PantallaInvitados invitationId={7} />);
    // Ancla de espera: la lista ya está pintada. El nombre accesible del disparador de edición es
    // «Editar a <nombre>» (dice QUÉ hace, `TablaInvitados.test.tsx`), y en jsdom se pintan a la vez
    // la tabla y las tarjetas — de ahí `findAllByRole` con expresión regular sobre el nombre.
    await screen.findAllByRole("button", { name: /María Fernanda Cruz/ });

    await usuario.click(screen.getAllByText("Agregar invitado")[0]!);
    expect(await screen.findByLabelText(/Niños/i)).toBeTruthy();
    expect(screen.queryByLabelText(/Jóvenes/i)).toBeNull();
  });
});

// -------------------------------------------------------------------------------------------
// Arreglos de la revisión Opus. Cada caso cae si se deshace el arreglo.
// -------------------------------------------------------------------------------------------

describe("PantallaInvitados — una respuesta que llega tarde no pisa la búsqueda en curso", () => {
  it("la lista enseña lo que pidió la ÚLTIMA búsqueda, aunque la anterior conteste después", async () => {
    vi.spyOn(invitadosApi, "getGuestsSummary").mockResolvedValue(resumen());
    let resolverLenta: (() => void) | undefined;
    const lenta = new Promise<GuestPage>((resuelve) => {
      resolverLenta = () => resuelve(pagina([invitado({ id: 9, fullName: "Rosa Vieja" })]));
    });
    const listar = vi
      .spyOn(invitadosApi, "listGuests")
      .mockResolvedValueOnce(pagina([invitado({ id: 1, fullName: "Ana Primera" })])) // carga inicial
      .mockReturnValueOnce(lenta) // «Ro»: se queda colgada a propósito
      .mockResolvedValue(pagina([invitado({ id: 2, fullName: "Rocío Nueva" })])); // «Rocío»

    const usuario = userEvent.setup();
    render(<PantallaInvitados invitationId={7} />);
    await screen.findAllByRole("button", { name: /Ana Primera/ });

    const buscador = screen.getByLabelText("Buscar por nombre");
    await usuario.type(buscador, "Ro");
    await waitFor(() => expect(listar).toHaveBeenCalledTimes(2), { timeout: 2000 });
    await usuario.type(buscador, "cío");
    await waitFor(() => expect(listar).toHaveBeenCalledTimes(3), { timeout: 2000 });
    await screen.findAllByRole("button", { name: /Rocío Nueva/ });

    // Ahora contesta la búsqueda vieja. Sin el guardia de `ultimaPeticion` esto repinta la lista con
    // «Rosa Vieja» debajo de un buscador que dice «Rocío».
    resolverLenta?.();
    await lenta;
    await waitFor(() => expect(screen.queryAllByRole("button", { name: /Rosa Vieja/ })).toHaveLength(0));
    expect(screen.getAllByRole("button", { name: /Rocío Nueva/ }).length).toBeGreaterThan(0);
  });
});

describe("PantallaInvitados — el esqueleto no deja saltar la maquetación", () => {
  it("reserva el hueco de la fila de búsqueda y filtro mientras carga", async () => {
    vi.spyOn(invitadosApi, "getGuestsSummary").mockImplementation(() => new Promise(() => {}));
    vi.spyOn(invitadosApi, "listGuests").mockResolvedValue(pagina([]));
    const { container } = render(<PantallaInvitados invitationId={7} />);
    await screen.findAllByRole("status", { name: "Cargando invitados" });
    // Mismo ancho que el campo real de búsqueda (`sm:w-64`): sin este hueco, la fila entera aparecía
    // de golpe al terminar la carga y empujaba la tabla hacia abajo.
    expect(container.querySelectorAll('[class*="sm:w-64"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[class*="sm:w-44"]').length).toBeGreaterThan(0);
  });
});
