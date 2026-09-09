// lib/panel/tipos.ts — el CONTRATO de una entrada de navegación del panel del cliente (fase 5, 5-0d).
//
// Vive aparte de `nav.ts` a propósito: `nav.ts` importa los ficheros `nav.<area>.ts` y esos ficheros
// necesitan el tipo. Si el tipo viviera en `nav.ts` habría un ciclo de importación entre el
// compositor y cada área. Aquí no lo hay: `tipos.ts` no importa nada de `panel/`.
//
// REGLA DE TERRITORIO DE LA FASE 5: este fichero y `nav.ts` NO se tocan. Cada sesión edita
// únicamente su `nav.<area>.ts` (E2 → `nav.invitados.ts` y `nav.compartir.ts`; E4 → `nav.plan.ts`).
import type { Es_MX } from "../i18n.ts";

/**
 * Nombre de un icono de `@invitaciones/icons`, como cadena.
 *
 * POR QUÉ UNA CADENA Y NO EL COMPONENTE. Este módulo lo importa código de servidor y de cliente, y
 * `@invitaciones/icons` son 82 componentes: guardar el componente en la entrada mete el paquete
 * entero en el grafo de cualquier ruta que solo quiera leer la lista. El nombre viaja como dato y
 * quien pinta la barra resuelve el componente donde ya importa los iconos.
 *
 * La unión se amplía a mano al añadir un área nueva. `nav.test.ts` comprueba contra el paquete real
 * que cada nombre EXISTE, así que un icono inventado rompe la suite en vez de pintar un hueco.
 */
export type NombreDeIcono = "IconoInvitados" | "IconoPlan" | "IconoCompartir";

/** Clave de `es_MX.panel.nav`: el tipo obliga a que la etiqueta exista en es-MX (nunca un literal). */
export type ClaveDeEtiqueta = keyof Es_MX["panel"]["nav"];

/**
 * Lo que la barra sabe de la invitación abierta cuando decide qué entradas enseñar. Es el mínimo
 * que hoy hace falta; una sesión que necesite otro dato lo añade aquí con su ADR (y `nav.ts` sigue
 * sin tocarse: solo crece este tipo).
 */
export interface EstadoDeInvitacion {
  readonly invitationId: string;
  /** `true` cuando la invitación tiene un enlace público vivo (`publicToken` con release). */
  readonly publicada: boolean;
}

export interface EntradaDeNavegacion {
  /** Identificador estable y único en TODO el registro. Es el desempate del orden y la clave de React. */
  readonly id: string;
  /** Clave de `es_MX.panel.nav`, nunca el texto: la interfaz es es-MX y se traduce en un solo sitio. */
  readonly etiqueta: ClaveDeEtiqueta;
  /** Ruta de destino a partir del id de la invitación. Devuelve siempre una ruta absoluta del sitio. */
  readonly href: (invitationId: string) => string;
  readonly icono: NombreDeIcono;
  /** Posición en la barra. Múltiplos de 10 para poder intercalar sin renumerar a nadie. */
  readonly orden: number;
  /**
   * Si la entrada se enseña con ESTE estado de la invitación. Es una función y no un booleano
   * porque la respuesta depende de la invitación abierta: «Compartir» solo tiene sentido cuando ya
   * hay algo que compartir. Una entrada que siempre se ve devuelve `true` y lo dice en su KDoc.
   */
  readonly visible: (estado: EstadoDeInvitacion) => boolean;
}
