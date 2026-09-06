// components/asistente/catalogo.ts — lógica pura del paso 2 del asistente: cuántas plantillas hay
// por tipo de evento, qué filtros se pueden ofrecer y cuáles bloquea el plan de la invitación.
//
// Los filtros salen de datos REALES del catálogo (`03-api.md §3.1`): `capabilities` del manifiesto
// (`packages/schema` `Capability`: cinco valores cerrados) y `minPlanTier`. El catálogo NO publica
// hoy ningún metadato de estilo ni de color, así que no se ofrecen filtros de estilo/color: serían
// una etiqueta inventada por el frontend sobre datos que no existen (queda anotado en
// `preguntas-abiertas.md` § Fase 3-C · 3C-6).
import type { EventKind } from "@invitaciones/schema";
import type { CatalogItem } from "@/lib/api-types";

/** Nivel de plan de la invitación: el backend solo distingue Básico (1) y Premium (2). */
export type NivelDePlan = 1 | 2 | 3;

/**
 * `invitation_plan.is_premium` llega como NOMBRE del plan en `/user/invitations/all` (`"Básico"`,
 * `"Premium"`). El backend traduce `is_premium = true → 2` (`BusinessSnapshotReader`); aquí se hace
 * la misma lectura desde el nombre, que es lo único que esa ruta expone.
 */
export function nivelDePlan(nombreDelPlan: string | null | undefined): NivelDePlan {
  if (!nombreDelPlan) return 1;
  return /premium/i.test(nombreDelPlan) ? 2 : 1;
}

/** ¿Esta plantilla entra en el plan contratado? */
export function entraEnElPlan(item: CatalogItem, plan: NivelDePlan): boolean {
  return item.minPlanTier <= plan;
}

/** Cuántas plantillas publicadas hay de cada tipo de evento (para las tarjetas del paso 1). */
export function conteoPorTipo(items: readonly CatalogItem[]): ReadonlyMap<EventKind, number> {
  const conteo = new Map<EventKind, number>();
  for (const item of items) {
    for (const kind of item.eventKinds) {
      conteo.set(kind, (conteo.get(kind) ?? 0) + 1);
    }
  }
  return conteo;
}

/** Las cinco capacidades del manifiesto, en el orden en que se pintan los chips. */
export const CAPACIDADES = ["singlePlace", "story", "hashtags", "music", "countdown"] as const;
export type Capacidad = (typeof CAPACIDADES)[number];

export function esCapacidad(valor: string): valor is Capacidad {
  return (CAPACIDADES as readonly string[]).includes(valor);
}

/** Solo las capacidades que ALGUNA plantilla de la lista tiene: un filtro sin resultados no se ofrece. */
export function capacidadesDisponibles(items: readonly CatalogItem[]): readonly Capacidad[] {
  const presentes = new Set<string>();
  for (const item of items) for (const c of item.capabilities) presentes.add(c);
  return CAPACIDADES.filter((c) => presentes.has(c));
}

export interface FiltrosDePlantilla {
  /** Solo las incluidas en el plan de la invitación. */
  readonly soloDeMiPlan: boolean;
  /** Capacidad exigida, o `null` para no filtrar por capacidad. */
  readonly capacidad: Capacidad | null;
}

export const SIN_FILTROS: FiltrosDePlantilla = { soloDeMiPlan: false, capacidad: null };

/**
 * Aplica los filtros del paso 2. Las bloqueadas por plan NO se esconden por defecto: se pintan con
 * el motivo y una salida («Ver qué incluye el plan 2»), que es lo contrario de un control mudo.
 */
export function filtrarPlantillas(
  items: readonly CatalogItem[],
  filtros: FiltrosDePlantilla,
  plan: NivelDePlan,
): readonly CatalogItem[] {
  return items.filter((item) => {
    if (filtros.soloDeMiPlan && !entraEnElPlan(item, plan)) return false;
    if (filtros.capacidad !== null && !item.capabilities.includes(filtros.capacidad)) return false;
    return true;
  });
}

/** Clave estable de una plantilla dentro de una versión del catálogo. */
export function claveDePlantilla(item: CatalogItem): string {
  return `${item.slug}@${item.version}`;
}
