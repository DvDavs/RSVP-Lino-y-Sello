// components/sitio/traducir-errores.test.ts — U-9: ni un error en inglés ni con jerga, y ninguno
// que revele si una cuenta existe.
import { describe, expect, it } from "vitest";
import { ApiError, SessionError, UnknownApiError } from "@/lib/api-client";
import { es_MX } from "@/lib/i18n";
import {
  camposConError,
  destinoSeguro,
  soloTexto,
  traducirErrorAcceso,
  traducirErrorRegistro,
} from "./traducir-errores.ts";

/** El texto literal de `@StrongPassword` en `AuthRequest.kt` y `UserRequest.kt`. */
const POLITICA =
  "Tu contraseña debe contener al menos 8 caracteres, una mayúscula, una minúscula y un caracter especial";

function validacion400(errores: Record<string, string>): UnknownApiError {
  return new UnknownApiError(400, JSON.stringify({ timestamp: "x", statusCode: 400, errors: errores }));
}

const cuerpoTpl = { timestamp: "2026-09-06T00:00:00Z", statusCode: 422, code: "TPL_EVENT_DATE_INVALID", message: "x" };

describe("acceso", () => {
  it("un 401 de la cadena de filtros dice «no coinciden», nunca «ese correo no existe»", () => {
    expect(traducirErrorAcceso(new SessionError(401, ""))).toBe(es_MX.acceso.credencialesInvalidas);
    expect(traducirErrorAcceso(new UnknownApiError(401, "Unauthorized"))).toBe(es_MX.acceso.credencialesInvalidas);
  });

  it("la red caída se distingue del servidor caído", () => {
    expect(traducirErrorAcceso(new TypeError("Failed to fetch"))).toBe(es_MX.errores.sinRed);
  });

  it("un error tipado del backend conserva su código para poder reportarlo", () => {
    const mensaje = traducirErrorAcceso(new ApiError(cuerpoTpl, 422));
    expect(mensaje).toContain(es_MX.errores.codigo("TPL_EVENT_DATE_INVALID"));
  });

  it("lo que no se sabe traducir NO se pinta crudo en inglés", () => {
    expect(traducirErrorAcceso(new Error("Internal Server Error"))).toBe(es_MX.errores.generico);
  });

  // M-12. `AuthRequest` valida la contraseña con `@StrongPassword`, así que una contraseña que no
  // cumple la política sale como 400 de validación y NUNCA llega al 401. La pantalla decía «Algo
  // salió mal», que la clienta lee como una avería del producto y no como un dato suyo mal escrito.
  it("un 400 de validación al ENTRAR se dice como lo que es: esas credenciales no entran", () => {
    expect(traducirErrorAcceso(validacion400({ password: POLITICA }))).toBe(es_MX.acceso.credencialesInvalidas);
    expect(traducirErrorAcceso(validacion400({ email: "Debes proporcinar un correo electrónico válido" }))).toBe(
      es_MX.acceso.credencialesInvalidas,
    );
  });

  it("y NO publica la política de contraseñas en el formulario de entrar (UX-N-03)", () => {
    expect(traducirErrorAcceso(validacion400({ password: POLITICA }))).not.toContain("mayúscula");
  });

  it("un 400 que no es de esos dos campos sigue siendo genérico: no se inventa una causa", () => {
    expect(traducirErrorAcceso(validacion400({ otro: "x" }))).toBe(es_MX.errores.generico);
  });
});

describe("registro", () => {
  function respuesta(errores: Record<string, string>, estado = 400): UnknownApiError {
    return new UnknownApiError(estado, JSON.stringify({ timestamp: "x", statusCode: estado, errors: errores }));
  }

  it("devuelve al paso del campo que el servidor rechazó, y dice CUÁL es el campo", () => {
    expect(traducirErrorRegistro(respuesta({ password: POLITICA }))).toEqual({
      mensaje: POLITICA,
      paso: 2,
      campo: "password",
    });
    expect(traducirErrorRegistro(respuesta({ email: "mal" }))).toMatchObject({ paso: 1, campo: "email" });
    expect(traducirErrorRegistro(respuesta({ name: "mal" }))).toMatchObject({ paso: 3, campo: "name" });
    expect(traducirErrorRegistro(respuesta({ lastName: "mal" }))).toMatchObject({ paso: 3, campo: "lastName" });
  });

  // M-12: la política de contraseñas la escribe el backend (`@StrongPassword`). Repetirla aquí es
  // el defecto H-27 (dos validadores que divergen), así que se pinta la del servidor tal cual.
  it("la contraseña enseña la política LITERAL del servidor, no una paráfrasis nuestra", () => {
    expect(traducirErrorRegistro(respuesta({ password: POLITICA })).mensaje).toBe(POLITICA);
  });

  it("pero no se pinta cualquier cosa que venga del servidor: solo una frase para una persona", () => {
    expect(soloTexto("<b>NullPointerException</b>")).toBeNull();
    expect(soloTexto("java.lang.Exception: boom")).toBeNull();
    expect(soloTexto("mira http://interno.local/logs")).toBeNull();
    expect(soloTexto("x")).toBeNull();
    expect(soloTexto("a".repeat(201))).toBeNull();
    expect(soloTexto("  La contraseña es muy corta.  ")).toBe("La contraseña es muy corta.");
    // Y cuando no hay nada legible, la frase propia sigue de respaldo.
    expect(traducirErrorRegistro(respuesta({ password: "<script>x</script>" }))).toEqual({
      mensaje: es_MX.acceso.registro.contrasenaCorta,
      paso: 2,
      campo: "password",
    });
  });

  it("el correo duplicado llega bajo la clave genérica `error` y se reconoce igual", () => {
    expect(traducirErrorRegistro(respuesta({ error: "El correo ya está registrado" }))).toEqual({
      mensaje: es_MX.acceso.registro.correoOcupado,
      paso: 1,
      campo: "email",
    });
  });

  it("un cuerpo que no es JSON no rompe nada", () => {
    expect(camposConError("<html>502</html>")).toEqual({});
    expect(traducirErrorRegistro(respuesta({}))).toEqual({ mensaje: es_MX.errores.generico });
  });
});

describe("`?volver=` no puede convertir /acceso en un redirector abierto", () => {
  it.each([
    [null, "/editor"],
    ["https://otro-sitio.mx", "/editor"],
    ["//otro-sitio.mx", "/editor"],
    ["/editor/12", "/editor/12"],
  ])("%s → %s", (entrada, esperado) => {
    expect(destinoSeguro(entrada)).toBe(esperado);
  });
});
