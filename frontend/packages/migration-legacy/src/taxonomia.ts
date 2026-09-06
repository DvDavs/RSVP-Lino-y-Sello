// src/taxonomia.ts — la taxonomía CERRADA de clasificación de hojas y el tipo de una regla.
//
// P1: nada se descarta en silencio. NO hay categoría comodín («otros», «resto», «desconocido»): una
// sola hoja sin clasificar hace fallar el proceso (ADR-1R-C-01, gate mecánico de `05 §3` paso 2).

import type { BlockRole } from "@invitaciones/schema";
import type { Cohorte } from "./plantillas.ts";

/** Las cuatro clases. Cualquier hoja cae en una y sólo en una. */
export type Clase =
  /** Tiene destino exacto en el paquete nuevo (bloque, ítem de grupo, estructura, negocio o capacidad). */
  | "mapeada"
  /** Es presentación: va a `theme.json` o se descarta por P3, siempre con el motivo escrito. */
  | "presentacion"
  /** Se descarta a propósito, con la razón escrita. */
  | "descartada"
  /** Contenido visible sin destino en el catálogo cerrado. ABORTA la construcción. */
  | "bloqueante";

/** Dónde acaba una hoja `mapeada`. `ref` admite `{n}` = n-ésimo comodín del puntero (1-based). */
export type Destino =
  /**
   * Bloque escalar del manifiesto. `ref` es el `blockId`. `campo` nombra la RANURA dentro del valor
   * (`nombre` y `mapHref` de un `location`, `fecha`/`horaInicio`/`horaFin` de un `dateTimeRange`…);
   * por defecto `"valor"`.
   */
  | { readonly tipo: "bloque"; readonly ref: string; readonly rol: BlockRole; readonly campo?: string }
  /**
   * Bloque dentro de un ítem de grupo: `ref` es el `blockId` del grupo, `itemBlock` el id corto.
   * `itemIdx` dice QUÉ comodín del puntero es el índice del ítem (1-based); por defecto el último.
   * Hace falta en `/config/sectionGifttable/items/*​/body/*​/content`, donde el ítem es el primer
   * comodín y el segundo ordena los elementos de la lista.
   */
  | { readonly tipo: "itemBloque"; readonly ref: string; readonly itemBlock: string; readonly rol: BlockRole; readonly campo?: string; readonly itemIdx?: number;
      /** Clave literal del ítem cuando el puntero no tiene comodín (`/dressCode/women/...` → ítem "women"). */
      readonly itemClave?: string }
  /** `structure.sections[key].visible`. */
  | { readonly tipo: "estructura"; readonly seccion: string; readonly campo: "visible" }
  /** Dato de negocio en Postgres: nunca entra en el documento (ADR-001). */
  | { readonly tipo: "negocio"; readonly campo: string }
  /** `manifest.capabilities`. */
  | { readonly tipo: "capacidad"; readonly capacidad: string }
  /** Clave de correlación del informe (templateId, eventTypeId, planId…): no entra en el paquete. */
  | { readonly tipo: "correlacion"; readonly campo: string }
  /** Identidad de un ítem de grupo: se traduce a un `itemId` NUEVO, jamás se reusa (ADR-1R-C-02). */
  | { readonly tipo: "itemIdLegado"; readonly ref: string };

/** Dónde acaba una hoja `presentacion`. */
export type DestinoPresentacion =
  | { readonly tipo: "tema"; readonly campo: string }
  | { readonly tipo: "variante"; readonly seccion: string }
  | { readonly tipo: "assetPaquete" }
  | { readonly tipo: "p3" };

export interface Regla {
  /** Identificador estable de la regla. Aparece en el informe de cobertura y en el de pérdidas. */
  readonly id: string;
  /** Patrón de puntero (`*` = un segmento, `**` = cola). Ver `puntero.ts`. */
  readonly patron: string;
  readonly clase: Clase;
  /** Si se declara, la regla SÓLO aplica a esas cohortes de roles. */
  readonly cohortes?: readonly Cohorte[];
  /** Obligatorio si `clase === "mapeada"`. */
  readonly destino?: Destino;
  /** Obligatorio si `clase === "presentacion"`. */
  readonly presentacion?: DestinoPresentacion;
  /** La decisión escrita. Obligatoria SIEMPRE, en las cuatro clases. */
  readonly motivo: string;
  /** Cita de evidencia: `05 §4.2`, `01 §10.1`, `ADR-xxx`, `H-xx`, o `archivo:línea`. */
  readonly evidencia: string;
  /**
   * `true` en las hojas `descartada` que se esperan SIEMPRE nulas o triviales. Si aparece un valor,
   * la construcción no lo tira: lo escala a la cubeta «a revisar» del informe de pérdidas.
   */
  readonly esperadoVacio?: true;
  /** `true` en las `descartada` cuyo valor, aunque exista, no necesita revisión humana. */
  readonly sinRevision?: true;
  /**
   * RED DE SEGURIDAD: la regla existe para que una forma alternativa documentada, un cruce de cohorte
   * o un `content` inesperado NO puedan quedar sin clasificar, y se espera que NO case ninguna hoja de
   * los 9 ficheros del repositorio. `test/cobertura.test.ts` exige que el conjunto de reglas muertas
   * sea EXACTAMENTE el de las marcadas así: una regla muerta sin marca es una errata, y una marcada
   * que empieza a casar es un cambio de los datos que hay que mirar.
   */
  readonly redDeSeguridad?: true;
  /**
   * Prioridad de la fuente cuando dos punteros distintos apuntan a la MISMA ranura (p. ej.
   * `/config/sectionCover/button/content` = "Save the date" y `/texts/coverButton` = "Reserva la
   * fecha"). Gana la mayor; el resto se anota en la cubeta «a revisar» del informe con los dos
   * punteros y los dos valores. Por defecto 0. Nada se resuelve en silencio (P1).
   */
  readonly prioridad?: number;
  /**
   * Sólo en `bloqueante`: identificador de la decisión de producto que la desbloquea. El operador la
   * resuelve con `--decision <id>=<opcion>` y queda escrita en el informe.
   */
  readonly decision?: { readonly id: string; readonly opciones: readonly string[] };
}

export interface HojaClasificada {
  readonly puntero: string;
  readonly patron: string;
  readonly idLegado: string | null;
  readonly valor: unknown;
  readonly clase: Clase;
  readonly reglaId: string;
  readonly motivo: string;
  readonly evidencia: string;
  /** Destino con `{n}` ya expandido. */
  readonly destino?: Destino;
  readonly presentacion?: DestinoPresentacion;
  readonly comodines: readonly string[];
  readonly prioridad: number;
  readonly decision?: Regla["decision"];
}

export interface ResumenClasificacion {
  readonly fichero: string;
  readonly hojas: number;
  readonly patrones: number;
  readonly mapeadas: number;
  readonly presentacion: number;
  readonly descartadas: number;
  readonly bloqueantes: number;
  /** Patrones DISTINTOS sin regla. El gate exige 0 (ADR-1R-C-01). */
  readonly patronesSinMapear: readonly string[];
  /** Hojas sin regla (para dimensionar el trabajo, no para el gate). */
  readonly hojasSinMapear: number;
}
