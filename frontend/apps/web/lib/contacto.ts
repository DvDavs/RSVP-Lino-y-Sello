// lib/contacto.ts — el ÚNICO sitio donde se decide si el producto sabe cómo se contrata.
//
// POR QUÉ EXISTE (G-01 de `bitacora/3c-ux.md §4`). El recorrido de uso sin instrucciones midió un
// circuito cerrado en cuatro toques: «Empezar mi invitación» → `/acceso` → «Todavía no tienes
// invitaciones… contrata un plan» → `/ayuda#planes`, que remite a «el mismo medio por el que
// contrataste tu invitación» — un medio que quien todavía no ha contratado nada no tiene. No hay
// teléfono, ni correo, ni WhatsApp en ninguna pantalla del sitio.
//
// Cuál es el número y cuál el correo es una decisión de PRODUCTO que este código no puede inventar:
// publicar un teléfono ficticio sería peor que no publicar ninguno. Así que el camino se hace
// CONFIGURABLE y, mientras no esté configurado, HONESTO: el sitio dice que el contacto se publicará
// aquí en cuanto exista, en vez de mandar a la clienta a un enlace que no lleva a nadie.
//
// Dos variables de entorno, ambas opcionales y ambas `NEXT_PUBLIC_` (se leen en el servidor, y el
// prefijo deja que una futura pantalla de cliente use el mismo dato sin duplicar la fuente):
//   NEXT_PUBLIC_CONTACTO_WHATSAPP  número en E.164, p. ej. `+5215512345678`
//   NEXT_PUBLIC_CONTACTO_CORREO    dirección de correo, p. ej. `hola@ejemplo.mx`
// Documentadas en `memoria/handoffs/3c-ux.md` («Correcciones UX-C») y preguntadas al dueño del
// producto en `memoria/preguntas-abiertas.md § Fase 3-C · UX-C`.
//
// Funciones PURAS sobre un mapa de entorno: se prueban caso por caso sin montar ningún componente
// ni tocar `process.env` global.
import { es_MX } from "./i18n.ts";

/** Un canal listo para pintar: a dónde va el enlace y qué se enseña como texto. */
export interface CanalDeContacto {
  readonly enlace: string;
  /** Lo que se lee en pantalla (el número con formato, la dirección de correo). */
  readonly etiqueta: string;
}

export interface ContactoDeVenta {
  readonly whatsapp: CanalDeContacto | null;
  readonly correo: CanalDeContacto | null;
  /** `false` = no hay ni un canal: la interfaz enseña la frase honesta, nunca un botón muerto. */
  readonly configurado: boolean;
}

/**
 * E.164: un `+` opcional, primer dígito distinto de cero y entre 8 y 15 dígitos en total.
 * Se acepta con espacios, guiones o paréntesis escritos por comodidad en el fichero de entorno y se
 * normaliza a solo dígitos, que es lo que `wa.me` admite en la ruta (`wa.me/5215512345678`).
 */
const E164 = /^[1-9]\d{7,14}$/;

/** RFC 5322 en su versión sensata: algo, una arroba, un dominio con punto y sin espacios. */
const CORREO = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** `"+52 155 1234 5678"` → `"5215512345678"`; lo que no sea E.164 válido → `null`. */
export function normalizarTelefono(crudo: string | undefined): string | null {
  if (typeof crudo !== "string") return null;
  const digitos = crudo.replace(/[\s\-().]/g, "").replace(/^\+/, "");
  return E164.test(digitos) ? digitos : null;
}

export function normalizarCorreo(crudo: string | undefined): string | null {
  if (typeof crudo !== "string") return null;
  const limpio = crudo.trim();
  return CORREO.test(limpio) ? limpio : null;
}

/**
 * `"5215512345678"` → `"+521 55 1234 5678"`, para que se pueda leer, copiar y teclear a mano.
 * Se agrupan los DIEZ últimos dígitos en 2-4-4 (el número nacional en México) y lo que sobra por
 * delante es el prefijo de país. No se intenta adivinar el formato nacional de otro país: agrupar
 * mal un número extranjero es peor que enseñarlo entero.
 */
export function formatearTelefono(digitos: string): string {
  if (digitos.length < 10) return `+${digitos}`;
  const nacional = digitos.slice(-10).replace(/(\d{2})(\d{4})(\d{4})/, "$1 $2 $3");
  const pais = digitos.slice(0, -10);
  return pais.length > 0 ? `+${pais} ${nacional}` : `+${nacional}`;
}

/**
 * Lee el entorno y devuelve los canales que de verdad se pueden pintar.
 *
 * El mensaje de WhatsApp va ya escrito en es-MX (`sitio.contactar.mensaje`) para que la clienta no
 * tenga que explicar de dónde sale: quien recibe el mensaje sabe que viene de la página de planes.
 */
export function leerContacto(entorno: Readonly<Record<string, string | undefined>>): ContactoDeVenta {
  const telefono = normalizarTelefono(entorno["NEXT_PUBLIC_CONTACTO_WHATSAPP"]);
  const correo = normalizarCorreo(entorno["NEXT_PUBLIC_CONTACTO_CORREO"]);

  const canalWhatsapp: CanalDeContacto | null =
    telefono === null
      ? null
      : {
          enlace: `https://wa.me/${telefono}?text=${encodeURIComponent(es_MX.sitio.contactar.mensaje)}`,
          etiqueta: formatearTelefono(telefono),
        };

  const canalCorreo: CanalDeContacto | null =
    correo === null
      ? null
      : {
          enlace: `mailto:${correo}?subject=${encodeURIComponent(es_MX.sitio.contactar.asunto)}`,
          etiqueta: correo,
        };

  return {
    whatsapp: canalWhatsapp,
    correo: canalCorreo,
    configurado: canalWhatsapp !== null || canalCorreo !== null,
  };
}

/**
 * El contacto tal y como lo ve una petición REAL. Se lee dentro de la función, no en el módulo,
 * para que `next start` recoja el valor del entorno del proceso sin volver a compilar.
 */
export function contactoDelEntorno(): ContactoDeVenta {
  return leerContacto(process.env as Readonly<Record<string, string | undefined>>);
}
