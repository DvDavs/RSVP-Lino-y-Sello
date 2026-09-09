// components/sitio/AsistenteAcceso.test.tsx — la pantalla que hizo abandonar la revisión de uso
// (U-1), ahora con sus tres caminos. Lo que se prueba es lo que una persona hace: pulsar la
// pestaña, escribir, equivocarse y volver a intentarlo.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AsistenteAcceso } from "./AsistenteAcceso.tsx";
import { es_MX } from "@/lib/i18n";

const replace = vi.hoisted(() => vi.fn());
const parametros = vi.hoisted(() => new URLSearchParams());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => parametros,
}));

const authLogin = vi.hoisted(() => vi.fn());
const authSignup = vi.hoisted(() => vi.fn());
const authRequestPasswordReset = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", async (importarReal) => {
  const real = await importarReal<typeof import("@/lib/api-client")>();
  return { ...real, authLogin, authSignup, authRequestPasswordReset };
});

beforeEach(() => {
  replace.mockReset();
  authLogin.mockReset();
  authSignup.mockReset();
  authRequestPasswordReset.mockReset();
  for (const clave of [...parametros.keys()]) parametros.delete(clave);
});

describe("entrar", () => {
  it("es la pestaña de partida, con el titular exacto de `11 §7`", () => {
    render(<AsistenteAcceso />);
    expect(screen.getByRole("heading", { name: es_MX.acceso.titulo }).textContent).toBe(es_MX.acceso.titulo);
    expect(screen.getByRole("tab", { name: es_MX.acceso.pestanaEntrar }).getAttribute("aria-selected")).toBe("true");
  });

  it("no manda un formulario vacío al servidor: lo dice antes", async () => {
    const persona = userEvent.setup();
    render(<AsistenteAcceso />);
    await persona.click(screen.getByRole("button", { name: es_MX.acceso.entrar }));
    expect(screen.getByRole("alert").textContent).toBe(es_MX.acceso.faltaCorreo);
    expect(authLogin).not.toHaveBeenCalled();
  });

  it("con credenciales buenas entra y REEMPLAZA la entrada del historial", async () => {
    const persona = userEvent.setup();
    authLogin.mockResolvedValue({ accessToken: "t" });
    render(<AsistenteAcceso />);
    await persona.type(screen.getByLabelText(es_MX.acceso.correo), "ana@correo.mx");
    await persona.type(screen.getByLabelText(es_MX.acceso.contrasena), "Secreta1!");
    await persona.click(screen.getByRole("button", { name: es_MX.acceso.entrar }));
    expect(authLogin).toHaveBeenCalledWith({ email: "ana@correo.mx", password: "Secreta1!" });
    expect(replace).toHaveBeenCalledWith("/editor");
  });

  it("`?volver=` interno se respeta; uno externo NO (redirector abierto)", async () => {
    const persona = userEvent.setup();
    parametros.set("volver", "https://otro-sitio.mx");
    authLogin.mockResolvedValue({ accessToken: "t" });
    render(<AsistenteAcceso />);
    await persona.type(screen.getByLabelText(es_MX.acceso.correo), "ana@correo.mx");
    await persona.type(screen.getByLabelText(es_MX.acceso.contrasena), "Secreta1!");
    await persona.click(screen.getByRole("button", { name: es_MX.acceso.entrar }));
    expect(replace).toHaveBeenCalledWith("/editor");
  });

  it("`?motivo=sesion` avisa de que la sesión terminó, sin acusar a nadie", () => {
    parametros.set("motivo", "sesion");
    render(<AsistenteAcceso />);
    expect(screen.getByRole("status").textContent).toBe(es_MX.acceso.sesionTerminada);
  });
});

describe("recuperar la contraseña", () => {
  it("contesta SIEMPRE lo mismo, exista o no la cuenta (N-01)", async () => {
    const persona = userEvent.setup();
    authRequestPasswordReset.mockRejectedValue(new Error("404"));
    render(<AsistenteAcceso />);
    await persona.click(screen.getByRole("button", { name: es_MX.acceso.olvide }));
    await persona.type(screen.getByLabelText(es_MX.acceso.correo), "no-existe@correo.mx");
    await persona.click(screen.getByRole("button", { name: es_MX.acceso.recuperar.enviar }));
    expect(screen.getByRole("status").textContent).toBe(es_MX.acceso.recuperar.enviado);
  });

  it("se puede volver a la pantalla de entrar sin recargar", async () => {
    const persona = userEvent.setup();
    render(<AsistenteAcceso />);
    await persona.click(screen.getByRole("button", { name: es_MX.acceso.olvide }));
    await persona.click(screen.getByRole("button", { name: es_MX.acceso.recuperar.volver }));
    expect(screen.getByRole("heading", { name: es_MX.acceso.titulo })).not.toBeNull();
  });
});

describe("crear cuenta", () => {
  async function abrirRegistro(persona: ReturnType<typeof userEvent.setup>): Promise<void> {
    await persona.click(screen.getByRole("tab", { name: es_MX.acceso.pestanaCrearCuenta }));
  }

  it("son tres pasos y el progreso lo dice en texto, no solo en color", async () => {
    const persona = userEvent.setup();
    render(<AsistenteAcceso />);
    await abrirRegistro(persona);
    expect(screen.getByRole("heading", { name: es_MX.acceso.registro.titulo })).not.toBeNull();
    expect(screen.getByText(/Paso 1 de 3/)).not.toBeNull();
  });

  it("recorre correo, contraseña y nombre, y crea la cuenta con los cuatro datos", async () => {
    const persona = userEvent.setup();
    authSignup.mockResolvedValue({ accessToken: "t" });
    render(<AsistenteAcceso />);
    await abrirRegistro(persona);

    await persona.type(screen.getByLabelText(es_MX.acceso.correo), "ana@correo.mx");
    await persona.click(screen.getByRole("button", { name: es_MX.acceso.registro.continuar }));
    await persona.type(screen.getByLabelText(es_MX.acceso.contrasena), "Secreta1!");
    await persona.click(screen.getByRole("button", { name: es_MX.acceso.registro.continuar }));
    await persona.type(screen.getByLabelText(es_MX.acceso.registro.nombre), "Ana");
    await persona.type(screen.getByLabelText(es_MX.acceso.registro.apellidos), "Torres");
    await persona.click(screen.getByRole("button", { name: es_MX.acceso.registro.crear }));

    expect(authSignup).toHaveBeenCalledWith({
      name: "Ana",
      lastName: "Torres",
      email: "ana@correo.mx",
      password: "Secreta1!",
    });
    expect(replace).toHaveBeenCalledWith("/editor");
  });

  it("no deja avanzar con el campo del paso vacío", async () => {
    const persona = userEvent.setup();
    render(<AsistenteAcceso />);
    await abrirRegistro(persona);
    await persona.click(screen.getByRole("button", { name: es_MX.acceso.registro.continuar }));
    expect(screen.getByRole("alert").textContent).toBe(es_MX.acceso.faltaCorreo);
  });

  // M-12. Antes: el 400 con la política salía como «Algo salió mal» (pestaña Entrar) o como una
  // paráfrasis nuestra suelta al pie del formulario (pestaña Crear cuenta). Ahora el mensaje del
  // servidor se pinta EN el campo, con `aria-invalid` y `aria-describedby`, que es lo que hace que
  // un lector de pantalla lo lea al enfocar la contraseña y no al final de todo.
  it("si el servidor rechaza la contraseña, DEVUELVE al paso 2 con la política EN el campo", async () => {
    const persona = userEvent.setup();
    const politica =
      "Tu contraseña debe contener al menos 8 caracteres, una mayúscula, una minúscula y un caracter especial";
    const { UnknownApiError } = await import("@/lib/api-client");
    authSignup.mockRejectedValue(
      new UnknownApiError(400, JSON.stringify({ timestamp: "x", statusCode: 400, errors: { password: politica } })),
    );
    render(<AsistenteAcceso />);
    await abrirRegistro(persona);
    await persona.type(screen.getByLabelText(es_MX.acceso.correo), "ana@correo.mx");
    await persona.click(screen.getByRole("button", { name: es_MX.acceso.registro.continuar }));
    await persona.type(screen.getByLabelText(es_MX.acceso.contrasena), "corta");
    await persona.click(screen.getByRole("button", { name: es_MX.acceso.registro.continuar }));
    await persona.type(screen.getByLabelText(es_MX.acceso.registro.nombre), "Ana");
    await persona.type(screen.getByLabelText(es_MX.acceso.registro.apellidos), "Torres");
    await persona.click(screen.getByRole("button", { name: es_MX.acceso.registro.crear }));

    expect(screen.getByText(/Paso 2 de 3/)).not.toBeNull();
    expect(screen.getByRole("alert").textContent).toContain(politica);
    // Nunca «Algo salió mal»: la clienta no leyó una avería, leyó lo que tiene que corregir.
    expect(screen.queryByText(es_MX.errores.generico)).toBeNull();

    const campo = screen.getByLabelText(es_MX.acceso.contrasena);
    expect(campo.getAttribute("aria-invalid")).toBe("true");
    const descrito = campo.getAttribute("aria-describedby");
    expect(descrito).not.toBeNull();
    expect(document.getElementById(descrito as string)?.textContent).toContain(politica);
  });

  // Fase 5, E3 (contrato §5.1/§A2.1): la cuenta nace sin verificar y ENTRA igual — se dice antes de
  // crear la cuenta, junto al correo del paso 1.
  it("avisa, en el paso 1, de que la cuenta nace sin verificar y aun así entra", async () => {
    const persona = userEvent.setup();
    render(<AsistenteAcceso />);
    await abrirRegistro(persona);
    expect(screen.getByText(es_MX.acceso.registro.avisoSinVerificar)).not.toBeNull();
  });

  // Fase 5, E3: teléfono opcional en el paso 3, con el formato dicho ANTES de que falle.
  it("el paso 3 ofrece un teléfono opcional con el formato dicho de antemano", async () => {
    const persona = userEvent.setup();
    render(<AsistenteAcceso />);
    await abrirRegistro(persona);
    await persona.type(screen.getByLabelText(es_MX.acceso.correo), "ana@correo.mx");
    await persona.click(screen.getByRole("button", { name: es_MX.acceso.registro.continuar }));
    await persona.type(screen.getByLabelText(es_MX.acceso.contrasena), "Secreta1!");
    await persona.click(screen.getByRole("button", { name: es_MX.acceso.registro.continuar }));
    expect(screen.getByText(es_MX.acceso.registro.ayudaTelefono)).not.toBeNull();
  });

  it("crea la cuenta SIN teléfono si se deja vacío: nunca manda phone: \"\"", async () => {
    const persona = userEvent.setup();
    authSignup.mockResolvedValue({ accessToken: "t" });
    render(<AsistenteAcceso />);
    await abrirRegistro(persona);
    await persona.type(screen.getByLabelText(es_MX.acceso.correo), "ana@correo.mx");
    await persona.click(screen.getByRole("button", { name: es_MX.acceso.registro.continuar }));
    await persona.type(screen.getByLabelText(es_MX.acceso.contrasena), "Secreta1!");
    await persona.click(screen.getByRole("button", { name: es_MX.acceso.registro.continuar }));
    await persona.type(screen.getByLabelText(es_MX.acceso.registro.nombre), "Ana");
    await persona.type(screen.getByLabelText(es_MX.acceso.registro.apellidos), "Torres");
    await persona.click(screen.getByRole("button", { name: es_MX.acceso.registro.crear }));
    expect(authSignup).toHaveBeenCalledWith({
      name: "Ana",
      lastName: "Torres",
      email: "ana@correo.mx",
      password: "Secreta1!",
      phone: undefined,
    });
  });

  it("crea la cuenta CON el teléfono cuando se escribe", async () => {
    const persona = userEvent.setup();
    authSignup.mockResolvedValue({ accessToken: "t" });
    render(<AsistenteAcceso />);
    await abrirRegistro(persona);
    await persona.type(screen.getByLabelText(es_MX.acceso.correo), "ana@correo.mx");
    await persona.click(screen.getByRole("button", { name: es_MX.acceso.registro.continuar }));
    await persona.type(screen.getByLabelText(es_MX.acceso.contrasena), "Secreta1!");
    await persona.click(screen.getByRole("button", { name: es_MX.acceso.registro.continuar }));
    await persona.type(screen.getByLabelText(es_MX.acceso.registro.nombre), "Ana");
    await persona.type(screen.getByLabelText(es_MX.acceso.registro.apellidos), "Torres");
    await persona.type(screen.getByLabelText(es_MX.acceso.registro.telefono), "+525512345678");
    await persona.click(screen.getByRole("button", { name: es_MX.acceso.registro.crear }));
    expect(authSignup).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "+525512345678" }),
    );
  });

  it("un teléfono rechazado por el servidor vuelve al paso 3 con el error EN el campo", async () => {
    const persona = userEvent.setup();
    const { UnknownApiError } = await import("@/lib/api-client");
    const mensajeServidor =
      "El teléfono debe llevar la lada de México: +52 y 10 dígitos, sin espacios ni guiones. Por ejemplo: +525512345678";
    authSignup.mockRejectedValue(
      new UnknownApiError(400, JSON.stringify({ timestamp: "x", statusCode: 400, errors: { phone: mensajeServidor } })),
    );
    render(<AsistenteAcceso />);
    await abrirRegistro(persona);
    await persona.type(screen.getByLabelText(es_MX.acceso.correo), "ana@correo.mx");
    await persona.click(screen.getByRole("button", { name: es_MX.acceso.registro.continuar }));
    await persona.type(screen.getByLabelText(es_MX.acceso.contrasena), "Secreta1!");
    await persona.click(screen.getByRole("button", { name: es_MX.acceso.registro.continuar }));
    await persona.type(screen.getByLabelText(es_MX.acceso.registro.nombre), "Ana");
    await persona.type(screen.getByLabelText(es_MX.acceso.registro.apellidos), "Torres");
    await persona.type(screen.getByLabelText(es_MX.acceso.registro.telefono), "5512345678");
    await persona.click(screen.getByRole("button", { name: es_MX.acceso.registro.crear }));

    expect(screen.getByText(/Paso 3 de 3/)).not.toBeNull();
    const campo = screen.getByLabelText(es_MX.acceso.registro.telefono);
    expect(campo.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toContain(mensajeServidor);
  });

  it("el error del correo se pinta en el campo del correo, no al pie del formulario", async () => {
    const persona = userEvent.setup();
    const { UnknownApiError } = await import("@/lib/api-client");
    authSignup.mockRejectedValue(
      new UnknownApiError(
        400,
        JSON.stringify({ timestamp: "x", statusCode: 400, errors: { error: "El correo ya está registrado" } }),
      ),
    );
    render(<AsistenteAcceso />);
    await abrirRegistro(persona);
    await persona.type(screen.getByLabelText(es_MX.acceso.correo), "ana@correo.mx");
    await persona.click(screen.getByRole("button", { name: es_MX.acceso.registro.continuar }));
    await persona.type(screen.getByLabelText(es_MX.acceso.contrasena), "Secreta1!");
    await persona.click(screen.getByRole("button", { name: es_MX.acceso.registro.continuar }));
    await persona.type(screen.getByLabelText(es_MX.acceso.registro.nombre), "Ana");
    await persona.type(screen.getByLabelText(es_MX.acceso.registro.apellidos), "Torres");
    await persona.click(screen.getByRole("button", { name: es_MX.acceso.registro.crear }));

    const campo = screen.getByLabelText(es_MX.acceso.correo);
    expect(campo.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toContain(es_MX.acceso.registro.correoOcupado);
  });
});
