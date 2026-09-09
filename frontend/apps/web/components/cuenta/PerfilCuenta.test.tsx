// components/cuenta/PerfilCuenta.test.tsx — `/perfil` entera (fase 5, E3): datos, contraseña,
// sesiones y estado del correo. `handoffs/5-E3-A2-contrato-cuenta.md` es la especificación.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PerfilCuenta } from "./PerfilCuenta.tsx";
import { es_MX } from "@/lib/i18n";

// `useRouter()` de Next devuelve SIEMPRE el mismo objeto; la simulación también, o el `useCallback`
// que depende de `router` en `PerfilCuenta` se recalcula en cada render y su `useEffect` no deja de
// disparar (mismo hallazgo ya documentado en `components/asistente/AsistenteDeCreacion.test.tsx`).
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

const getAuthToken = vi.hoisted(() => vi.fn());
const getProfile = vi.hoisted(() => vi.fn());
const updateProfile = vi.hoisted(() => vi.fn());
const changePassword = vi.hoisted(() => vi.fn());
const requestEmailChange = vi.hoisted(() => vi.fn());
const authResendVerification = vi.hoisted(() => vi.fn());
const logoutAccount = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", async (importarReal) => {
  const real = await importarReal<typeof import("@/lib/api-client")>();
  return {
    ...real,
    getAuthToken,
    getProfile,
    updateProfile,
    changePassword,
    requestEmailChange,
    authResendVerification,
    logoutAccount,
  };
});

// El chrome autenticado trae su propia cabecera con estado de sesión (efecto async) — se mockea
// para que esta prueba se quede en lo que le toca a `/perfil`.
vi.mock("@/components/editor/EncabezadoSitio", () => ({
  EncabezadoSitio: () => <div data-testid="encabezado-mock" />,
}));

function perfilBase(extra: Partial<Record<string, unknown>> = {}) {
  return {
    name: "Ana",
    lastName: "Torres",
    email: "ana@correo.mx",
    phone: "+525512345678",
    isSurveyAnswered: true,
    emailVerified: true,
    ...extra,
  };
}

beforeEach(() => {
  router.push.mockReset();
  router.replace.mockReset();
  getAuthToken.mockReset().mockReturnValue("jwt-perfil");
  getProfile.mockReset();
  updateProfile.mockReset();
  changePassword.mockReset();
  requestEmailChange.mockReset();
  authResendVerification.mockReset();
  logoutAccount.mockReset();
});

describe("sesión", () => {
  it("sin token, manda a /acceso con `volver=/perfil` y NO llama a getProfile", async () => {
    getAuthToken.mockReturnValue(null);
    render(<PerfilCuenta correoSoporte={null} />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/acceso?volver=%2Fperfil"));
    expect(getProfile).not.toHaveBeenCalled();
  });

  it("un SessionError al cargar el perfil también manda a /acceso", async () => {
    const { SessionError } = await import("@/lib/api-client");
    getProfile.mockRejectedValue(new SessionError(401, ""));
    render(<PerfilCuenta correoSoporte={null} />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/acceso?volver=%2Fperfil"));
  });

  it("un error que no es de sesión enseña el estado de error, con reintentar", async () => {
    getProfile.mockRejectedValueOnce(new Error("500")).mockResolvedValueOnce(perfilBase());
    const persona = userEvent.setup();
    render(<PerfilCuenta correoSoporte={null} />);
    await screen.findByText(es_MX.perfil.errores.cargando);
    await persona.click(screen.getByRole("button", { name: es_MX.comun.reintentar }));
    await screen.findByText(perfilBase().email);
    expect(getProfile).toHaveBeenCalledTimes(2);
  });
});

describe("cargado: cabecera y estado del correo", () => {
  it("con emailVerified=true no hay insignia ni botón de reenviar", async () => {
    getProfile.mockResolvedValue(perfilBase({ emailVerified: true }));
    render(<PerfilCuenta correoSoporte={null} />);
    await screen.findByText("ana@correo.mx");
    expect(screen.queryByText(es_MX.perfil.correoSinVerificar)).toBeNull();
    expect(screen.queryByRole("button", { name: es_MX.perfil.reenviarVerificacion })).toBeNull();
  });

  it("con emailVerified=false enseña la insignia y reenvía al pulsar, con el correo del perfil", async () => {
    getProfile.mockResolvedValue(perfilBase({ emailVerified: false }));
    authResendVerification.mockResolvedValue({ message: "..." });
    const persona = userEvent.setup();
    render(<PerfilCuenta correoSoporte={null} />);
    await screen.findByText(es_MX.perfil.correoSinVerificar);
    await persona.click(screen.getByRole("button", { name: es_MX.perfil.reenviarVerificacion }));
    expect(authResendVerification).toHaveBeenCalledWith({ email: "ana@correo.mx" });
    expect(await screen.findByText(es_MX.perfil.verificacionReenviada)).not.toBeNull();
    // No se puede volver a pulsar: el botón desaparece tras el primer envío.
    expect(screen.queryByRole("button", { name: es_MX.perfil.reenviarVerificacion })).toBeNull();
  });
});

describe("tus datos", () => {
  it("el correo se ve pero está deshabilitado: no se edita ahí", async () => {
    getProfile.mockResolvedValue(perfilBase());
    render(<PerfilCuenta correoSoporte={null} />);
    const campoCorreo = await screen.findByLabelText(es_MX.perfil.datos.correo);
    expect((campoCorreo as HTMLInputElement).disabled).toBe(true);
  });

  it("guardar con nombre vacío no llama a updateProfile y marca el campo", async () => {
    getProfile.mockResolvedValue(perfilBase());
    const persona = userEvent.setup();
    render(<PerfilCuenta correoSoporte={null} />);
    const campoNombre = await screen.findByLabelText(es_MX.perfil.datos.nombre);
    await persona.clear(campoNombre);
    await persona.click(screen.getByRole("button", { name: es_MX.perfil.datos.guardar }));
    expect(updateProfile).not.toHaveBeenCalled();
    expect(campoNombre.getAttribute("aria-invalid")).toBe("true");
  });

  it("guardar reenvía los campos que la pantalla no enseña TAL CUAL llegaron (PUT reemplaza el recurso)", async () => {
    getProfile.mockResolvedValue(
      perfilBase({ birthdate: "1990-01-01", address: "Calle 1", city: "Oaxaca", postalCode: "68000", state: "OAX" }),
    );
    updateProfile.mockResolvedValue(perfilBase());
    const persona = userEvent.setup();
    render(<PerfilCuenta correoSoporte={null} />);
    await screen.findByText("ana@correo.mx");
    await persona.click(screen.getByRole("button", { name: es_MX.perfil.datos.guardar }));
    await waitFor(() => expect(updateProfile).toHaveBeenCalled());
    expect(updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Ana",
        lastName: "Torres",
        phone: "+525512345678",
        birthdate: "1990-01-01",
        address: "Calle 1",
        city: "Oaxaca",
        postalCode: "68000",
        state: "OAX",
      }),
    );
    expect(await screen.findByText(es_MX.perfil.datos.guardado)).not.toBeNull();
  });
});

describe("cambiar correo (diálogo aparte, con contraseña)", () => {
  async function abrirDialogo(persona: ReturnType<typeof userEvent.setup>) {
    await persona.click(screen.getByRole("button", { name: es_MX.perfil.datos.cambiarCorreo }));
  }

  it("pide el cambio y enseña SIEMPRE el mismo mensaje genérico", async () => {
    getProfile.mockResolvedValue(perfilBase());
    requestEmailChange.mockResolvedValue({ message: "..." });
    const persona = userEvent.setup();
    render(<PerfilCuenta correoSoporte={null} />);
    await screen.findByText("ana@correo.mx");
    await abrirDialogo(persona);
    const dialogo = screen.getByRole("dialog");
    await persona.type(within(dialogo).getByLabelText(es_MX.perfil.cambiarCorreoDialogo.nuevoCorreo), "nueva@correo.mx");
    await persona.type(within(dialogo).getByLabelText(es_MX.perfil.cambiarCorreoDialogo.contrasenaActual), "Secreta1!");
    await persona.click(within(dialogo).getByRole("button", { name: es_MX.perfil.cambiarCorreoDialogo.pedir }));
    expect(requestEmailChange).toHaveBeenCalledWith({ email: "nueva@correo.mx", password: "Secreta1!" });
    expect(await within(dialogo).findByText(es_MX.perfil.cambiarCorreoDialogo.pedido)).not.toBeNull();
  });

  it("una contraseña incorrecta se marca EN el campo de la contraseña del diálogo", async () => {
    const { UnknownApiError } = await import("@/lib/api-client");
    getProfile.mockResolvedValue(perfilBase());
    requestEmailChange.mockRejectedValue(
      new UnknownApiError(
        400,
        JSON.stringify({ timestamp: "x", statusCode: 400, code: "CUENTA_PASSWORD_INCORRECTA", message: "y" }),
      ),
    );
    const persona = userEvent.setup();
    render(<PerfilCuenta correoSoporte={null} />);
    await screen.findByText("ana@correo.mx");
    await abrirDialogo(persona);
    const dialogo = screen.getByRole("dialog");
    await persona.type(within(dialogo).getByLabelText(es_MX.perfil.cambiarCorreoDialogo.nuevoCorreo), "nueva@correo.mx");
    await persona.type(within(dialogo).getByLabelText(es_MX.perfil.cambiarCorreoDialogo.contrasenaActual), "mala");
    await persona.click(within(dialogo).getByRole("button", { name: es_MX.perfil.cambiarCorreoDialogo.pedir }));
    const campo = await within(dialogo).findByLabelText(es_MX.perfil.cambiarCorreoDialogo.contrasenaActual);
    expect(campo.getAttribute("aria-invalid")).toBe("true");
    expect(within(dialogo).getByText(es_MX.perfil.cambiarCorreoDialogo.contrasenaIncorrecta)).not.toBeNull();
  });
});

describe("contraseña: avisa ANTES, cierra la sesión al terminar", () => {
  it("el aviso de que se cierra la sesión está SIEMPRE visible, no solo tras el error", async () => {
    getProfile.mockResolvedValue(perfilBase());
    render(<PerfilCuenta correoSoporte={null} />);
    await screen.findByText("ana@correo.mx");
    expect(screen.getByText(es_MX.perfil.contrasena.avisoCierraSesion)).not.toBeNull();
  });

  it("dos contraseñas nuevas distintas no llaman al servidor", async () => {
    getProfile.mockResolvedValue(perfilBase());
    const persona = userEvent.setup();
    render(<PerfilCuenta correoSoporte={null} />);
    await screen.findByText("ana@correo.mx");
    await persona.type(screen.getByLabelText(es_MX.perfil.contrasena.actual), "Actual1!");
    await persona.type(screen.getByLabelText(es_MX.perfil.contrasena.nueva), "Nueva1!");
    await persona.type(screen.getByLabelText(es_MX.perfil.contrasena.repite), "OtraCosa1!");
    await persona.click(screen.getByRole("button", { name: es_MX.perfil.contrasena.cambiar }));
    expect(changePassword).not.toHaveBeenCalled();
    expect(screen.getByText(es_MX.perfil.contrasena.noCoincide)).not.toBeNull();
  });

  it("al cambiarla con éxito, manda a /acceso?motivo=sesion (mismo aviso que ya usa AsistenteAcceso)", async () => {
    getProfile.mockResolvedValue(perfilBase());
    changePassword.mockResolvedValue({ message: "..." });
    const persona = userEvent.setup();
    render(<PerfilCuenta correoSoporte={null} />);
    await screen.findByText("ana@correo.mx");
    await persona.type(screen.getByLabelText(es_MX.perfil.contrasena.actual), "Actual1!");
    await persona.type(screen.getByLabelText(es_MX.perfil.contrasena.nueva), "Nueva1!");
    await persona.type(screen.getByLabelText(es_MX.perfil.contrasena.repite), "Nueva1!");
    await persona.click(screen.getByRole("button", { name: es_MX.perfil.contrasena.cambiar }));
    expect(changePassword).toHaveBeenCalledWith({ currentPassword: "Actual1!", newPassword: "Nueva1!" });
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/acceso?motivo=sesion"));
  });

  it("una contraseña actual incorrecta se marca EN el campo «Actual»", async () => {
    const { UnknownApiError } = await import("@/lib/api-client");
    getProfile.mockResolvedValue(perfilBase());
    changePassword.mockRejectedValue(
      new UnknownApiError(
        400,
        JSON.stringify({ timestamp: "x", statusCode: 400, code: "CUENTA_PASSWORD_INCORRECTA", message: "y" }),
      ),
    );
    const persona = userEvent.setup();
    render(<PerfilCuenta correoSoporte={null} />);
    await screen.findByText("ana@correo.mx");
    await persona.type(screen.getByLabelText(es_MX.perfil.contrasena.actual), "Mala1!");
    await persona.type(screen.getByLabelText(es_MX.perfil.contrasena.nueva), "Nueva1!");
    await persona.type(screen.getByLabelText(es_MX.perfil.contrasena.repite), "Nueva1!");
    await persona.click(screen.getByRole("button", { name: es_MX.perfil.contrasena.cambiar }));
    const campo = await screen.findByLabelText(es_MX.perfil.contrasena.actual);
    expect(campo.getAttribute("aria-invalid")).toBe("true");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("un 429 dice «espera unos minutos», sin contador", async () => {
    const { UnknownApiError } = await import("@/lib/api-client");
    getProfile.mockResolvedValue(perfilBase());
    changePassword.mockRejectedValue(
      new UnknownApiError(
        429,
        JSON.stringify({ timestamp: "x", statusCode: 429, code: "CUENTA_DEMASIADOS_INTENTOS", message: "y" }),
      ),
    );
    const persona = userEvent.setup();
    render(<PerfilCuenta correoSoporte={null} />);
    await screen.findByText("ana@correo.mx");
    await persona.type(screen.getByLabelText(es_MX.perfil.contrasena.actual), "Actual1!");
    await persona.type(screen.getByLabelText(es_MX.perfil.contrasena.nueva), "Nueva1!");
    await persona.type(screen.getByLabelText(es_MX.perfil.contrasena.repite), "Nueva1!");
    await persona.click(screen.getByRole("button", { name: es_MX.perfil.contrasena.cambiar }));
    expect(await screen.findByText(es_MX.perfil.errores.demasiadosIntentos)).not.toBeNull();
  });
});

describe("sesiones", () => {
  it("cerrar todas llama a logoutAccount (que ya borra el token) y manda a /acceso", async () => {
    getProfile.mockResolvedValue(perfilBase());
    logoutAccount.mockResolvedValue({ message: "..." });
    const persona = userEvent.setup();
    render(<PerfilCuenta correoSoporte={null} />);
    await screen.findByText("ana@correo.mx");
    await persona.click(screen.getByRole("button", { name: es_MX.perfil.sesiones.cerrarTodas }));
    expect(logoutAccount).toHaveBeenCalled();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/acceso"));
  });
});

describe("tu información: sin ruta de baja, nunca un botón muerto (G-01)", () => {
  it("con correo de soporte, ofrece un mailto: con el asunto puesto", async () => {
    getProfile.mockResolvedValue(perfilBase());
    render(<PerfilCuenta correoSoporte="soporte@linoysello.com" />);
    await screen.findByText("ana@correo.mx");
    const enlace = screen.getByRole("link", { name: es_MX.perfil.tuInformacion.pedirBaja });
    expect(enlace.getAttribute("href")).toContain("mailto:soporte@linoysello.com");
  });

  it("sin correo de soporte configurado, NO pinta un botón que no lleva a nada", async () => {
    getProfile.mockResolvedValue(perfilBase());
    render(<PerfilCuenta correoSoporte={null} />);
    await screen.findByText("ana@correo.mx");
    expect(screen.queryByRole("link", { name: es_MX.perfil.tuInformacion.pedirBaja })).toBeNull();
    expect(screen.queryByRole("button", { name: es_MX.perfil.tuInformacion.pedirBaja })).toBeNull();
    expect(screen.getByText(es_MX.perfil.tuInformacion.sinSoporte)).not.toBeNull();
  });
});
