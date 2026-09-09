// lib/marca.ts — la identidad de Lino & Sello: qué es LITERAL y qué es CONFIGURACIÓN, y por qué la
// frontera cae justo ahí.
//
// POR QUÉ EXISTE. `decisiones-dueno.md` D-02 fija el nombre y el dominio de la marca: «Lino &
// Sello», `linoysello.com`. Hasta ahora ese nombre no vivía en ningún sitio propio: estaba repetido
// (y roto) dentro de `lib/i18n.ts` como el nombre GENÉRICO del producto —`comun.marca: "Invitaciones"`,
// `sitio.pie.derechos: (anio) => \`${anio} Invitaciones\`\`—, que es justo la palabra que D-02 vino a
// sustituir. Este fichero es la fuente única del nombre y el dominio; `lib/i18n.ts` los CONSUME
// (importa la constante), nunca los repite como literal propio.
//
// LA FRONTERA, y por qué el nombre y el dominio SÍ son literales aquí mientras el correo y el
// WhatsApp NO lo son en ningún sitio del código (`lib/contacto.ts`, `lib/env.ts`):
//   · Nombre y dominio son IDENTIDAD (D-02). No cambian sin comprar otro dominio y sin que alguien
//     registre un ADR — es el mismo tipo de decisión que el logotipo pendiente, que D-02 también
//     fija y que hoy se resuelve con una marca tipográfica temporal (`CabeceraSitio.tsx`,
//     `PieSitio.tsx`), nunca con un logotipo inventado a mitad de un encargo de contacto.
//   · Correo y WhatsApp son CONFIGURACIÓN DE NEGOCIO (D-03, D-04). El dueño los da de alta después
//     en su propio sistema de correo/WhatsApp, pueden rotar sin que la marca cambie un ápice, y —la
//     razón dura, ya escrita en la cabecera de `lib/contacto.ts`— publicar un contacto inventado en
//     el código es peor que no publicar ninguno: por eso viven en variables de entorno
//     (`NEXT_PUBLIC_CONTACTO_WHATSAPP`, `NEXT_PUBLIC_CONTACTO_CORREO`, `NEXT_PUBLIC_SOPORTE_CORREO`)
//     leídas por `lib/contacto.ts` y `lib/env.ts`. Este fichero no los repite ni los reescribe: quien
//     necesite «todo lo que es la marca» los sigue pidiendo a su dueño real.
//
// FORMA, igual que sus dos vecinos (`lib/contacto.ts`, `lib/env.ts`): función(es) PURA(S). Aquí ni
// siquiera hace falta leer el entorno — el nombre y el dominio no varían por despliegue — así que no
// hay ningún `process.env` en este fichero, a propósito.

/** El nombre de la marca, tal y como se escribe en cualquier texto de interfaz o metadato. */
export const NOMBRE_MARCA = "Lino & Sello";

/** El dominio de la marca (D-02), sin esquema ni barra final. */
export const DOMINIO_MARCA = "linoysello.com";

/**
 * Línea de derechos reservados para el pie del sitio: `© <año> Lino & Sello`.
 * Función pura (el año entra como parámetro) para poder fijarlo en la prueba sin tocar el reloj del
 * sistema — el mismo motivo por el que `PieSitio` ya recibía `anio` como prop en vez de leer `Date`.
 */
export function derechosReservados(anio: number): string {
  return `© ${anio} ${NOMBRE_MARCA}`;
}
