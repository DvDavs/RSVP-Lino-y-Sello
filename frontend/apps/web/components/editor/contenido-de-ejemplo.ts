// components/editor/contenido-de-ejemplo.ts — «se publica con “Nombre de la mamá” y “Nombre del
// papá”» (G-05, `bitacora/3c-ux.md §4`, captura `m43`).
//
// QUÉ FALLABA. La revisión previa a publicar enseñaba EXCLUSIVAMENTE lo que el servidor manda en
// `GET …/release/preflight`, y ese preflight solo mira dos cosas (`ReleaseService.kt:92` y `:127`):
// los bloques **obligatorios** que siguen en su valor de ejemplo (`stillDefault`, que
// `DefaultComposer` puebla solo con `required`) y las secciones visibles **sin un solo valor**. Todo
// lo demás —la sección «Mis papás y padrinos» con «Nombre de la mamá» y «Nombre del papá», el
// itinerario de ejemplo, la mesa de regalos de muestra— es opcional, no aparecía por ningún lado, y
// se publicaba tal cual con su título bien visible.
//
// QUÉ SE HACE AQUÍ, y por qué en el cliente. El `ComposedDocument` que el editor ya tiene dice, por
// cada bloque, de dónde sale su valor (`provenance`), y `"default"` significa exactamente «esto lo
// escribió el paquete, no la clienta». No hace falta ninguna ruta nueva ni tocar el backend: la
// lista se calcula sobre el mismo compuesto que pinta el lienzo. Se respeta el contrato de
// publicación (`03 §6`): **solo bloquean los obligatorios**; esto es material de AVISO, para que
// nadie publique sin haberlo visto.
//
// Se excluyen: las secciones ocultas (no las ve ninguna invitada), los bloques sin valor
// (`provenance: "empty"`, de los que ya avisa `TPL_SECTION_EMPTY`), los `fixed` (decoración del
// paquete, no contenido que la clienta deba escribir), los `business` y los `user`.
import type { ComposedDocument, TemplateManifest } from "@invitaciones/schema";

type Composed = ComposedDocument;
type Bloque = Composed["sections"][number]["blocks"][number];
type Valor = Extract<Bloque, { value: unknown }>["value"];

export interface BloqueDeEjemplo {
  sectionKey: string;
  /** Bloque de nivel superior (o el grupo entero) al que lleva «Editar». */
  blockId: string;
  etiqueta: string;
  /** El texto de ejemplo que verá la invitada, ya recortado. Puede ir vacío (una foto, un audio). */
  muestra: string;
  /** Número de fichas de ejemplo cuando el bloque es un grupo (itinerario, mesa de regalos…). */
  cantidad?: number;
}

export interface SeccionConEjemplos {
  sectionKey: string;
  titulo: string;
  bloques: BloqueDeEjemplo[];
  /** Ni un solo dato de la clienta: la sección entera es de muestra. */
  seccionEntera: boolean;
  /** El manifiesto declara `required: false`, así que se puede ocultar con `setSectionVisible`. */
  sePuedeOcultar: boolean;
}

const LARGO_MUESTRA = 64;

function recortar(texto: string): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  return limpio.length > LARGO_MUESTRA ? `${limpio.slice(0, LARGO_MUESTRA - 1)}…` : limpio;
}

/** El texto que la invitada leería. Vacío para lo que no es texto (una foto, un audio, un sí/no). */
export function muestraDe(valor: Valor): string {
  if (!valor) return "";
  switch (valor.kind) {
    case "text":
      return recortar(valor.value);
    case "richText":
      return recortar(valor.doc.content.flatMap((p) => p.content.map((s) => s.text)).join(" "));
    case "listText":
      return recortar(valor.items.join(" · "));
    case "date":
    case "time":
    case "dateTimeRange":
      return recortar(valor.formatted);
    case "link":
      return recortar(valor.label ?? valor.href);
    case "location":
      return recortar(valor.name);
    case "choice":
      return recortar(valor.label);
    case "person":
      return recortar(valor.name);
    case "image":
      return recortar(valor.alt);
    default:
      return "";
  }
}

/** Primer texto útil de un grupo de ejemplo, para poder enseñar de qué va sin listar 9 campos. */
function muestraDeGrupo(items: Extract<Bloque, { items: unknown }>["items"]): string {
  for (const item of items) {
    for (const campo of item.blocks) {
      const m = muestraDe(campo.value);
      if (m) return m;
    }
  }
  return "";
}

/** Secciones del manifiesto que NO se pueden ocultar (`required: true`, como la portada). */
function clavesObligatorias(manifest: TemplateManifest | null): Set<string> {
  const claves = new Set<string>();
  if (!manifest) return claves;
  for (const seccion of manifest.sections) if (seccion.required) claves.add(seccion.key);
  return claves;
}

/**
 * Todo lo que la invitada vería y sigue siendo contenido de ejemplo, agrupado por sección.
 *
 * `yaBloqueados` son los `blockId` que el preflight del servidor ya está reportando como bloqueo
 * (`TPL_PUBLISH_BLOCKED_DEFAULT_CONTENT`): no se repiten aquí, para no decir dos veces lo mismo en
 * la misma lista.
 */
export function ejemplosVisibles(
  composed: Composed | null,
  manifest: TemplateManifest | null,
  yaBloqueados: ReadonlySet<string> = new Set(),
): SeccionConEjemplos[] {
  if (!composed) return [];
  const obligatorias = clavesObligatorias(manifest);
  const salida: SeccionConEjemplos[] = [];

  for (const seccion of composed.sections) {
    if (!seccion.visible) continue;
    const bloques: BloqueDeEjemplo[] = [];
    let conDatosDeLaClienta = 0;
    let deEjemplo = 0;

    for (const bloque of seccion.blocks) {
      const esGrupo = "items" in bloque;
      const vacio = esGrupo ? bloque.items.length === 0 : bloque.value === null;
      if (vacio) continue;
      if (bloque.provenance === "user" || bloque.provenance === "business") {
        conDatosDeLaClienta += 1;
        continue;
      }
      if (bloque.provenance !== "default") continue; // `fixed`: decoración del paquete
      deEjemplo += 1;
      if (yaBloqueados.has(bloque.id)) continue;
      bloques.push({
        sectionKey: seccion.key,
        blockId: bloque.id,
        etiqueta: bloque.label,
        muestra: esGrupo ? muestraDeGrupo(bloque.items) : muestraDe(bloque.value),
        ...(esGrupo ? { cantidad: bloque.items.length } : {}),
      });
    }

    if (bloques.length === 0) continue;
    salida.push({
      sectionKey: seccion.key,
      titulo: seccion.title,
      bloques,
      seccionEntera: deEjemplo > 0 && conDatosDeLaClienta === 0,
      sePuedeOcultar: !obligatorias.has(seccion.key),
    });
  }

  return salida;
}

/** Cuántos bloques de ejemplo hay en total (para el resumen del diálogo). */
export function cuantosEjemplos(secciones: SeccionConEjemplos[]): number {
  return secciones.reduce((n, s) => n + s.bloques.length, 0);
}
