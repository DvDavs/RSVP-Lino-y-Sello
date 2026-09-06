// src/plantillas.ts — el registro de las 9 plantillas legadas reconstruibles desde el repositorio.
//
// Alcance fijado por ADR-1R-C-07: cuatro cohortes y NUEVE paquetes construibles desde F1
// (`templateId` 4, 5, 6, 7, 8, 9, 10, 11, 13). El 12 y el 14 salen de `payload-template-*` (cohorte C)
// y no se tratan aquí; el 16 y el 17 no son reproducibles (cohorte D).

import type { EventKind } from "@invitaciones/schema";

/**
 * COHORTE DE ROLES — es lo que decide el mapa de `sectionCouple`, y NO es lo mismo que la cohorte
 * A/B/C/D de `05 §1` (que habla de dónde vive el arte).
 *
 * `boda`     → `groomName`/`brideName`/`groomPhoto`/`bridePhoto`/`groomText`/`brideText` →
 *              `celebrantA`/`celebrantB`/`celebrantAPhoto`/`celebrantBPhoto`/`celebrantAText`/`celebrantBText`
 * `no-boda`  → `namePersonEvent`/`photoPersonEvent`/`message` → `honoree`/`honoreePhoto`/`honoreeMessage`
 *
 * Un mapa único falla en 6 patrones de hoja de las 3 plantillas de boda (`05 §3` paso 4) y, peor,
 * CRUZA los roles en `boda_premium_2`: verificado [V] que su `sectionCouple` declara a la vez
 * `groomName`/`brideName` (con contenido: "Antonio Barrita", "Camila Estrada") y
 * `namePersonEvent`/`photoPersonEvent` (a `null`). Con un mapa único ese paquete emitiría
 * `celebrantA` Y `honoree`, que es justo lo que el catálogo de roles quiere impedir.
 */
export type Cohorte = "boda" | "no-boda";

export interface PlantillaLegada {
  readonly templateId: number;
  /** Sufijo de los dos ficheros de F1: `default_visual_<slug>.json` y `default_content_<slug>.json`. */
  readonly slugLegado: string;
  /** Slug del paquete nuevo. Decisión de quien construye el paquete (`05 §3`). */
  readonly slug: string;
  /** Nombre visible. Fuente citada en `fuenteNombre`. */
  readonly nombre: string;
  readonly fuenteNombre: string;
  readonly cohorte: Cohorte;
  readonly eventKind: EventKind;
  readonly eventTypeId: number;
  readonly planId: number;
  /** Cohorte A/B/C/D de `05 §1`. */
  readonly cohorteMigracion: "A" | "B";
  /**
   * `true` si el slug ya tiene un paquete publicado que NO sale de esta herramienta: escribir encima
   * lo destruiría, así que la herramienta se niega salvo `--forzar`. El `templateId` 5 usó este
   * mecanismo mientras apuntaba a `boda-clasica` (la plantilla de diseño de 3-2d); el brief 4-4a lo
   * mueve al slug propio `boda-premium`, así que ningún `templateId` de las cohortes A/B lo necesita
   * hoy — queda el mecanismo para el próximo choque de slugs.
   */
  readonly yaCubierto?: true;
  readonly nota?: string;
}

/** eventTypeId → EventKind. `V1:929-930` (1, 2) y `V24:3-6` (3-6) [V]; el 7 no tiene fila [ND]. */
export const EVENT_KIND_POR_TIPO: Readonly<Record<number, EventKind>> = {
  1: "wedding", 2: "quince", 3: "baptism", 4: "communion", 5: "confirmation", 6: "birthday", 7: "generic",
};

export const PLANTILLAS: readonly PlantillaLegada[] = [
  {
    templateId: 4, slugLegado: "boda_basico", slug: "boda-basica", nombre: "Boda Básica",
    fuenteNombre: "V1__initial_schema.sql:1133-1136 deja `name` VACÍO para los ids 4 y 5 [V]; el nombre y el slug son decisión de quien construye el paquete (05 §3) y están en preguntas-abiertas.md",
    cohorte: "boda", eventKind: "wedding", eventTypeId: 1, planId: 1, cohorteMigracion: "A",
  },
  {
    templateId: 5, slugLegado: "boda_premium", slug: "boda-premium", nombre: "Boda Premium",
    fuenteNombre: "V1__initial_schema.sql:1133-1136 (`name` vacío) [V]; slug decidido por el orquestador de fase 4 (brief 4-4a §2: `boda-clasica` sigue siendo la plantilla de diseño escrita a mano en 3-2d, no la conversión de F1; conviven bajo slugs distintos)",
    cohorte: "boda", eventKind: "wedding", eventTypeId: 1, planId: 2, cohorteMigracion: "A",
    nota: "El paquete `frontend/templates/boda-clasica/1.0.0` NO es esta conversión: es una plantilla de diseño nuevo del bloque 3-2d, y no se toca (PROHIBIDO en el brief de 4-4a). El `templateId` 5 se convierte aquí bajo el slug `boda-premium`.",
  },
  {
    templateId: 6, slugLegado: "xv_premium", slug: "xv-elegance", nombre: "XV Años Elegance Premium",
    fuenteNombre: "V24__add_new_event_types_and_xv_template.sql:12 [V]",
    cohorte: "no-boda", eventKind: "quince", eventTypeId: 2, planId: 2, cohorteMigracion: "A",
  },
  {
    templateId: 7, slugLegado: "bautizo", slug: "bautizo-elegante", nombre: "Bautizo Premium Elegance",
    fuenteNombre: "V25__add_remaining_templates.sql:4 [V]",
    cohorte: "no-boda", eventKind: "baptism", eventTypeId: 3, planId: 2, cohorteMigracion: "A",
  },
  {
    templateId: 8, slugLegado: "comunion", slug: "comunion-elegante", nombre: "Comunión Premium Elegance",
    fuenteNombre: "V25__add_remaining_templates.sql:5 [V]",
    cohorte: "no-boda", eventKind: "communion", eventTypeId: 4, planId: 2, cohorteMigracion: "A",
  },
  {
    templateId: 9, slugLegado: "confirmacion", slug: "confirmacion-elegante", nombre: "Confirmación Premium Elegance",
    fuenteNombre: "V25__add_remaining_templates.sql:6 [V]",
    cohorte: "no-boda", eventKind: "confirmation", eventTypeId: 5, planId: 2, cohorteMigracion: "A",
  },
  {
    templateId: 10, slugLegado: "cumpleanos", slug: "cumpleanos-elegante", nombre: "Cumpleaños Premium Elegance",
    fuenteNombre: "V25__add_remaining_templates.sql:7 [V]",
    cohorte: "no-boda", eventKind: "birthday", eventTypeId: 6, planId: 2, cohorteMigracion: "A",
  },
  {
    templateId: 11, slugLegado: "boda_premium_2", slug: "boda-premium-2", nombre: "Boda Premium 2",
    fuenteNombre: "scripts/apply_template_11_12_local.sh:31 [V]",
    cohorte: "boda", eventKind: "wedding", eventTypeId: 1, planId: 2, cohorteMigracion: "B",
    nota: "Apagada en el sembrador (`MongoDataInitializer.kt:36,50` comentado) por el choque de (eventTypeId, planId) = (1,2) con `boda_premium`. Declara a la vez el mapa de boda y el de no-boda: ver `Cohorte`.",
  },
  {
    templateId: 13, slugLegado: "evento", slug: "evento-elegante", nombre: "Evento Premium Elegance",
    fuenteNombre: "NO hay fila Flyway para el templateId 13 (ADR-1R-C-07) [V]; el nombre es un SUPUESTO por analogía con V25 y está en preguntas-abiertas.md [I]",
    cohorte: "no-boda", eventKind: "generic", eventTypeId: 7, planId: 2, cohorteMigracion: "B",
  },
];

export function plantillaPorId(templateId: number): PlantillaLegada {
  const p = PLANTILLAS.find((x) => x.templateId === templateId);
  if (!p) {
    throw new Error(
      `templateId ${templateId} no pertenece a las cohortes A/B. Reconstruibles desde el repositorio: ` +
      PLANTILLAS.map((x) => x.templateId).join(", ") + " (ADR-1R-C-07).",
    );
  }
  return p;
}

export function rutasF1(p: PlantillaLegada, dirDatos: string): { visual: string; contenido: string } {
  return {
    visual: `${dirDatos}/default_visual_${p.slugLegado}.json`,
    contenido: `${dirDatos}/default_content_${p.slugLegado}.json`,
  };
}
