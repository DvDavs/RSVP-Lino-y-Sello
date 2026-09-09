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

/**
 * Los campos del registro. `phone` es opcional (fase 5, E3): el DTO del alta lo acepta pero no lo
 * exige, así que solo aparece un error de este campo si la persona escribió algo y no cumplió el
 * formato (`+52` y 10 dígitos, `Patterns.kt:56`). Cualquier otra clave del cuerpo NO se pinta (ver
 * `soloTexto`).
 */
export type CampoRegistro = "email" | "password" | "name" | "lastName" | "phone";

export interface ErrorTraducido {
  readonly mensaje: string;
  /** Solo en el registro: a qué paso volver. `undefined` = el error no es de un campo. */
  readonly paso?: PasoRegistro;
  /**
   * M-12: campo del formulario al que pertenece el mensaje, para que el `Field` lo pinte con
   * `aria-invalid` y `aria-describedby` en vez de dejarlo suelto al pie del formulario.
   * `undefined` = el error no es de un campo concreto (red, servidor, código TPL_*).
   */
  readonly campo?: CampoRegistro;
}

/**
 * M-12 · «sin filtrar otras cosas». El backend antiguo no está saneado: sus mensajes pueden traer
 * una traza, una URL o el volcado de una excepción, y pintarlos tal cual convertiría el formulario
 * en un espejo del servidor. Solo pasa lo que parece una frase escrita para una persona: texto
 * plano, de una línea, con longitud de mensaje y sin marcado ni enlaces. Lo demás → `null`, y quien
 * llama usa su propia frase.
 */
export function soloTexto(crudo: string | undefined): string | null {
  if (typeof crudo !== "string") return null;
  const limpio = crudo.trim();
  if (limpio.length < 3 || limpio.length > 200) return null;
  if (/[<>{}]|https?:\/\/|\bException\b|\n/.test(limpio)) return null;
  return limpio;
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
    // M-12 · `AuthRequest` valida el CORREO y la CONTRASEÑA con las mismas anotaciones que el alta
    // (`AuthRequest.kt`: `@Email` + `@StrongPassword`), así que una contraseña que no cumple la
    // política nunca llega a compararse: sale un 400 de validación, no el 401 de credenciales. La
    // pantalla enseñaba entonces «Algo salió mal», que para la clienta es un error del producto y
    // no un error suyo. Es el mismo hecho que el 401 —esas credenciales no entran— y se dice con la
    // misma frase. La política NO se repite aquí: publicarla en el formulario de ENTRAR es
    // justamente lo que cerró UX-N-03 (`bitacora/3b-adv.md §8.1`); su sitio es «Crear cuenta».
    if (error.statusCode === 400) {
      const campos = camposConError(error.rawBody);
      if (campos["password"] || campos["email"]) return es_MX.acceso.credencialesInvalidas;
    }
  }
  return es_MX.errores.generico;
}

/**
 * Pestaña «Crear cuenta»: además del mensaje, a qué paso volver y a qué CAMPO pertenece.
 *
 * M-12 · LA POLÍTICA DE CONTRASEÑA LA ESCRIBE EL SERVIDOR. `UserRequest.password` lleva
 * `@StrongPassword(message = "Tu contraseña debe contener al menos 8 caracteres, una mayúscula, una
 * minúscula y un caracter especial")`, y ese texto es la única definición viva de la regla. Antes se
 * sustituía por una frase nuestra: dos redacciones de la misma regla que pueden divergir en cuanto
 * el backend afine la política (el defecto H-27 del proyecto), y el recorrido de uso midió a la
 * clienta leyendo un mensaje que no correspondía con lo que el servidor exigía. Ahora se pinta el
 * mensaje del servidor —pasado por `soloTexto`, que descarta trazas y marcado— y la frase propia
 * queda solo de respaldo para cuando el cuerpo no traiga nada legible.
 *
 * Los otros tres campos SÍ conservan su frase propia: los mensajes del backend antiguo para el
 * correo y el nombre están mal escritos («Debes proporcinar…») y no describen una regla que la
 * clienta pueda cumplir; el de la contraseña es el único que sí.
 */
export function traducirErrorRegistro(error: unknown): ErrorTraducido {
  const traducido = comun(error);
  if (traducido !== null) return { mensaje: traducido };
  if (error instanceof UnknownApiError) {
    const campos = camposConError(error.rawBody);
    // Correo duplicado: `GeneralExceptionHandler` lo manda bajo la clave genérica `error`.
    const generico = campos["error"] ?? "";
    if (/correo|email/i.test(generico))
      return { mensaje: es_MX.acceso.registro.correoOcupado, paso: 1, campo: "email" };
    if (campos["email"]) return { mensaje: es_MX.acceso.registro.correoInvalido, paso: 1, campo: "email" };
    if (campos["password"]) {
      return {
        mensaje: soloTexto(campos["password"]) ?? es_MX.acceso.registro.contrasenaCorta,
        paso: 2,
        campo: "password",
      };
    }
    if (campos["name"]) return { mensaje: es_MX.acceso.registro.faltaNombre, paso: 3, campo: "name" };
    if (campos["lastName"]) return { mensaje: es_MX.acceso.registro.faltaApellidos, paso: 3, campo: "lastName" };
    // Teléfono: opcional, y el ÚNICO de los cinco campos cuya frase también viene del servidor
    // (`Patterns.PHONE_NUMBER_MESSAGE`, `ADR-5-E3-05`): ya trae el formato completo y un ejemplo, y
    // duplicarla aquí sería la misma trampa H-27 que ya se evitó con la contraseña.
    if (campos["phone"]) {
      return {
        mensaje: soloTexto(campos["phone"]) ?? es_MX.acceso.registro.telefonoInvalido,
        paso: 3,
        campo: "phone",
      };
    }
    if (generico) return { mensaje: es_MX.errores.generico };
  }
  return { mensaje: es_MX.errores.generico };
}

/**
 * `code` de una de las cinco rutas de cuenta (fase 5, E3; `handoffs/5-E3-A2-contrato-cuenta.md
 * §4`). Esas rutas llevan `{timestamp, statusCode, code, message}`, pero `code` no empieza por
 * `TPL_`, así que `lib/api-client.ts` las clasifica como `UnknownApiError` (nunca `ApiError`, que
 * es solo de `templates2`) con el cuerpo crudo en `rawBody`. Aquí se lee ESE `code` — nunca el
 * `message`, que puede cambiar de redacción sin avisar (el contrato lo dice explícito: "ordena por
 * code, nunca por message"). `null` si el cuerpo no tiene esa forma.
 */
export function codigoCuenta(rawBody: string): string | null {
  try {
    const json: unknown = JSON.parse(rawBody);
    if (typeof json !== "object" || json === null) return null;
    const code = (json as { code?: unknown }).code;
    return typeof code === "string" && code.length > 0 ? code : null;
  } catch {
    return null;
  }
}

/** Igual que `codigoCuenta`, pero parte de lo que atrapa un `catch` en vez de un `rawBody` suelto. */
export function codigoCuentaDeError(error: unknown): string | null {
  if (error instanceof UnknownApiError) return codigoCuenta(error.rawBody);
  return null;
}

/**
 * El `message` para PERSONAS que trae el cuerpo de una de las rutas de cuenta — nunca el `.message`
 * de la excepción de JS, que en un `UnknownApiError` es un texto fijo del cliente
 * («Respuesta no reconocida…»), no lo que escribió el servidor. Pasado por `soloTexto`: mismo
 * criterio que el resto de este archivo, nunca se reexpone una traza o un volcado tal cual.
 */
export function mensajeCuentaDeError(error: unknown): string | null {
  if (!(error instanceof UnknownApiError)) return null;
  try {
    const json: unknown = JSON.parse(error.rawBody);
    if (typeof json !== "object" || json === null) return null;
    const mensaje = (json as { message?: unknown }).message;
    return typeof mensaje === "string" ? soloTexto(mensaje) : null;
  } catch {
    return null;
  }
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
