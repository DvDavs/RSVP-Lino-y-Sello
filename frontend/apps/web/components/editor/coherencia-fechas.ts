// components/editor/coherencia-fechas.ts — «dos fechas distintas en la misma invitación» (U-4).
//
// Lo que pasó en la revisión de uso: la clienta cambió la ceremonia del 18 de abril al 22 de mayo
// en el **itinerario**, la **portada** siguió diciendo 18 de abril, nadie la avisó, y así se
// publica. «Los invitados leen la portada, se apuntan el 18 de abril, y la boda es el 22 de mayo.»
// Es el error más caro que puede cometer una novia y `04 §6-§7` no lo cubre en absoluto (§4.3 de
// `bitacora/3-ux.md`: hueco de diseño puro).
//
// POR QUÉ AVISA Y NO BLOQUEA (decisión, `preguntas-abiertas.md` § P-3-8-4): una invitación puede
// tener, legítimamente, un momento del itinerario en otro día — una boda de dos días, un civil la
// víspera, un brunch al día siguiente. Bloquear la publicación por una heurística de cliente
// dejaría a esas clientas sin poder publicar y sin entender por qué. El aviso ⚠ de `04 §6.5` es
// exactamente la categoría prevista para esto: «opcional, no bloquea», con su `[Editar]` al lado.
//
// QUÉ SE COMPARA, y por qué así:
//   · la fecha «oficial»: los bloques `date` con `source: "business"` y
//     `businessField: "invitation.date"` — los mismos que salen con candado en Portada y en Los
//     novios. Se leen del MANIFIESTO, no de una lista de claves escrita a mano: así vale para
//     cualquier plantilla presente y futura, no solo para `boda-clasica`.
//   · el primer momento del itinerario: el `start` MÁS TEMPRANO de todos los bloques de item de
//     tipo `dateTimeRange`. `rsvp.deadline` es `date` sin `businessField` y NO entra (es la fecha
//     límite para confirmar: que sea distinta es lo normal).
// Sin manifiesto no se compara nada: un aviso falso sobre la fecha de su boda es peor que ninguno.
import type { ComposedDocument, TemplateManifest } from "@invitaciones/schema";

export interface FechasDiscrepantes {
  /** Día ISO de la portada (`YYYY-MM-DD`). */
  diaPortada: string;
  /** Día ISO del primer momento del itinerario. */
  diaItinerario: string;
  /** Textos ya formateados para enseñárselos a la clienta. */
  textoPortada: string;
  textoItinerario: string;
  /** Sección del itinerario, para poder llevarla ahí con un clic. */
  sectionKey: string;
}

type Manifiesto = TemplateManifest;
type Composed = ComposedDocument;

/** `2027-05-22T17:00` → `2027-05-22`. Devuelve `null` si no empieza por una fecha ISO. */
function dia(iso: string | undefined): string | null {
  if (typeof iso !== "string") return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  return m ? m[1] : null;
}

function formatearDia(isoDia: string): string {
  const [a, m, d] = isoDia.split("-").map(Number);
  if (!a || !m || !d) return isoDia;
  return new Date(a, m - 1, d).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

/** Ids de los bloques cuya fecha es la del negocio (la que sale con 🔒). */
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

  let diaPortada: string | null = null;
  let textoPortada = "";
  let mejorMomento: { dia: string; texto: string; sectionKey: string } | null = null;

  for (const seccion of composed.sections) {
    // Una sección oculta no la ve ningún invitado: su fecha no puede contradecir a la portada.
    if (!seccion.visible) continue;
    for (const bloque of seccion.blocks) {
      if ("items" in bloque) {
        for (const item of bloque.items) {
          for (const campo of item.blocks) {
            if (!idsMomento.has(campo.id)) continue;
            // MEDIDO (`bitacora/3-8.md` §7): el itinerario de ejemplo de `boda-clasica@1.0.0` es
            // 2026-12-12 y la fecha de negocio de cualquier invitación real es otra, así que
            // comparar contra contenido que la clienta NUNCA escribió avisaría en TODAS las
            // invitaciones recién empezadas — y de eso ya avisa la comprobación previa por su
            // cuenta («sigue con el texto de ejemplo»). Solo se compara lo que ella puso.
            if (campo.provenance !== "user") continue;
            if (campo.value?.kind !== "dateTimeRange") continue;
            const d = dia(campo.value.start);
            if (!d) continue;
            if (!mejorMomento || d < mejorMomento.dia) {
              mejorMomento = { dia: d, texto: campo.value.formatted || formatearDia(d), sectionKey: seccion.key };
            }
          }
        }
        continue;
      }
      if (diaPortada === null && idsFecha.has(bloque.id) && bloque.value?.kind === "date") {
        diaPortada = dia(bloque.value.value);
        textoPortada = bloque.value.formatted || (diaPortada ? formatearDia(diaPortada) : "");
      }
    }
  }

  if (!diaPortada || !mejorMomento) return null;
  if (diaPortada === mejorMomento.dia) return null;

  return {
    diaPortada,
    diaItinerario: mejorMomento.dia,
    textoPortada: textoPortada || formatearDia(diaPortada),
    textoItinerario: mejorMomento.texto,
    sectionKey: mejorMomento.sectionKey,
  };
}
