// components/sitio/traducir-errores.ts — de un error del backend a una frase en es-MX (U-9: «ni un
// error se pinta en inglés ni con jerga»). Funciones PURAS y sin JSX: son las que se pueden probar
// caso por caso sin montar un formulario.
//
// El módulo `auth` es el ANTIGUO: no responde `TplErrorResponse`, así que `lib/api-client.ts` lo
// clasifica como `UnknownApiError` con el cuerpo crudo. Ese cuerpo es
// `{timestamp, statusCode, errors: {campo: mensaje}}` (`InternalExceptionHandler.kt:31` para las
// validaciones de `jakarta.validation`, `GeneralExceptionHandler.kt:132` para el correo duplicado,
// con la clave `error`). Aquí se lee ESO y nada más: no se reimplementan sus reglas de validación
// en el cliente (dos validadores que divergen es el defecto H-27 del proyecto), solo se traduce lo
// que el servidor ya decidió.
import { ApiError, SessionError, UnknownApiError } from "@/lib/api-client";
import { es_MX } from "@/lib/i18n";

/** Paso del asistente de registro al que hay que devolver a la persona para corregir. */
export type PasoRegistro = 1 | 2 | 3;

export interface ErrorTraducido {
  readonly mensaje: string;
  /** Solo en el registro: a qué paso volver. `undefined` = el error no es de un campo. */
  readonly paso?: PasoRegistro;
}

/** `{"errors": {"email": "…"}}` → `{email: "…"}`; cualquier otra forma → `{}`. */
export function camposConError(cuerpo: string): Readonly<Record<string, string>> {
  try {
    const json: unknown = JSON.parse(cuerpo);
    if (typeof json !== "object" || json === null) return {};
    const errores = (json as { errors?: unknown }).errors;
    if (typeof errores !== "object" || errores === null) return {};
    const salida: Record<string, string> = {};
    for (const [clave, valor] of Object.entries(errores as Record<string, unknown>)) {
      if (typeof valor === "string") salida[clave] = valor;
    }
    return salida;
  } catch {
    return {};
  }
}

/** Errores comunes a las tres pantallas de `/acceso`. `null` = no lo sé traducir aquí. */
function comun(error: unknown): string | null {
  if (error instanceof SessionError) return es_MX.acceso.credencialesInvalidas;
  if (error instanceof ApiError) return `${es_MX.errores.generico} ${es_MX.errores.codigo(error.code)}`;
  // `fetch` no llega al servidor: en los navegadores es un `TypeError`, no un error HTTP.
  if (error instanceof TypeError) return es_MX.errores.sinRed;
  return null;
}

/** Pestaña «Entrar». El 401 del backend es SIEMPRE «no coinciden»: nunca «ese correo no existe». */
export function traducirErrorAcceso(error: unknown): string {
  const traducido = comun(error);
  if (traducido !== null) return traducido;
  if (error instanceof UnknownApiError) {
    if (error.statusCode === 401 || error.statusCode === 403) return es_MX.acceso.credencialesInvalidas;
    if (error.statusCode === 429) return es_MX.errores.generico;
  }
  return es_MX.errores.generico;
}

/** Pestaña «Crear cuenta»: además del mensaje, a qué paso volver para poder corregirlo. */
export function traducirErrorRegistro(error: unknown): ErrorTraducido {
  const traducido = comun(error);
  if (traducido !== null) return { mensaje: traducido };
  if (error instanceof UnknownApiError) {
    const campos = camposConError(error.rawBody);
    // Correo duplicado: `GeneralExceptionHandler` lo manda bajo la clave genérica `error`.
    const generico = campos["error"] ?? "";
    if (/correo|email/i.test(generico)) return { mensaje: es_MX.acceso.registro.correoOcupado, paso: 1 };
    if (campos["email"]) return { mensaje: es_MX.acceso.registro.correoInvalido, paso: 1 };
    if (campos["password"]) return { mensaje: es_MX.acceso.registro.contrasenaCorta, paso: 2 };
    if (campos["name"]) return { mensaje: es_MX.acceso.registro.faltaNombre, paso: 3 };
    if (campos["lastName"]) return { mensaje: es_MX.acceso.registro.faltaApellidos, paso: 3 };
    if (generico) return { mensaje: es_MX.errores.generico };
  }
  return { mensaje: es_MX.errores.generico };
}

/**
 * Un `?volver=` solo puede ser una ruta interna: `?volver=https://otro-sitio` convertiría `/acceso`
 * en un redirector abierto. Se conserva tal cual estaba en la pantalla de la fase 3.
 */
export function destinoSeguro(crudo: string | null): string {
  if (!crudo) return "/editor";
  if (!crudo.startsWith("/") || crudo.startsWith("//")) return "/editor";
  return crudo;
}
