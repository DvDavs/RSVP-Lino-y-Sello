import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogItem } from "@/lib/api-types";
import { AsistenteDeCreacion } from "./AsistenteDeCreacion.tsx";

// ── Navegación simulada: la URL es el estado del asistente, así que la prueba la controla ──────
let parametros = new URLSearchParams();
const push = vi.fn((url: string) => {
  parametros = new URLSearchParams(url.split("?")[1] ?? "");
});
const replace = vi.fn((url: string) => {
  parametros = new URLSearchParams(url.split("?")[1] ?? "");
});
// `useRouter()` de Next devuelve SIEMPRE el mismo objeto; la simulación también, o cualquier
// `useCallback([router])` cambiaría de identidad en cada render y su efecto se repetiría sin fin.
const router = { push, replace };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => parametros,
}));

// ── Cliente HTTP simulado. Se conservan las CLASES de error reales (`ApiError`, `SessionError`):
// el asistente distingue los códigos `TPL_*` con `instanceof`, y una simulación que las sustituyera
// dejaría esa rama sin probar. ──────────────────────────────────────────────────────────────────
const listarInvitaciones = vi.fn();
const getDocument = vi.fn();
const getCatalog = vi.fn();
const chooseTemplate = vi.fn();
const postOperations = vi.fn();
const setEvent = vi.fn();
const getAuthToken = vi.fn();
const crearInvitacion = vi.fn();
const eliminarInvitacion = vi.fn();

vi.mock("@/lib/api-client", async (original) => {
  const real = await original<typeof import("@/lib/api-client")>();
  return {
    ...real,
    listarInvitaciones: (...args: never[]) => listarInvitaciones(...args),
    getDocument: (...args: never[]) => getDocument(...args),
    getCatalog: (...args: never[]) => getCatalog(...args),
    chooseTemplate: (...args: never[]) => chooseTemplate(...args),
    postOperations: (...args: never[]) => postOperations(...args),
    setEvent: (...args: never[]) => setEvent(...args),
    getAuthToken: () => getAuthToken(),
    crearInvitacion: (...args: never[]) => crearInvitacion(...args),
    eliminarInvitacion: (...args: never[]) => eliminarInvitacion(...args),
  };
});

const { ApiError, UnknownApiError } = await import("@/lib/errors");

/** `ApiError(respuesta, httpStatus)`: la firma real de `lib/errors.ts`, no una inventada. */
function errorApi(codigo: string, httpStatus: number, mensaje = "error de prueba") {
  return new ApiError({ timestamp: new Date().toISOString(), statusCode: httpStatus, code: codigo, message: mensaje }, httpStatus);
}

/**
 * `POST`/`DELETE /product/invitations` responden `{code, message, details}` pero su `code` NO
 * empieza por `TPL_` (son `PRD_*`), así que `peticion()` los clasifica como `UnknownApiError`
 * (`lib/api-client.ts`), nunca como `ApiError` — igual que las rutas de cuenta. Se arma el mismo
 * cuerpo crudo que mandaría el backend real, para que `codigoAlta`/`traducirErrorAlta` lo lean tal
 * cual lo harían en producción.
 */
function errorProducto(codigo: string, httpStatus: number, detalles?: unknown, mensaje = "error de prueba") {
  return new UnknownApiError(
    httpStatus,
    JSON.stringify({
      timestamp: new Date().toISOString(),
      statusCode: httpStatus,
      code: codigo,
      message: mensaje,
      ...(detalles !== undefined ? { details: detalles } : {}),
    }),
  );
}

const BODA: CatalogItem = {
  slug: "boda-clasica",
  version: "1.0.0",
  name: { "es-MX": "Boda clásica" },
  eventKinds: ["wedding"],
  minPlanTier: 2,
  previewUrl: "https://ejemplo.test/boda.webp",
  capabilities: ["story"],
  status: "published",
};
const XV: CatalogItem = {
  slug: "xv-jardin",
  version: "1.0.0",
  name: { "es-MX": "XV Jardín" },
  eventKinds: ["quince"],
  minPlanTier: 1,
  previewUrl: "https://ejemplo.test/xv.webp",
  capabilities: [],
  status: "published",
};

const COMPUESTO = {
  composedVersion: 1,
  template: { slug: "boda-clasica", version: "1.0.0" },
  locale: "es-MX",
  theme: {},
  sections: [
    {
      key: "couple",
      blocks: [
        { id: "couple.groom", role: "celebrantA", type: "person", label: "Novio", value: null },
        { id: "couple.bride", role: "celebrantB", type: "person", label: "Novia", value: null },
      ],
    },
  ],
};

const INVITACION_SIN_PLANTILLA = { id: 7, status: "paid", event: "Boda", plan: "Premium", date: "2027-04-18", time: "17:00" };

function catalogoPorTipo(query?: { eventKind?: string }) {
  if (query?.eventKind === "wedding") return Promise.resolve({ items: [BODA], nextCursor: null });
  if (query?.eventKind === "quince") return Promise.resolve({ items: [XV], nextCursor: null });
  if (query?.eventKind) return Promise.resolve({ items: [], nextCursor: null });
  return Promise.resolve({ items: [BODA, XV], nextCursor: null });
}

beforeEach(() => {
  parametros = new URLSearchParams();
  push.mockClear();
  replace.mockClear();
  crearInvitacion.mockReset();
  eliminarInvitacion.mockReset();
  getAuthToken.mockReturnValue("token-de-prueba");
  listarInvitaciones.mockResolvedValue([INVITACION_SIN_PLANTILLA]);
  getDocument.mockRejectedValue(errorApi("TPL_DOCUMENT_NOT_STARTED", 404, "sin documento"));
  getCatalog.mockImplementation(catalogoPorTipo);
  chooseTemplate.mockResolvedValue({ revision: 0, created: true, composed: COMPUESTO });
  postOperations.mockResolvedValue({ revision: 1, applied: true });
  setEvent.mockResolvedValue({ invitationId: 7, date: "2027-04-18", time: "17:00" });
});

describe("el asistente sin sesión", () => {
  it("lleva a `/acceso` con el retorno puesto y deja una salida a la vista mientras tanto", async () => {
    getAuthToken.mockReturnValue(null);
    render(<AsistenteDeCreacion />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/acceso?volver=%2Feditor"));
    expect(screen.getByRole("link", { name: "Iniciar sesión" }).getAttribute("href")).toBe("/acceso?volver=%2Feditor");
    expect(listarInvitaciones).not.toHaveBeenCalled();
  });
});

describe("paso 1 → paso 2 (el cierre de UX-N-02)", () => {
  it("preselecciona el tipo con el que la invitación quedó REGISTRADA", async () => {
    render(<AsistenteDeCreacion />);
    await screen.findByRole("radiogroup", { name: "¿Qué vamos a celebrar?" });
    await waitFor(() => expect(screen.getByRole("radio", { name: /Boda/ }).getAttribute("aria-checked")).toBe("true"));
    expect(screen.getByRole("button", { name: /Continuar con Boda/ })).toBeTruthy();
  });

  it("`?tipo=` de la landing gana a la preselección", async () => {
    parametros = new URLSearchParams("tipo=quince");
    render(<AsistenteDeCreacion />);
    await screen.findByRole("radiogroup", { name: "¿Qué vamos a celebrar?" });
    expect(screen.getByRole("radio", { name: /XV años/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("3C-UX G-02: `?tipo=xv-anos` — el slug REAL de la portada — deja de ignorarse", async () => {
    // La portada enlaza `/editor?tipo=xv-anos` (`components/sitio/TiposDeEvento.tsx`); ninguno de
    // sus siete slugs es un `EventKind`, así que el asistente los descartaba todos en silencio.
    parametros = new URLSearchParams("tipo=xv-anos");
    render(<AsistenteDeCreacion />);
    await screen.findByRole("radiogroup", { name: "¿Qué vamos a celebrar?" });
    expect(screen.getByRole("radio", { name: /XV años/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("3C-UX G-02: con dos invitaciones libres, `?tipo=` elige la registrada con ESE tipo", async () => {
    listarInvitaciones.mockResolvedValue([
      INVITACION_SIN_PLANTILLA,
      { id: 9, status: "paid", event: "XV años", plan: "Premium", date: "2027-09-01", time: "18:00" },
    ]);
    parametros = new URLSearchParams("tipo=xv-anos");
    render(<AsistenteDeCreacion />);
    await screen.findByRole("radiogroup", { name: "¿Qué vamos a celebrar?" });
    await userEvent.click(screen.getByTestId("asistente-continuar"));
    expect(push).toHaveBeenCalledWith(expect.stringContaining("inv=9"));
    // Y no hay aviso de «está registrada como …»: la invitación y el tipo pedido coinciden.
    expect(screen.queryByText(/está registrada como/)).toBeNull();
  });

  it("al continuar, el catálogo se pide CON `eventKind` — el parámetro que faltaba (UX-N-02)", async () => {
    parametros = new URLSearchParams("tipo=quince");
    render(<AsistenteDeCreacion />);
    await screen.findByRole("radiogroup", { name: "¿Qué vamos a celebrar?" });
    await userEvent.click(screen.getByTestId("asistente-continuar"));
    expect(push).toHaveBeenCalledWith(expect.stringContaining("paso=plantilla"));
    // 3C-UX B-19: en la URL viaja el slug en español, el MISMO que enlaza la portada, no el
    // identificador interno `quince`. El lector sigue aceptando los dos.
    expect(push).toHaveBeenCalledWith(expect.stringContaining("tipo=xv-anos"));
    expect(push).toHaveBeenCalledWith(expect.stringContaining("inv=7"));

    // Y el paso 2, con esa URL, solo trae las plantillas de ese tipo.
    render(<AsistenteDeCreacion />);
    await waitFor(() => expect(getCatalog).toHaveBeenCalledWith({ eventKind: "quince" }));
    expect(await screen.findByRole("heading", { name: "XV Jardín", level: 2 })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Boda clásica", level: 2 })).toBeNull();
  });

  it("si el tipo elegido no es el registrado, se avisa en vez de dejarlo pasar en silencio", async () => {
    render(<AsistenteDeCreacion />);
    await screen.findByRole("radiogroup", { name: "¿Qué vamos a celebrar?" });
    await userEvent.click(screen.getByRole("radio", { name: /Bautizo/ }));
    expect(screen.getByText(/está registrada como Boda/)).toBeTruthy();
  });
});

describe("paso 2 → paso 3", () => {
  it("elegir plantilla llama a `:choose-template` sin `baseRevision` (primera creación) y avanza", async () => {
    parametros = new URLSearchParams("paso=plantilla&tipo=wedding&inv=7");
    render(<AsistenteDeCreacion />);
    await userEvent.click(await screen.findByTestId("asistente-usar-boda-clasica"));
    await waitFor(() =>
      expect(chooseTemplate).toHaveBeenCalledWith(7, { templateSlug: "boda-clasica", templateVersion: "1.0.0" }),
    );
    expect(push).toHaveBeenCalledWith(expect.stringContaining("paso=datos"));
    expect(push).toHaveBeenCalledWith(expect.stringContaining("plantilla=boda-clasica"));
  });

  it("un `403 TPL_PLAN_TIER_INSUFFICIENT` se cuenta con el nombre de la plantilla, no con el código", async () => {
    parametros = new URLSearchParams("paso=plantilla&tipo=wedding&inv=7");
    chooseTemplate.mockRejectedValueOnce(errorApi("TPL_PLAN_TIER_INSUFFICIENT", 403, "no"));
    render(<AsistenteDeCreacion />);
    await userEvent.click(await screen.findByTestId("asistente-usar-boda-clasica"));
    expect((await screen.findByRole("alert")).textContent).toContain("«Boda clásica» es de un plan superior");
  });

  it("un `404 TPL_TEMPLATE_VERSION_NOT_FOUND` recarga el catálogo (`04 §7.1` paso 2)", async () => {
    parametros = new URLSearchParams("paso=plantilla&tipo=wedding&inv=7");
    chooseTemplate.mockRejectedValueOnce(errorApi("TPL_TEMPLATE_VERSION_NOT_FOUND", 404, "no"));
    render(<AsistenteDeCreacion />);
    const llamadasAntes = getCatalog.mock.calls.length;
    await userEvent.click(await screen.findByTestId("asistente-usar-boda-clasica"));
    expect((await screen.findByRole("alert")).textContent).toContain("ya no está disponible");
    await waitFor(() => expect(getCatalog.mock.calls.length).toBeGreaterThan(llamadasAntes));
  });
});

describe("paso 3 — los datos básicos", () => {
  beforeEach(() => {
    getDocument.mockResolvedValue({ revision: 0, composed: COMPUESTO });
    parametros = new URLSearchParams("paso=datos&tipo=wedding&inv=7&plantilla=boda-clasica");
  });

  it("rehidrata los campos desde el documento tras una recarga", async () => {
    render(<AsistenteDeCreacion />);
    expect(await screen.findByLabelText("Novio")).toBeTruthy();
    expect(screen.getByLabelText("Novia")).toBeTruthy();
  });

  it("guarda los nombres con un lote de operaciones y la fecha con `PUT …/event`", async () => {
    render(<AsistenteDeCreacion />);
    await userEvent.type(await screen.findByLabelText("Novio"), "Luis Hernández");
    await userEvent.clear(screen.getByLabelText("Fecha del evento"));
    await userEvent.type(screen.getByLabelText("Fecha del evento"), "2027-05-22");
    await userEvent.click(screen.getByTestId("asistente-continuar"));

    await waitFor(() =>
      expect(postOperations).toHaveBeenCalledWith(7, {
        baseRevision: 0,
        clientBatchId: expect.stringMatching(/^[A-Za-z0-9_-]{8,64}$/),
        operations: [{ op: "setBlock", blockId: "couple.groom", value: { kind: "person", name: "Luis Hernández" } }],
      }),
    );
    expect(setEvent).toHaveBeenCalledWith(7, { date: "2027-05-22", time: "17:00" });
    expect(push).toHaveBeenCalledWith(expect.stringContaining("paso=listo"));
  });

  it("sin escribir nada no se manda ninguna operación: el paso es opcional de verdad", async () => {
    render(<AsistenteDeCreacion />);
    await screen.findByLabelText("Novio");
    await userEvent.click(screen.getByTestId("asistente-continuar"));
    await waitFor(() => expect(push).toHaveBeenCalledWith(expect.stringContaining("paso=listo")));
    expect(postOperations).not.toHaveBeenCalled();
  });

  it("«Lo lleno después» avanza sin guardar", async () => {
    render(<AsistenteDeCreacion />);
    await screen.findByLabelText("Novio");
    await userEvent.click(screen.getByRole("button", { name: "Lo lleno después" }));
    expect(postOperations).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith(expect.stringContaining("paso=listo"));
  });

  it("un fallo al guardar se cuenta y NO tira el trabajo: se puede seguir al editor", async () => {
    postOperations.mockRejectedValueOnce(errorApi("TPL_INTERNAL", 500, "boom"));
    render(<AsistenteDeCreacion />);
    await userEvent.type(await screen.findByLabelText("Novio"), "Luis");
    await userEvent.click(screen.getByTestId("asistente-continuar"));
    // 3C-UX G-03: el aviso decía «Puedes continuar» y «Continuar» no continuaba. Ahora ofrece
    // exactamente los dos botones que salen debajo.
    expect((await screen.findByRole("alert")).textContent).toContain("sigue sin guardar");
    expect(screen.getByRole("button", { name: "Volver a guardar" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Seguir sin guardar" }));
    expect(push).toHaveBeenCalledWith(expect.stringContaining("paso=listo"));
  });

  it("3C-UX G-03: un fallo de red lo dice y «Volver a guardar» reintenta de verdad", async () => {
    postOperations.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<AsistenteDeCreacion />);
    await userEvent.type(await screen.findByLabelText("Novio"), "Luis");
    await userEvent.click(screen.getByTestId("asistente-continuar"));
    expect((await screen.findByRole("alert")).textContent).toContain("No hay conexión");
    await userEvent.click(screen.getByRole("button", { name: "Volver a guardar" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(expect.stringContaining("paso=listo")));
    expect(postOperations).toHaveBeenCalledTimes(2);
  });
});

describe("paso 4 — listo", () => {
  it("resume lo elegido y abre el editor de ESA invitación", async () => {
    getDocument.mockResolvedValue({ revision: 0, composed: COMPUESTO });
    parametros = new URLSearchParams("paso=listo&tipo=wedding&inv=7&plantilla=boda-clasica");
    render(<AsistenteDeCreacion />);
    expect(await screen.findByRole("heading", { name: "Tu invitación ya tiene diseño", level: 1 })).toBeTruthy();
    expect(await screen.findByText("Boda · plantilla «Boda clásica»")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Abrir mi invitación" }).getAttribute("href")).toBe("/editor/7");
  });
});

describe("estados sin salida", () => {
  it("sin ninguna invitación, hay un camino real para crear la primera (cierre de G-01)", async () => {
    listarInvitaciones.mockResolvedValue([]);
    render(<AsistenteDeCreacion />);
    expect(await screen.findByRole("heading", { name: "Todavía no tienes invitaciones" })).toBeTruthy();
    // Fase 5, E3: ya NO manda a los planes — el alta existe, así que el botón lleva al formulario
    // que está en la misma pantalla, no a una promesa de que «se crea al contratar».
    expect(screen.queryByRole("link", { name: "Ver planes" })).toBeNull();
    expect(screen.getByRole("button", { name: "Empezar mi invitación" })).toBeTruthy();
    expect(await screen.findByRole("radiogroup", { name: "Crea tu invitación" })).toBeTruthy();
  });

  it("3C-UX G-02: con TODAS las invitaciones ya diseñadas, el paso 1 explica y ofrece la salida", async () => {
    listarInvitaciones.mockResolvedValue([INVITACION_SIN_PLANTILLA]);
    getDocument.mockResolvedValue({
      revision: 3,
      composed: COMPUESTO,
      publicToken: "pub_x",
      publicUrl: "https://invitaciones.mx/i/pub_x",
      activeRelease: { releaseId: 1, publishedAt: "2026-09-01T10:00:00Z", contentHash: "sha256:x", stale: false, staleReason: [] },
    });
    render(<AsistenteDeCreacion />);
    // Ni la pregunta sin respuestas, ni el «Continuar» inhabilitado para siempre, ni el paso 1 de 4.
    expect(await screen.findByRole("heading", { name: "Tu invitación ya tiene diseño", level: 1 })).toBeTruthy();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryByTestId("asistente-continuar")).toBeNull();
    expect(screen.queryByText("Paso 1 de 4")).toBeNull();
    // Y la salida real: la invitación, su estado y su enlace público…
    expect(screen.getByRole("link", { name: "Abrir en el editor" }).getAttribute("href")).toBe("/editor/7");
    expect(screen.getByText("Publicada")).toBeTruthy();
    expect(screen.getByText(/\/i\/pub_x$/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver como invitada" }).getAttribute("href")).toMatch(/\/i\/pub_x$/);
    // … Y, fase 5 E3: «Eliminar» de verdad en la fila — la salida real del tope de 3 borradores
    // (contrato §4), disponible aquí aunque el formulario de alta se limite al caso sin ninguna.
    expect(screen.getByTestId("asistente-eliminar-7")).toBeTruthy();
  });

  it("con el catálogo caído se avisa y se puede reintentar", async () => {
    getCatalog.mockRejectedValue(errorApi("TPL_INTERNAL", 500, "boom"));
    render(<AsistenteDeCreacion />);
    const aviso = await screen.findByRole("alert");
    expect(aviso.textContent).toContain("No pudimos cargar las plantillas.");
    getCatalog.mockImplementation(catalogoPorTipo);
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("el progreso dice en qué paso va, y al CAMBIAR de paso el foco va a su título", async () => {
    const { rerender } = render(<AsistenteDeCreacion />);
    await screen.findByRole("radiogroup", { name: "¿Qué vamos a celebrar?" });
    expect(screen.getByText("Paso 1 de 4")).toBeTruthy();
    // Al aterrizar NO se roba el foco: se queda donde lo pone el navegador.
    expect(document.activeElement).toBe(document.body);

    await userEvent.click(screen.getByTestId("asistente-continuar"));
    rerender(<AsistenteDeCreacion />);
    expect(screen.getByText("Paso 2 de 4")).toBeTruthy();
    const titulo = await screen.findByRole("heading", { name: "Elige el punto de partida", level: 1 });
    await waitFor(() => expect(document.activeElement).toBe(titulo));
  });
});

// ── Alta desde el asistente (fase 5, E3; cierre de G-01; `handoffs/5-1b-contrato-alta.md`) ──────
const ALTA_BODA = {
  invitationId: 61,
  eventKind: "wedding" as const,
  eventDate: "2027-06-10",
  eventTime: "17:30",
  childrenAllowed: true,
  youngAllowed: true,
  hashtag: "",
  isPaid: false,
  isEnabled: true,
  isFinished: false,
  usesTemplates2: true,
  createdAt: "2026-09-09T00:00:00Z",
};

describe("alta desde el asistente (cierre de G-01)", () => {
  beforeEach(() => {
    listarInvitaciones.mockResolvedValue([]);
  });

  /** Llena las tres preguntas que `POST /product/invitations` exige a la vez (contrato §2). */
  async function llenarFormularioDeAlta(tipo: RegExp) {
    render(<AsistenteDeCreacion />);
    await userEvent.click(await screen.findByRole("radio", { name: tipo }));
    await userEvent.clear(screen.getByLabelText("Fecha del evento"));
    await userEvent.type(screen.getByLabelText("Fecha del evento"), "2027-06-10");
    fireEvent.change(screen.getByLabelText("Hora de inicio"), { target: { value: "17:30" } });
  }

  it("alta feliz: crea la invitación y avanza al paso 2 con ESA invitación", async () => {
    crearInvitacion.mockResolvedValue(ALTA_BODA);
    await llenarFormularioDeAlta(/Boda/);
    await userEvent.click(screen.getByTestId("asistente-crear-invitacion"));
    await waitFor(() =>
      expect(crearInvitacion).toHaveBeenCalledWith({ eventKind: "wedding", eventDate: "2027-06-10", eventTime: "17:30" }),
    );
    expect(push).toHaveBeenCalledWith(expect.stringContaining("paso=plantilla"));
    expect(push).toHaveBeenCalledWith(expect.stringContaining("inv=61"));
  });

  it("doble envío: el botón se deshabilita al primer clic y no se manda dos veces", async () => {
    let resolver: ((valor: unknown) => void) | null = null;
    crearInvitacion.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolver = resolve;
        }),
    );
    await llenarFormularioDeAlta(/Boda/);
    const boton = screen.getByTestId("asistente-crear-invitacion") as HTMLButtonElement;
    await userEvent.click(boton);
    expect(boton.disabled).toBe(true); // `loading`: `11 §7`, sin esto un segundo clic mandaría dos altas
    await userEvent.click(boton); // un clic sobre un botón deshabilitado no dispara `onClick`
    expect(crearInvitacion).toHaveBeenCalledTimes(1);
    resolver!(ALTA_BODA);
    await waitFor(() => expect(push).toHaveBeenCalledWith(expect.stringContaining("inv=61")));
  });

  it("un `500` NO se reintenta solo: el botón vuelve a estar disponible y hay que pulsarlo de nuevo", async () => {
    crearInvitacion.mockRejectedValueOnce(errorProducto("PRD_INTERNAL", 500));
    await llenarFormularioDeAlta(/Boda/);
    await userEvent.click(screen.getByTestId("asistente-crear-invitacion"));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(crearInvitacion).toHaveBeenCalledTimes(1); // ni un reintento automático por el `5xx`
    expect((screen.getByTestId("asistente-crear-invitacion") as HTMLButtonElement).disabled).toBe(false);
  });

  it("`409 PRD_DRAFT_LIMIT_REACHED`: el mensaje trae los números del tope", async () => {
    crearInvitacion.mockRejectedValueOnce(errorProducto("PRD_DRAFT_LIMIT_REACHED", 409, { limit: 3, current: 3 }));
    await llenarFormularioDeAlta(/Boda/);
    await userEvent.click(screen.getByTestId("asistente-crear-invitacion"));
    expect((await screen.findByRole("alert")).textContent).toContain("Ya tienes 3 invitaciones sin publicar");
  });

  it("con el tope ya lleno (todas con plantilla), «Eliminar» sigue siendo la salida real desde el asistente", async () => {
    // No se llega aquí desde ESTE formulario (se limita al caso sin ninguna invitación, para no
    // chocar con `e2e/asistente.spec.ts` de otra sesión), sino desde «Mis invitaciones»: es donde
    // el `409` — «publica una o elimina la que no vayas a usar» — encuentra su salida de verdad.
    const TRES_BORRADORES = [
      { id: 1, status: "paid", event: "Boda", plan: "Básico", date: "2027-01-01", time: "10:00" },
      { id: 2, status: "paid", event: "Boda", plan: "Básico", date: "2027-02-01", time: "10:00" },
      { id: 3, status: "paid", event: "Boda", plan: "Básico", date: "2027-03-01", time: "10:00" },
    ];
    listarInvitaciones.mockResolvedValue(TRES_BORRADORES);
    getDocument.mockResolvedValue({ revision: 0, composed: COMPUESTO }); // las tres ya tienen plantilla
    eliminarInvitacion.mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<AsistenteDeCreacion />);
    await userEvent.click(await screen.findByTestId("asistente-eliminar-1"));
    await waitFor(() => expect(eliminarInvitacion).toHaveBeenCalledWith(1));
  });

  it("`429 PRD_TOO_MANY_REQUESTS`: se pide esperar, sin contador", async () => {
    crearInvitacion.mockRejectedValueOnce(errorProducto("PRD_TOO_MANY_REQUESTS", 429));
    await llenarFormularioDeAlta(/Boda/);
    await userEvent.click(screen.getByTestId("asistente-crear-invitacion"));
    expect((await screen.findByRole("alert")).textContent).toContain("muy rápido");
  });

  it("si `:choose-template` falla tras un alta correcta, la invitación NO queda huérfana: sigue disponible para reintentar", async () => {
    // XV Jardín (plan 1) y no Boda clásica (plan 2): toda invitación nace en plan 1 (contrato §7),
    // así que es la plantilla que de verdad puede elegir sin tocar el tema de planes en esta prueba.
    crearInvitacion.mockResolvedValue({ ...ALTA_BODA, eventKind: "quince" });
    chooseTemplate.mockRejectedValueOnce(errorApi("TPL_INTERNAL", 500, "boom"));
    await llenarFormularioDeAlta(/XV años/);
    await userEvent.click(screen.getByTestId("asistente-crear-invitacion"));
    // El alta tuvo éxito (misma instancia, sin recargar) y avanza sola al paso 2, con SU invitación.
    await waitFor(() => expect(push).toHaveBeenCalledWith(expect.stringContaining("inv=61")));
    await userEvent.click(await screen.findByTestId("asistente-usar-xv-jardin"));
    expect(await screen.findByRole("alert")).toBeTruthy();
    // El fallo de `:choose-template` NO la abandona: la invitación recién creada sigue siendo el
    // objetivo del paso 2 y el mismo botón reintenta — nunca queda huérfana ni sin decírselo.
    expect(screen.getByTestId("asistente-usar-xv-jardin")).toBeTruthy();
  });
});
