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
import type { ComposedDocument, Operation, ScalarValue } from "@invitaciones/schema";

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

/** Valores de un ítem de grupo tal y como los acepta `addItem` (`ScalarValue` por `blockId`). */
export type ValoresDeItem = Readonly<Record<string, ScalarValue>>;

/** Dónde vive el valor que escribe un campo del paso 3. */
export type DestinoDeCampo =
  | { readonly tipo: "text"; readonly blockId: string }
  | { readonly tipo: "person"; readonly blockId: string }
  | { readonly tipo: "location"; readonly blockId: string }
  /**
   * El rol vive dentro de un ítem de grupo (p. ej. `event.cards` → primer momento del día) y ese
   * ítem YA existe en el documento (`provenance: "user"`): se escribe con `setItemBlock`.
   */
  | { readonly tipo: "locationEnItem"; readonly groupId: string; readonly itemId: string; readonly blockId: string }
  /**
   * El rol vive dentro de un grupo que TODAVÍA VIENE DE LOS DEFAULTS (3C-UX G-03). Es el caso de
   * toda invitación recién creada: `:choose-template` deja `content` vacío, así que los `itemId`
   * que se ven en el compuesto son los del paquete de plantilla y NO existen en el documento —
   * `setItemBlock` sobre ellos es `422 TPL_ITEM_UNKNOWN` (`operations-reducer.ts:187`, espejo de
   * `OperationReducer.kt`: «los `defaults` no se copian, el escalón de default opera a nivel de
   * bloque de grupo completo»).
   *
   * La única escritura legal contra ese grupo es `addItem`, que es lo que lo MATERIALIZA: en cuanto
   * `content[groupId]` existe, la composición deja de mirar los defaults (`compose.ts`, rama
   * `group`). Por eso el destino lleva los ítems por defecto ya rehidratados: se reenvían tal cual
   * —el itinerario de ejemplo no se pierde— y el lugar que escribió la clienta entra en el primero.
   */
  | {
      readonly tipo: "lugarEnGrupoPorDefecto";
      readonly groupId: string;
      readonly blockId: string;
      readonly itemsPorDefecto: readonly ValoresDeItem[];
    };

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
      if (!lugar) continue;
      const comun = { id: "donde", etiqueta: lugar.label, grupo: "donde" as const, valorInicial: textoDe(lugar.value), maxLength: MAX_LUGAR };
      // El grupo ya es del documento: el `itemId` es real y `setItemBlock` lo encuentra.
      if (bloque.provenance === "user") {
        return { ...comun, destino: { tipo: "locationEnItem", groupId: bloque.id, itemId: primerItem.itemId, blockId: lugar.id } };
      }
      // El grupo viene de los defaults: hay que materializarlo con `addItem` (3C-UX G-03).
      const itemsPorDefecto = rehidratarItems(bloque.items);
      // Si algún valor de ejemplo NO se puede reenviar tal cual (una foto: el compuesto trae la
      // `url` y `addItem` exige el `assetId`, ADR-021), materializar perdería contenido de la
      // clienta. Antes que eso, este paso no ofrece el campo y el lugar se escribe en el editor,
      // que edita el grupo entero. Nunca se manda una operación que se sabe condenada.
      if (itemsPorDefecto === null) continue;
      return { ...comun, destino: { tipo: "lugarEnGrupoPorDefecto", groupId: bloque.id, blockId: lugar.id, itemsPorDefecto } };
    }
  }
  return null;
}

/**
 * `ResolvedValue` (lo que trae el compuesto) → `ScalarValue` (lo que acepta `addItem`). Devuelve
 * `null` para lo que NO se puede reconstruir sin inventar: `image` y `audio` viajan resueltos como
 * `url` y el documento guarda `assetId` (ADR-021), así que no hay vuelta atrás desde el compuesto.
 */
export function rehidratarEscalar(valor: unknown): ScalarValue | null {
  if (valor === null || typeof valor !== "object") return null;
  const v = valor as Record<string, unknown>;
  switch (v.kind) {
    case "text":
      return typeof v.value === "string" ? { kind: "text", value: v.value } : null;
    case "richText":
      return v.doc !== undefined ? ({ kind: "richText", doc: v.doc } as ScalarValue) : null;
    case "listText":
      return Array.isArray(v.items) ? { kind: "listText", items: v.items as string[] } : null;
    case "date":
      return typeof v.value === "string" ? { kind: "date", value: v.value } : null;
    case "time":
      return typeof v.value === "string" ? { kind: "time", value: v.value } : null;
    case "dateTimeRange":
      // `formatted` es de presentación y NO existe en el `ScalarValue`: el objeto es estricto
      // (`z.strictObject`) y mandarlo sería `400`.
      return typeof v.start === "string"
        ? typeof v.end === "string"
          ? { kind: "dateTimeRange", start: v.start, end: v.end }
          : { kind: "dateTimeRange", start: v.start }
        : null;
    case "link":
      return typeof v.href === "string"
        ? typeof v.label === "string"
          ? { kind: "link", href: v.href, label: v.label }
          : { kind: "link", href: v.href }
        : null;
    case "location":
      return typeof v.name === "string"
        ? {
            kind: "location",
            name: v.name,
            ...(typeof v.address === "string" ? { address: v.address } : {}),
            ...(typeof v.mapHref === "string" ? { mapHref: v.mapHref } : {}),
          }
        : null;
    case "choice":
      // `label` también es presentación: el documento guarda solo el `optionId`.
      return typeof v.optionId === "string" ? { kind: "choice", optionId: v.optionId } : null;
    case "boolean":
      return typeof v.value === "boolean" ? { kind: "boolean", value: v.value } : null;
    case "person":
      return typeof v.name === "string"
        ? { kind: "person", name: v.name, ...(typeof v.note === "string" ? { note: v.note } : {}) }
        : null;
    default:
      return null;
  }
}

/** Los ítems de un grupo compuesto, listos para `addItem`. `null` si alguno no se puede rehidratar. */
function rehidratarItems(items: GrupoCompuesto["items"]): readonly ValoresDeItem[] | null {
  const salida: ValoresDeItem[] = [];
  for (const item of items) {
    const values: Record<string, ScalarValue> = {};
    for (const bloque of item.blocks) {
      if (bloque.value === null || bloque.value === undefined) continue; // hueco: no se manda nada
      const escalar = rehidratarEscalar(bloque.value);
      if (escalar === null) return null;
      values[bloque.id] = escalar;
    }
    salida.push(values);
  }
  return salida;
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
 * `TempId` de `packages/schema` (`^tmp:[A-Za-z0-9_-]{8,64}$`): el cliente NUNCA aporta ULIDs
 * (ADR-020, P8); el servidor los asigna y los devuelve en `idMap`.
 */
function tempId(): string {
  const azar = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `tmp:${azar.replace(/-/g, "").slice(0, 32)}`;
}

/**
 * Operaciones para lo que la clienta escribió. Un campo vacío o igual a lo que ya había no genera
 * operación: escribir el mismo valor solo gastaría una revisión y promovería contenido de ejemplo a
 * contenido de usuario (justo lo que ADR-1R-F-04 prohíbe hacer por descuido).
 */
export function operacionesDeDatos(
  campos: readonly CampoDeDatos[],
  valores: ValoresDeDatos,
  nuevoTempId: () => string = tempId,
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
      case "lugarEnGrupoPorDefecto": {
        // Materializar = reenviar los ítems de ejemplo, EN ORDEN, con `addItem`. El primero lleva
        // ya el lugar que escribió la clienta: una sola operación por ítem, ningún `setItemBlock`
        // contra un `itemId` que el servidor no conoce. El lote es atómico (ADR-014), así que o se
        // materializa entero o no cambia nada.
        //
        // La dirección y el mapa del EJEMPLO no se heredan: el nombre es otro lugar y quedarse con
        // el mapa del salón de la demostración mandaría a las invitadas a la dirección equivocada.
        const { groupId, blockId, itemsPorDefecto } = campo.destino;
        itemsPorDefecto.forEach((values, indice) => {
          operaciones.push({
            op: "addItem",
            groupId,
            tempId: nuevoTempId(),
            values: indice === 0 ? { ...values, [blockId]: { kind: "location", name: recortado } } : { ...values },
          });
        });
        break;
      }
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
