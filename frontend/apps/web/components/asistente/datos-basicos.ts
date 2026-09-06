// components/asistente/datos-basicos.ts — lógica pura del paso 3 del asistente («Los datos
// básicos»: ¿quiénes celebran?, ¿cuándo?, ¿dónde?).
//
// Los campos NO se cablean a ids de bloque de una plantilla concreta: se DERIVAN del documento
// compuesto que devuelve `:choose-template`, buscando por ROL (`packages/schema` `BlockRole`, el
// catálogo cerrado que existe justamente para no emparejar por texto ni por posición, H-01/H-02).
// Así el mismo paso funciona con `boda-clasica` (celebrantA/celebrantB de tipo `person`) y con
// `xv-jardin` (honoree), y con cualquier plantilla futura, sin tocar este archivo.
//
// Lo que este paso NO hace: inventar rutas. La fecha se guarda con `PUT …/event` (I-06, la única
// ruta de cliente que escribe `invitation.date`) y los nombres y el lugar con
// `POST …/document/operations`, que es la ruta de siempre. Ningún campo es obligatorio: el texto de
// la pantalla dice «Puedes cambiarlos después» y el asistente cumple esa promesa.
import type { ComposedDocument, Operation } from "@invitaciones/schema";

/** Los dos habitantes de `ComposedSection.blocks`: bloque escalar o grupo con ítems. */
type BloqueCompuesto = ComposedDocument["sections"][number]["blocks"][number];
type GrupoCompuesto = Extract<BloqueCompuesto, { items: unknown }>;

/**
 * `ComposedBlock.type` es el `BlockKind` completo (incluye `"group"`) y `ComposedGroup.type` es el
 * literal `"group"`: comparar por `type` NO discrimina la unión. La presencia de `items` sí.
 */
function esGrupo(bloque: BloqueCompuesto): bloque is GrupoCompuesto {
  return "items" in bloque;
}

/** Dónde vive el valor que escribe un campo del paso 3. */
export type DestinoDeCampo =
  | { readonly tipo: "text"; readonly blockId: string }
  | { readonly tipo: "person"; readonly blockId: string }
  | { readonly tipo: "location"; readonly blockId: string }
  /** El rol vive dentro de un ítem de grupo (p. ej. `event.cards` → primer momento del día). */
  | { readonly tipo: "locationEnItem"; readonly groupId: string; readonly itemId: string; readonly blockId: string };

export interface CampoDeDatos {
  /** Clave del campo en el formulario (estable entre renders). */
  readonly id: string;
  /** Etiqueta que la PLANTILLA le da al bloque («Novio», «Quinceañera», «Dónde»). */
  readonly etiqueta: string;
  readonly grupo: "quienes" | "donde";
  readonly destino: DestinoDeCampo;
  /** Texto que ya trae el documento (contenido de ejemplo incluido). */
  readonly valorInicial: string;
  readonly maxLength: number;
}

const MAX_NOMBRE = 120;
const MAX_LUGAR = 120;

interface BloqueEncontrado {
  readonly id: string;
  readonly role: string;
  readonly type: string;
  readonly label: string;
  readonly texto: string;
}

function textoDe(valor: unknown): string {
  if (valor === null || typeof valor !== "object") return "";
  const v = valor as { kind?: string; value?: unknown; name?: unknown };
  if (v.kind === "text" && typeof v.value === "string") return v.value;
  if ((v.kind === "person" || v.kind === "location") && typeof v.name === "string") return v.name;
  return "";
}

/** Bloques escalares de primer nivel del documento compuesto, en orden de sección. */
function bloquesDeRaiz(composed: ComposedDocument): readonly BloqueEncontrado[] {
  const salida: BloqueEncontrado[] = [];
  for (const seccion of composed.sections) {
    for (const bloque of seccion.blocks) {
      if (esGrupo(bloque)) continue;
      salida.push({
        id: bloque.id,
        role: bloque.role,
        type: bloque.type,
        label: bloque.label,
        texto: textoDe(bloque.value),
      });
    }
  }
  return salida;
}

function primeroConRol(bloques: readonly BloqueEncontrado[], rol: string): BloqueEncontrado | undefined {
  return bloques.find((b) => b.role === rol);
}

function campoDeNombre(bloque: BloqueEncontrado, indice: number): CampoDeDatos | null {
  if (bloque.type !== "text" && bloque.type !== "person") return null;
  return {
    id: `quienes-${indice}`,
    etiqueta: bloque.label,
    grupo: "quienes",
    destino: bloque.type === "person" ? { tipo: "person", blockId: bloque.id } : { tipo: "text", blockId: bloque.id },
    valorInicial: bloque.texto,
    maxLength: MAX_NOMBRE,
  };
}

/**
 * «¿Quiénes celebran?»: la pareja (`celebrantA`/`celebrantB`) si la plantilla la declara; si no, la
 * persona homenajeada (`honoree`); y como último recurso el título de portada (`coverTitle`), que
 * toda plantilla tiene. Nunca más de dos campos: el paso es «los datos básicos», no el editor.
 */
function camposDeQuienes(bloques: readonly BloqueEncontrado[]): readonly CampoDeDatos[] {
  const a = primeroConRol(bloques, "celebrantA");
  const b = primeroConRol(bloques, "celebrantB");
  const pareja = [a, b].filter((x): x is BloqueEncontrado => x !== undefined);
  if (pareja.length > 0) {
    return pareja.map((bloque, i) => campoDeNombre(bloque, i)).filter((c): c is CampoDeDatos => c !== null);
  }
  const homenajeada = primeroConRol(bloques, "honoree");
  if (homenajeada) {
    const campo = campoDeNombre(homenajeada, 0);
    if (campo) return [campo];
  }
  const portada = primeroConRol(bloques, "coverTitle");
  if (portada) {
    const campo = campoDeNombre(portada, 0);
    if (campo) return [campo];
  }
  return [];
}

/**
 * «¿Dónde?»: el primer bloque con rol `eventPlace`. En las plantillas reales vive DENTRO del grupo
 * de momentos del día (`event.cards`), así que también se busca en el primer ítem de cada grupo —
 * el primer momento es el que abre el itinerario y el que la clienta identifica como «el lugar».
 * Solo se escribe el nombre: la dirección y el mapa se completan en el editor, que es donde hay
 * sitio para ellos (y donde no se pierde lo que ya hubiera).
 */
function campoDeDonde(composed: ComposedDocument): CampoDeDatos | null {
  for (const seccion of composed.sections) {
    for (const bloque of seccion.blocks) {
      if (!esGrupo(bloque)) {
        if (bloque.role === "eventPlace" && bloque.type === "location") {
          return {
            id: "donde",
            etiqueta: bloque.label,
            grupo: "donde",
            destino: { tipo: "location", blockId: bloque.id },
            valorInicial: textoDe(bloque.value),
            maxLength: MAX_LUGAR,
          };
        }
        continue;
      }
      const primerItem = bloque.items[0];
      if (!primerItem) continue;
      const lugar = primerItem.blocks.find((b) => b.role === "eventPlace" && b.type === "location");
      if (lugar) {
        return {
          id: "donde",
          etiqueta: lugar.label,
          grupo: "donde",
          destino: { tipo: "locationEnItem", groupId: bloque.id, itemId: primerItem.itemId, blockId: lugar.id },
          valorInicial: textoDe(lugar.value),
          maxLength: MAX_LUGAR,
        };
      }
    }
  }
  return null;
}

/** Los campos del paso 3 que ESTA plantilla admite. Puede quedar vacío: entonces solo hay fecha. */
export function camposDeDatosBasicos(composed: ComposedDocument): readonly CampoDeDatos[] {
  const raiz = bloquesDeRaiz(composed);
  const donde = campoDeDonde(composed);
  return [...camposDeQuienes(raiz), ...(donde ? [donde] : [])];
}

/** Valores del formulario: `id` del campo → texto escrito. */
export type ValoresDeDatos = Readonly<Record<string, string>>;

/** Valores iniciales del formulario. El contenido de ejemplo NO se copia: se deja el campo vacío. */
export function valoresIniciales(campos: readonly CampoDeDatos[]): ValoresDeDatos {
  const salida: Record<string, string> = {};
  for (const campo of campos) salida[campo.id] = "";
  return salida;
}

/**
 * Operaciones para lo que la clienta escribió. Un campo vacío o igual a lo que ya había no genera
 * operación: escribir el mismo valor solo gastaría una revisión y promovería contenido de ejemplo a
 * contenido de usuario (justo lo que ADR-1R-F-04 prohíbe hacer por descuido).
 */
export function operacionesDeDatos(
  campos: readonly CampoDeDatos[],
  valores: ValoresDeDatos,
): readonly Operation[] {
  const operaciones: Operation[] = [];
  for (const campo of campos) {
    const texto = (valores[campo.id] ?? "").trim();
    if (texto.length === 0 || texto === campo.valorInicial) continue;
    const recortado = texto.slice(0, campo.maxLength);
    switch (campo.destino.tipo) {
      case "text":
        operaciones.push({ op: "setBlock", blockId: campo.destino.blockId, value: { kind: "text", value: recortado } });
        break;
      case "person":
        operaciones.push({ op: "setBlock", blockId: campo.destino.blockId, value: { kind: "person", name: recortado } });
        break;
      case "location":
        operaciones.push({ op: "setBlock", blockId: campo.destino.blockId, value: { kind: "location", name: recortado } });
        break;
      case "locationEnItem":
        operaciones.push({
          op: "setItemBlock",
          groupId: campo.destino.groupId,
          itemId: campo.destino.itemId,
          blockId: campo.destino.blockId,
          value: { kind: "location", name: recortado },
        });
        break;
    }
  }
  return operaciones;
}

/** `YYYY-MM-DD` — el formato que exige `PUT …/event` (`IsoDate`). */
export function esFechaIso(valor: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(valor);
}

/** `HH:mm` en 24 h. */
export function esHoraIso(valor: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(valor);
}
