// components/sitio/VerificarCorreo.test.tsx — `/verificar-correo`: la ruta que el correo del
// backend ya manda y que antes de esta pantalla caía en un 404 (fase 5, E3).
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VerificarCorreo } from "./VerificarCorreo.tsx";
import { es_MX } from "@/lib/i18n";

const parametros = vi.hoisted(() => new URLSearchParams());
vi.mock("next/navigation", () => ({
  useSearchParams: () => parametros,
}));

const authVerifyEmail = vi.hoisted(() => vi.fn());
const authResendVerification = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", async (importarReal) => {
  const real = await importarReal<typeof import("@/lib/api-client")>();
  return { ...real, authVerifyEmail, authResendVerification };
});

beforeEach(() => {
  authVerifyEmail.mockReset();
  authResendVerification.mockReset();
  for (const clave of [...parametros.keys()]) parametros.delete(clave);
});

describe("sin token en la URL", () => {
  it("dice que el enlace no trae el código, sin llamar al backend", () => {
    render(<VerificarCorreo />);
    expect(screen.getByRole("heading", { name: es_MX.cuenta.verificarCorreo.sinToken.titulo })).not.toBeNull();
    expect(authVerifyEmail).not.toHaveBeenCalled();
  });
});

describe("con token: verificando y verificado", () => {
  it("llama a authVerifyEmail con el token de la URL y enseña el mensaje que manda el servidor", async () => {
    parametros.set("token", "tok-123");
    authVerifyEmail.mockResolvedValue({ message: "Tu correo quedó verificado" });
    render(<VerificarCorreo />);
    await waitFor(() => expect(authVerifyEmail).toHaveBeenCalledWith({ token: "tok-123" }));
    expect(await screen.findByText("Tu correo quedó verificado")).not.toBeNull();
    expect(screen.getByRole("link", { name: es_MX.cuenta.verificarCorreo.verificado.entrar }).getAttribute("href")).toBe(
      "/acceso",
    );
  });

  it("una confirmación de cambio de correo enseña SU propio mensaje (el mismo backend, otro texto)", async () => {
    parametros.set("token", "tok-cambio");
    authVerifyEmail.mockResolvedValue({
      message: "Tu correo quedó verificado y es el nuevo correo de acceso. Vuelve a iniciar sesión.",
    });
    render(<VerificarCorreo />);
    expect(await screen.findByText(/Vuelve a iniciar sesión/)).not.toBeNull();
  });
});

describe("token inválido o caducado: los dos ofrecen reenviar", () => {
  it("CUENTA_TOKEN_INVALIDO ofrece pedir uno nuevo", async () => {
    const { UnknownApiError } = await import("@/lib/api-client");
    parametros.set("token", "tok-usado");
    authVerifyEmail.mockRejectedValue(
      new UnknownApiError(
        400,
        JSON.stringify({ timestamp: "x", statusCode: 400, code: "CUENTA_TOKEN_INVALIDO", message: "y" }),
      ),
    );
    render(<VerificarCorreo />);
    expect(await screen.findByRole("heading", { name: es_MX.cuenta.verificarCorreo.tokenInvalido.titulo })).not.toBeNull();
    expect(screen.getByRole("button", { name: es_MX.cuenta.verificarCorreo.reenvio.enviar })).not.toBeNull();
  });

  it("CUENTA_TOKEN_CADUCADO también ofrece pedir uno nuevo, con su propio texto", async () => {
    const { UnknownApiError } = await import("@/lib/api-client");
    parametros.set("token", "tok-viejo");
    authVerifyEmail.mockRejectedValue(
      new UnknownApiError(
        400,
        JSON.stringify({ timestamp: "x", statusCode: 400, code: "CUENTA_TOKEN_CADUCADO", message: "y" }),
      ),
    );
    render(<VerificarCorreo />);
    expect(await screen.findByRole("heading", { name: es_MX.cuenta.verificarCorreo.tokenCaducado.titulo })).not.toBeNull();
  });

  it("el panel de reenvío manda SIEMPRE el mismo mensaje genérico, exista o no la cuenta", async () => {
    const persona = userEvent.setup();
    const { UnknownApiError } = await import("@/lib/api-client");
    parametros.set("token", "tok-usado");
    authVerifyEmail.mockRejectedValue(
      new UnknownApiError(
        400,
        JSON.stringify({ timestamp: "x", statusCode: 400, code: "CUENTA_TOKEN_INVALIDO", message: "y" }),
      ),
    );
    authResendVerification.mockResolvedValue({ message: "..." });
    render(<VerificarCorreo />);
    await screen.findByRole("heading", { name: es_MX.cuenta.verificarCorreo.tokenInvalido.titulo });
    await persona.type(screen.getByLabelText(es_MX.cuenta.verificarCorreo.reenvio.correo), "ana@correo.mx");
    await persona.click(screen.getByRole("button", { name: es_MX.cuenta.verificarCorreo.reenvio.enviar }));
    expect(authResendVerification).toHaveBeenCalledWith({ email: "ana@correo.mx" });
    expect(await screen.findByText(es_MX.cuenta.verificarCorreo.reenvio.enviado)).not.toBeNull();
  });

  it("un 429 al reenviar dice «espera unos minutos», sin contador", async () => {
    const persona = userEvent.setup();
    const { UnknownApiError } = await import("@/lib/api-client");
    parametros.set("token", "tok-usado");
    authVerifyEmail.mockRejectedValue(
      new UnknownApiError(
        400,
        JSON.stringify({ timestamp: "x", statusCode: 400, code: "CUENTA_TOKEN_INVALIDO", message: "y" }),
      ),
    );
    authResendVerification.mockRejectedValue(
      new UnknownApiError(
        429,
        JSON.stringify({ timestamp: "x", statusCode: 429, code: "CUENTA_DEMASIADOS_INTENTOS", message: "y" }),
      ),
    );
    render(<VerificarCorreo />);
    await screen.findByRole("heading", { name: es_MX.cuenta.verificarCorreo.tokenInvalido.titulo });
    await persona.type(screen.getByLabelText(es_MX.cuenta.verificarCorreo.reenvio.correo), "ana@correo.mx");
    await persona.click(screen.getByRole("button", { name: es_MX.cuenta.verificarCorreo.reenvio.enviar }));
    expect(await screen.findByText(es_MX.cuenta.verificarCorreo.demasiadosIntentos)).not.toBeNull();
    expect(screen.queryByText(/\d+\s*(segundos|minutos)/)).toBeNull();
  });
});

describe("un error que no es de código conocido (500, red) enseña el estado de error genérico", () => {
  it("CUENTA_ERROR_INTERNO no se enseña tal cual: se trata como «vuelve a intentarlo»", async () => {
    const { UnknownApiError } = await import("@/lib/api-client");
    parametros.set("token", "tok-x");
    authVerifyEmail.mockRejectedValue(
      new UnknownApiError(
        500,
        JSON.stringify({
          timestamp: "x",
          statusCode: 500,
          code: "CUENTA_ERROR_INTERNO",
          message: "No se pudo completar la operación. Inténtalo de nuevo.",
        }),
      ),
    );
    render(<VerificarCorreo />);
    expect(await screen.findByRole("heading", { name: es_MX.cuenta.verificarCorreo.error.titulo })).not.toBeNull();
  });
});
