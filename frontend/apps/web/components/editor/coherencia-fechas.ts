// components/editor/coherencia-fechas.ts — «dos fechas distintas en la misma invitación» (U-4, y su
// reapertura como G-04 en el recorrido de UX del cierre de la fase 3-C).
//
// Lo que pasó la primera vez (U-4): la clienta cambió la ceremonia del 18 de abril al 22 de mayo en
// el **itinerario**, la **portada** siguió diciendo 18 de abril, nadie la avisó, y así se publica.
// «Los invitados leen la portada, se apuntan el 18 de abril, y la boda es el 22 de mayo.»
//
// Lo que pasó la SEGUNDA vez (G-04, `bitacora/3c-ux.md §4`): se publicó una invitación con la
// portada en 20-mar-2027 y el itinerario en 14-nov-2026, y la revisión previa dijo «Todo listo para
// publicar». El guardián existía y no vio nada, porque **descartaba los momentos con
// `provenance: "default"`**: el itinerario de esa invitación seguía siendo el de ejemplo del
// paquete. El razonamiento de entonces («comparar contra contenido que la clienta nunca escribió
// avisaría en todas las invitaciones recién empezadas») confundía dos cosas: que el contenido sea
// de ejemplo no lo hace invisible. **La invitada lee esa fecha igual.** Si se publica, se publica
// con dos fechas, y eso es exactamente lo que hay que decir antes de publicar.
//
// REGLA (corregida en 3C-UX-B):
//   · Se comparan TODOS los momentos VISIBLES del compuesto, venga su valor de la clienta o de los
//     defaults del paquete. Lo único que se excluye es una sección oculta: esa no la ve nadie.
//   · Hay incoherencia cuando **ningún** momento visible del itinerario cae el día del evento. Si
//     alguno cae ese día, los demás son legítimos (boda de dos días, civil la víspera, brunch al
//     día siguiente) y no se avisa: es la razón por la que esto avisa y no bloquea
//     (`preguntas-abiertas.md` § P-3-8-4).
//
// QUÉ SE COMPARA, y por qué así:
//   · la fecha «oficial» del evento: los bloques `date` con `source: "business"` y
//     `businessField: "invitation.date"` — los mismos que salen con candado en Portada y en Los
//     novios, y los que cambia `PUT …/event` (`contratos.md §12.3`). Se leen del MANIFIESTO, no de
//     una lista de claves escrita a mano: así vale para cualquier plantilla presente y futura.
//   · los momentos del itinerario: los bloques de ítem de tipo `dateTimeRange`. `rsvp.deadline` es
//     `date` sin `businessField` y NO entra (es la fecha límite para confirmar: que sea distinta es
//     lo normal).
// Sin manifiesto no se compara nada: un aviso falso sobre la fecha de su boda es peor que ninguno.
import type { ComposedDocument, TemplateManifest } from "@invitaciones/schema";

/** Un momento del itinerario tal y como lo ve la invitada, con su dirección para poder corregirlo. */
export interface MomentoDelItinerario {
  /** Día ISO (`YYYY-MM-DD`) en el que empieza. */
  dia: string;
  /** Texto ya formateado por el servidor (lo que se le enseña a la clienta). */
  texto: string;
  sectionKey: string;
  sectionTitle: string;
  groupId: string;
  itemId: string;
  blockId: string;
  /** `"user"` si lo escribió la clienta; `"default"` si sigue siendo el del paquete. */
  provenance: string;
  start: string;
  end?: string;
}

export interface FechasDiscrepantes {
  /** Día ISO del evento (el de la portada, el de `invitation.date`). */
  diaEvento: string;
  textoEvento: string;
  /** Todos los momentos visibles del itinerario, en orden cronológico. Ninguno cae el día del evento. */
  momentos: MomentoDelItinerario[];
  /** Sección del primer momento, para poder llevarla ahí con un toque. */
  sectionKey: string;
  /** `true` si TODOS los momentos siguen siendo el itinerario de ejemplo del paquete. */
  soloEjemplo: boolean;
  /**
   * ¿Se puede corregir de un toque? Solo cuando los momentos existen en el DOCUMENTO
   * (`provenance: "user"`): un ítem que solo vive en los defaults no es direccionable por
   * `setItemBlock` —el reductor responde `TPL_ITEM_UNKNOWN`— y materializarlo con `addItem`
   * promovería contenido de demostración a contenido de la clienta, que es justo lo que prohíbe la
   * objeción O-08 (`packages/schema/src/operations.ts`) porque desactiva el bloqueo de publicación
   * de `03 §6`. Ahí la acción honesta es «Editar»: el itinerario hay que escribirlo, no desplazarlo.
   */
  sePuedeAplicar: boolean;
}

type Manifiesto = TemplateManifest;
type Composed = ComposedDocument;

/** `2027-05-22T17:00` → `2027-05-22`. Devuelve `null` si no empieza por una fecha ISO. */
function dia(iso: string | undefined): string | null {
  if (typeof iso !== "string") return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  return m ? m[1]! : null;
}

function formatearDia(isoDia: string): string {
  const [a, m, d] = isoDia.split("-").map(Number);
  if (!a || !m || !d) return isoDia;
  return new Date(a, m - 1, d).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

/** Días enteros de `a` a `b` (positivo si `b` es posterior). Aritmética en UTC: sin horario de verano. */
function diasEntre(a: string, b: string): number {
  const [aa, am, ad] = a.split("-").map(Number);
  const [ba, bm, bd] = b.split("-").map(Number);
  const ua = Date.UTC(aa!, am! - 1, ad!);
  const ub = Date.UTC(ba!, bm! - 1, bd!);
  return Math.round((ub - ua) / 86_400_000);
}

/** `2026-12-12T16:30` + 465 días → `2028-03-21T16:30`. La HORA no se toca. */
export function sumarDias(isoLocal: string, dias: number): string {
  const [fecha, hora] = isoLocal.split("T");
  const [a, m, d] = (fecha ?? "").split("-").map(Number);
  if (!a || !m || !d) return isoLocal;
  const t = new Date(Date.UTC(a, m - 1, d + dias));
  const nueva = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
  return hora === undefined ? nueva : `${nueva}T${hora}`;
}

/** Ids de los bloques cuya fecha es la del negocio (la que sale de solo lectura, con candado). */
function idsDeFechaDeNegocio(manifest: Manifiesto): Set<string> {
  const ids = new Set<string>();
  for (const seccion of manifest.sections) {
    for (const bloque of seccion.blocks) {
      if (bloque.type === "date" && bloque.source === "business" && bloque.businessField === "invitation.date") {
        ids.add(bloque.id);
      }
    }
  }
  return ids;
}

/** Ids de los bloques de item que declaran un rango de fecha y hora (los momentos del itinerario). */
function idsDeMomento(manifest: Manifiesto): Set<string> {
  const ids = new Set<string>();
  for (const seccion of manifest.sections) {
    for (const bloque of seccion.blocks) {
      if (bloque.type !== "group") continue;
      for (const item of bloque.itemBlocks) {
        if (item.type === "dateTimeRange") ids.add(item.id);
      }
    }
  }
  return ids;
}

export function fechasDiscrepantes(manifest: Manifiesto | null, composed: Composed | null): FechasDiscrepantes | null {
  if (!manifest || !composed) return null;

  const idsFecha = idsDeFechaDeNegocio(manifest);
  const idsMomento = idsDeMomento(manifest);
  if (idsFecha.size === 0 || idsMomento.size === 0) return null;

  let diaEvento: string | null = null;
  let textoEvento = "";
  const momentos: MomentoDelItinerario[] = [];

  for (const seccion of composed.sections) {
    // Una sección oculta no la ve ninguna invitada: su fecha no puede contradecir a la portada.
    if (!seccion.visible) continue;
    for (const bloque of seccion.blocks) {
      if ("items" in bloque) {
        for (const item of bloque.items) {
          for (const campo of item.blocks) {
            if (!idsMomento.has(campo.id)) continue;
            if (campo.value?.kind !== "dateTimeRange") continue;
            // G-04: los defaults CUENTAN. La invitada lee la fecha del itinerario compuesto, no la
            // del documento; si sigue siendo la del paquete, es la que se publica.
            if (campo.provenance === "empty") continue;
            const d = dia(campo.value.start);
            if (!d) continue;
            momentos.push({
              dia: d,
              texto: campo.value.formatted || formatearDia(d),
              sectionKey: seccion.key,
              sectionTitle: seccion.title,
              groupId: bloque.id,
              itemId: item.itemId,
              blockId: campo.id,
              provenance: campo.provenance,
              start: campo.value.start,
              ...(campo.value.end === undefined ? {} : { end: campo.value.end }),
            });
          }
        }
        continue;
      }
      if (diaEvento === null && idsFecha.has(bloque.id) && bloque.value?.kind === "date") {
        diaEvento = dia(bloque.value.value);
        textoEvento = bloque.value.formatted || (diaEvento ? formatearDia(diaEvento) : "");
      }
    }
  }

  if (!diaEvento || momentos.length === 0) return null;
  // Si el itinerario incluye el día del evento, lo demás son días legítimos de la misma celebración.
  if (momentos.some((m) => m.dia === diaEvento)) return null;

  momentos.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  return {
    diaEvento,
    textoEvento: textoEvento || formatearDia(diaEvento),
    momentos,
    sectionKey: momentos[0]!.sectionKey,
    soloEjemplo: momentos.every((m) => m.provenance !== "user"),
    sePuedeAplicar: momentos.every((m) => m.provenance === "user"),
  };
}

/** Una escritura de `setItemBlock` lista para el store. */
export interface CorreccionDeMomento {
  groupId: string;
  itemId: string;
  blockId: string;
  value: { kind: "dateTimeRange"; start: string; end?: string };
}

/**
 * «Usar la fecha del evento en el itinerario»: desplaza TODOS los momentos el mismo número de días,
 * de forma que el primero caiga el día del evento. Las horas y la distancia entre momentos se
 * conservan — una boda que empieza a las 16:30 y acaba a las 02:00 del día siguiente sigue siendo
 * exactamente eso, solo que en la fecha correcta. Devuelve `[]` si no se puede aplicar.
 */
export function correccionesParaUsarLaFechaDelEvento(d: FechasDiscrepantes): CorreccionDeMomento[] {
  if (!d.sePuedeAplicar || d.momentos.length === 0) return [];
  const delta = diasEntre(d.momentos[0]!.dia, d.diaEvento);
  if (delta === 0) return [];
  return d.momentos.map((m) => ({
    groupId: m.groupId,
    itemId: m.itemId,
    blockId: m.blockId,
    value: {
      kind: "dateTimeRange" as const,
      start: sumarDias(m.start, delta),
      ...(m.end === undefined ? {} : { end: sumarDias(m.end, delta) }),
    },
  }));
}
