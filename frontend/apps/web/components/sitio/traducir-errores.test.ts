// components/sitio/traducir-errores.test.ts — U-9: ni un error en inglés ni con jerga, y ninguno
// que revele si una cuenta existe.
import { describe, expect, it } from "vitest";
import { ApiError, SessionError, UnknownApiError } from "@/lib/api-client";
import { es_MX } from "@/lib/i18n";
import { camposConError, destinoSeguro, traducirErrorAcceso, traducirErrorRegistro } from "./traducir-errores.ts";

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
});

describe("registro", () => {
  function respuesta(errores: Record<string, string>, estado = 400): UnknownApiError {
    return new UnknownApiError(estado, JSON.stringify({ timestamp: "x", statusCode: estado, errors: errores }));
  }

  it("devuelve al paso del campo que el servidor rechazó", () => {
    expect(traducirErrorRegistro(respuesta({ password: "débil" }))).toEqual({
      mensaje: es_MX.acceso.registro.contrasenaCorta,
      paso: 2,
    });
    expect(traducirErrorRegistro(respuesta({ email: "mal" })).paso).toBe(1);
    expect(traducirErrorRegistro(respuesta({ name: "mal" })).paso).toBe(3);
    expect(traducirErrorRegistro(respuesta({ lastName: "mal" })).paso).toBe(3);
  });

  it("el correo duplicado llega bajo la clave genérica `error` y se reconoce igual", () => {
    expect(traducirErrorRegistro(respuesta({ error: "El correo ya está registrado" }))).toEqual({
      mensaje: es_MX.acceso.registro.correoOcupado,
      paso: 1,
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
