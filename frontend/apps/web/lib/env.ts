// lib/env.ts — EL CATÁLOGO de las variables de entorno que el frontend lee (fase 5, andamio 5-0d).
//
// POR QUÉ EXISTE. Hasta ahora cada variable se leía donde hacía falta y no había ningún sitio que
// dijera cuáles hay, quién las usa y qué pasa si falta una. Con cuatro sesiones escribiendo la fase
// 5 a la vez, eso acaba en dos nombres para el mismo dato (el caso real: casi se crea un
// `NEXT_PUBLIC_SITIO_URL` teniendo ya `NEXT_PUBLIC_SITE_URL`, lo que habría repartido enlaces con
// dos orígenes distintos a los invitados de la misma clienta). Este fichero es la lista cerrada.
//
// QUÉ NO ES. NO es la fuente de los datos que ya tienen la suya. Cada variable tiene UN dueño y aquí
// se dice quién es:
//   NEXT_PUBLIC_CONTACTO_WHATSAPP  → `lib/contacto.ts`        (canales de venta; G-01)
//   NEXT_PUBLIC_CONTACTO_CORREO    → `lib/contacto.ts`
//   NEXT_PUBLIC_SITE_URL           → `lib/enlace-publico.ts`  (origen público; U-6 / ADR-3C-N02-01)
//   NEXT_PUBLIC_E2E_HOOKS          → `lib/manifest.ts` y el editor (ganchos de prueba)
//   NEXT_PUBLIC_SOPORTE_CORREO     → aquí (nueva, fase 5)
//   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY → aquí (nueva, fase 5, la lee E4)
// De las cuatro primeras este módulo REEXPORTA la lectura de su dueño y no reimplementa ni una
// línea de su lógica: `contacto.ts` sigue decidiendo qué es un teléfono y `enlace-publico.ts` sigue
// decidiendo con qué origen se construye el enlace que se reparte (`window.location.origin` primero,
// la variable después — la variable se hornea en el build y puede ser una foto vieja, N-02).
//
// FORMA, igual que `lib/contacto.ts`: funciones PURAS sobre un mapa de entorno, probadas caso por
// caso sin tocar `process.env` global, más una función por dato que lee el entorno REAL dentro de la
// función (nunca en el módulo) para que `next start` recoja el valor sin volver a compilar.
//
// REGLA QUE NO SE ROMPE: toda variable es OPCIONAL y, cuando falta, la interfaz es HONESTA — dice
// que eso todavía no está, nunca pinta un botón que no lleva a ningún sitio (G-01).
import { contactoDelEntorno, leerContacto, normalizarCorreo, type ContactoDeVenta } from "./contacto.ts";
import { enlacePublico, esOrigenLocal, origenPublico } from "./enlace-publico.ts";

// ── Reexportes: quien necesite el dato lo pide aquí y llega a su dueño sin copiar nada ───────────
export { contactoDelEntorno, leerContacto, origenPublico, enlacePublico };
export type { ContactoDeVenta };

/** Las seis variables `NEXT_PUBLIC_*` del frontend. Lista CERRADA: añadir una es un ADR. */
export type NombreDeVariable =
  | "NEXT_PUBLIC_CONTACTO_WHATSAPP"
  | "NEXT_PUBLIC_CONTACTO_CORREO"
  | "NEXT_PUBLIC_SITE_URL"
  | "NEXT_PUBLIC_E2E_HOOKS"
  | "NEXT_PUBLIC_SOPORTE_CORREO"
  | "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY";

export interface FichaDeVariable {
  readonly nombre: NombreDeVariable;
  /** Módulo que manda sobre este dato. `lib/env.ts` solo cuando el dato nace en la fase 5. */
  readonly fuente: string;
  readonly paraQue: string;
  /** Todas opcionales, a propósito: el producto arranca sin ninguna y lo dice en pantalla. */
  readonly obligatoria: false;
  readonly siFalta: string;
}

export const CATALOGO: readonly FichaDeVariable[] = [
  {
    nombre: "NEXT_PUBLIC_CONTACTO_WHATSAPP",
    fuente: "lib/contacto.ts",
    paraQue: "Número de WhatsApp por el que se contrata un plan (E.164).",
    obligatoria: false,
    siFalta: "No se pinta el botón de WhatsApp; el bloque de contacto dice que aún no hay medio publicado.",
  },
  {
    nombre: "NEXT_PUBLIC_CONTACTO_CORREO",
    fuente: "lib/contacto.ts",
    paraQue: "Correo de ventas al que escribe quien todavía no ha contratado.",
    obligatoria: false,
    siFalta: "No se pinta el enlace de correo; misma frase honesta que arriba.",
  },
  {
    nombre: "NEXT_PUBLIC_SITE_URL",
    fuente: "lib/enlace-publico.ts",
    paraQue: "Origen público del sitio para SSR y metadatos (en el navegador manda `window.location.origin`).",
    obligatoria: false,
    siFalta:
      "En el navegador no se nota (el origen navegado gana). En SSR el enlace cae al `publicUrl` del servidor, que puede ser `localhost` (U-6); en un despliegue real `motivoDeArranqueInvalido` impide arrancar así.",
  },
  {
    nombre: "NEXT_PUBLIC_E2E_HOOKS",
    fuente: "lib/manifest.ts · app/(chrome)/editor/[invitationId]/page.tsx",
    paraQue: "Vale `1` SOLO en las compuertas de prueba: expone `window.__editorStore` y el manifiesto de fixture.",
    obligatoria: false,
    siFalta: "Nada: es su estado normal en producción. Los ganchos de prueba no existen.",
  },
  {
    nombre: "NEXT_PUBLIC_SOPORTE_CORREO",
    fuente: "lib/env.ts",
    paraQue: "Correo de soporte de quien YA es cliente (distinto del de ventas: otra bandeja y otro tono).",
    obligatoria: false,
    siFalta: "La pantalla de ayuda al cliente no ofrece correo de soporte y remite a la ayuda pública.",
  },
  {
    nombre: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    fuente: "lib/env.ts",
    paraQue: "Clave PUBLICABLE de Stripe (`pk_test_…`/`pk_live_…`) para redirigir a Checkout desde el navegador.",
    obligatoria: false,
    siFalta: "No se pinta ningún botón de pago: la pantalla de plan dice que el pago en línea todavía no está disponible.",
  },
];

// ── Lectura de las dos variables nuevas ─────────────────────────────────────────────────────────

/**
 * Correo de soporte, validado con la MISMA regla que el de ventas (`normalizarCorreo`): no se
 * reescribe aquí una segunda idea de qué es un correo.
 */
export function leerCorreoDeSoporte(entorno: Readonly<Record<string, string | undefined>>): string | null {
  return normalizarCorreo(entorno["NEXT_PUBLIC_SOPORTE_CORREO"]);
}

/**
 * Clave publicable de Stripe.
 *
 * Se exige el prefijo `pk_test_` o `pk_live_` por dos motivos, y el segundo es de seguridad:
 *   1. una clave con otra forma no funciona en Checkout y el fallo aparecería en el navegador de la
 *      clienta, en medio del pago;
 *   2. las claves SECRETAS de Stripe (`sk_…`, `rk_…`) tienen el mismo aspecto y caben en esta misma
 *      variable por un copiar-pegar. `NEXT_PUBLIC_*` se hornea en el JavaScript que se descarga
 *      cualquiera: aceptarla la publicaría. Aquí se rechaza y el producto se queda sin pago, que es
 *      infinitamente mejor.
 * Nunca se escribe una clave real en el código ni en las pruebas: los valores de prueba son
 * evidentemente ficticios.
 */
const CLAVE_PUBLICABLE = /^pk_(test|live)_[A-Za-z0-9]{8,}$/;

export function leerClavePublicableDeStripe(entorno: Readonly<Record<string, string | undefined>>): string | null {
  const crudo = entorno["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"];
  if (typeof crudo !== "string") return null;
  const limpio = crudo.trim();
  return CLAVE_PUBLICABLE.test(limpio) ? limpio : null;
}

/** ¿Están activos los ganchos de prueba? Solo el literal `"1"`, como en el editor y en `manifest.ts`. */
export function hooksE2EActivos(entorno: Readonly<Record<string, string | undefined>>): boolean {
  return entorno["NEXT_PUBLIC_E2E_HOOKS"] === "1";
}

// ── Revisión del catálogo entero ────────────────────────────────────────────────────────────────

export interface EstadoDeVariable {
  readonly nombre: NombreDeVariable;
  /** ¿La declara el entorno con algo que no sea vacío? */
  readonly declarada: boolean;
  /** ¿Y ese algo sirve? Una variable ausente NO es inválida: es opcional. */
  readonly valida: boolean;
  /** Qué está mal, en una frase que dice qué hacer. `null` cuando no hay nada que objetar. */
  readonly motivo: string | null;
}

function declarada(valor: string | undefined): boolean {
  return typeof valor === "string" && valor.trim() !== "";
}

/**
 * Estado de `NEXT_PUBLIC_SITE_URL`. La resolución del origen sigue siendo de `enlace-publico.ts`
 * (`origenPublico`, y la compuerta de arranque `motivoDeArranqueInvalido`); aquí solo se REVISA la
 * forma del valor declarado, reutilizando su `esOrigenLocal` en vez de escribir otra lista de hosts.
 */
function estadoDeSitioUrl(entorno: Readonly<Record<string, string | undefined>>): EstadoDeVariable {
  const crudo = entorno["NEXT_PUBLIC_SITE_URL"];
  const nombre = "NEXT_PUBLIC_SITE_URL" as const;
  if (!declarada(crudo)) {
    return { nombre, declarada: false, valida: false, motivo: null };
  }
  const valor = (crudo as string).trim();
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    return { nombre, declarada: true, valida: false, motivo: `«${valor}» no es una URL absoluta (falta el esquema).` };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { nombre, declarada: true, valida: false, motivo: `«${valor}» no usa http ni https.` };
  }
  const desarrollo = entorno["NODE_ENV"] !== "production";
  if (esOrigenLocal(valor)) {
    return desarrollo
      ? { nombre, declarada: true, valida: true, motivo: null }
      : {
          nombre,
          declarada: true,
          valida: false,
          motivo: `${valor} solo abre en esta máquina: los enlaces que la clienta reparte quedarían inservibles (U-6).`,
        };
  }
  if (url.protocol !== "https:" && !desarrollo) {
    return { nombre, declarada: true, valida: false, motivo: `${valor} no es https: el enlace público debe ir cifrado.` };
  }
  return { nombre, declarada: true, valida: true, motivo: null };
}

/** El catálogo entero revisado contra un mapa de entorno. Función pura: se prueba caso por caso. */
export function revisarEntorno(entorno: Readonly<Record<string, string | undefined>>): readonly EstadoDeVariable[] {
  const contacto = leerContacto(entorno);
  const whatsapp = entorno["NEXT_PUBLIC_CONTACTO_WHATSAPP"];
  const correoVentas = entorno["NEXT_PUBLIC_CONTACTO_CORREO"];
  const soporte = entorno["NEXT_PUBLIC_SOPORTE_CORREO"];
  const stripe = entorno["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"];
  const hooks = entorno["NEXT_PUBLIC_E2E_HOOKS"];

  return [
    {
      nombre: "NEXT_PUBLIC_CONTACTO_WHATSAPP",
      declarada: declarada(whatsapp),
      valida: contacto.whatsapp !== null,
      motivo:
        declarada(whatsapp) && contacto.whatsapp === null
          ? `«${whatsapp}» no es un número en E.164 (p. ej. +5215512345678); no se pinta el botón de WhatsApp.`
          : null,
    },
    {
      nombre: "NEXT_PUBLIC_CONTACTO_CORREO",
      declarada: declarada(correoVentas),
      valida: contacto.correo !== null,
      motivo:
        declarada(correoVentas) && contacto.correo === null
          ? `«${correoVentas}» no tiene forma de correo; no se pinta el enlace de contacto.`
          : null,
    },
    estadoDeSitioUrl(entorno),
    {
      nombre: "NEXT_PUBLIC_E2E_HOOKS",
      declarada: declarada(hooks),
      valida: hooksE2EActivos(entorno),
      motivo:
        declarada(hooks) && !hooksE2EActivos(entorno)
          ? `«${hooks}» no activa nada: el único valor que enciende los ganchos de prueba es «1».`
          : null,
    },
    {
      nombre: "NEXT_PUBLIC_SOPORTE_CORREO",
      declarada: declarada(soporte),
      valida: leerCorreoDeSoporte(entorno) !== null,
      motivo:
        declarada(soporte) && leerCorreoDeSoporte(entorno) === null
          ? `«${soporte}» no tiene forma de correo; la ayuda al cliente se queda sin correo de soporte.`
          : null,
    },
    {
      nombre: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
      declarada: declarada(stripe),
      valida: leerClavePublicableDeStripe(entorno) !== null,
      motivo: motivoDeClaveStripe(stripe),
    },
  ];
}

function motivoDeClaveStripe(crudo: string | undefined): string | null {
  if (!declarada(crudo)) return null;
  const limpio = (crudo as string).trim();
  if (CLAVE_PUBLICABLE.test(limpio)) return null;
  if (/^(sk|rk)_/.test(limpio)) {
    // No se repite el valor en el mensaje: sería filtrar un secreto a los registros.
    return "Esa es una clave SECRETA de Stripe y esta variable se publica en el navegador. Quítala de aquí, rótala en Stripe y pon la clave publicable (pk_test_… o pk_live_…).";
  }
  return "No tiene forma de clave publicable de Stripe (pk_test_… o pk_live_…); no se pinta ningún botón de pago.";
}

/** Solo lo que está mal: lo que una pantalla de diagnóstico o un arranque querría enseñar. */
export function problemasDelEntorno(
  entorno: Readonly<Record<string, string | undefined>>,
): readonly EstadoDeVariable[] {
  return revisarEntorno(entorno).filter((estado) => estado.motivo !== null);
}

// ── El entorno REAL. Se lee dentro de cada función, nunca en el módulo ───────────────────────────

export function correoDeSoporteDelEntorno(): string | null {
  return leerCorreoDeSoporte(process.env as Readonly<Record<string, string | undefined>>);
}

export function clavePublicableDeStripeDelEntorno(): string | null {
  return leerClavePublicableDeStripe(process.env as Readonly<Record<string, string | undefined>>);
}

/** `true` cuando el pago en línea se puede ofrecer de verdad. Con `false`, la interfaz lo dice. */
export function pagoEnLineaDisponible(): boolean {
  return clavePublicableDeStripeDelEntorno() !== null;
}

export function revisarEntornoDelProceso(): readonly EstadoDeVariable[] {
  return revisarEntorno(process.env as Readonly<Record<string, string | undefined>>);
}
