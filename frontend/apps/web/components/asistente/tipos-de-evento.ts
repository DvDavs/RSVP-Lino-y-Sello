// components/asistente/tipos-de-evento.ts — el catálogo cerrado de tipos de evento del asistente
// (`@invitaciones/schema` `EventKind`, ocho valores) con lo que la interfaz necesita de cada uno:
// nombre en es-MX, icono propio de `@invitaciones/icons` y el id de la fotografía pendiente que
// pinta su tarjeta (`docs/rediseno-plantillas/imagenes-pendientes.md`).
//
// El mapeo `nombre de la invitación → EventKind` es el ESPEJO del que ya hace el backend en
// `BusinessSnapshotReader.NOMBRE_A_EVENT_KIND` (normaliza acentos y mayúsculas y compara contra el
// catálogo sembrado). Se replica aquí —y no se inventa uno nuevo— porque `GET /user/invitations/all`
// devuelve el NOMBRE del tipo de evento (`"Boda"`, `"Quince años"`), no el `EventKind`: sin esta
// tabla el asistente no podría preseleccionar el tipo real de la invitación y volvería a dejar
// abierta UX-N-02 (elegir una plantilla de boda para unos XV años).
import type { EventKind } from "@invitaciones/schema";
import {
  IconoBautizo,
  IconoBoda,
  IconoComunion,
  IconoCumpleanos,
  IconoGraduacion,
  IconoInvitacion,
  IconoXvAnos,
} from "@invitaciones/icons";

/** Los iconos del sistema son `forwardRef`; se tipan por el propio componente, no por `ComponentType`. */
type ComponenteIcono = typeof IconoBoda;

export interface TipoDeEvento {
  readonly kind: EventKind;
  /** Nombre en es-MX, tal y como se lee en la tarjeta y en «Continuar con …». */
  readonly nombre: string;
  readonly Icono: ComponenteIcono;
  /** Id de la foto pendiente (`imagenes-pendientes.md`); viaja al placeholder del sistema. */
  readonly imagenId: string;
  /** Ruta pública de la foto ya entregada; sin ella se mantiene el placeholder. */
  readonly imagenSrc?: string;
}

/**
 * Los ocho `EventKind`, en el orden en que se ofrecen. `confirmation` reutiliza el icono de
 * `comunion` y `generic` el de `invitacion`: el inventario de `11 §4.2` no dibuja «confirmación» y
 * su octavo tipo de evento es `corporativo`, que no es un `EventKind` y por eso no se usa aquí
 * (anotado como supuesto en
 * `preguntas-abiertas.md` § Fase 3-C · 3C-6).
 */
export const TIPOS_DE_EVENTO: readonly TipoDeEvento[] = [
  { kind: "wedding", nombre: "Boda", Icono: IconoBoda, imagenId: "asistente/tipo-boda", imagenSrc: "/imagenes/asistente/tipo-boda.webp" },
  { kind: "quince", nombre: "XV años", Icono: IconoXvAnos, imagenId: "asistente/tipo-xv-anos", imagenSrc: "/imagenes/asistente/tipo-xv-anos.webp" },
  { kind: "baptism", nombre: "Bautizo", Icono: IconoBautizo, imagenId: "asistente/tipo-bautizo", imagenSrc: "/imagenes/asistente/tipo-bautizo.webp" },
  { kind: "communion", nombre: "Primera comunión", Icono: IconoComunion, imagenId: "asistente/tipo-comunion", imagenSrc: "/imagenes/asistente/tipo-comunion.webp" },
  { kind: "confirmation", nombre: "Confirmación", Icono: IconoComunion, imagenId: "asistente/tipo-confirmacion", imagenSrc: "/imagenes/asistente/tipo-confirmacion.webp" },
  { kind: "birthday", nombre: "Cumpleaños", Icono: IconoCumpleanos, imagenId: "asistente/tipo-cumpleanos", imagenSrc: "/imagenes/asistente/tipo-cumpleanos.webp" },
  { kind: "graduation", nombre: "Graduación", Icono: IconoGraduacion, imagenId: "asistente/tipo-graduacion", imagenSrc: "/imagenes/asistente/tipo-graduacion.webp" },
  { kind: "generic", nombre: "Otra celebración", Icono: IconoInvitacion, imagenId: "asistente/tipo-otra", imagenSrc: "/imagenes/asistente/tipo-otra.webp" },
];


const POR_KIND = new Map<EventKind, TipoDeEvento>(TIPOS_DE_EVENTO.map((t) => [t.kind, t]));

export function tipoDeEvento(kind: EventKind): TipoDeEvento {
  const encontrado = POR_KIND.get(kind);
  // El mapa cubre el enum entero; el fallback existe para un dato del servidor fuera del catálogo.
  return encontrado ?? TIPOS_DE_EVENTO[TIPOS_DE_EVENTO.length - 1];
}

export function nombreDeTipo(kind: EventKind): string {
  return tipoDeEvento(kind).nombre;
}

/** ¿La cadena es uno de los ocho `EventKind`? (para leer `?tipo=` de la URL sin confiar en ella). */
export function esEventKind(valor: string | null | undefined): valor is EventKind {
  return valor !== null && valor !== undefined && POR_KIND.has(valor as EventKind);
}

/** Minúsculas, sin acentos y sin espacios de más: la misma normalización que hace Kotlin. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Espejo de `BusinessSnapshotReader.NOMBRE_A_EVENT_KIND` (backend, módulo `templates2`). */
const NOMBRE_A_KIND: ReadonlyMap<string, EventKind> = new Map([
  ["boda", "wedding" as const],
  ["quince anos", "quince" as const],
  ["xv anos", "quince" as const],
  ["bautizo", "baptism" as const],
  ["comunion", "communion" as const],
  ["primera comunion", "communion" as const],
  ["confirmacion", "confirmation" as const],
  ["cumpleanos", "birthday" as const],
  ["graduacion", "graduation" as const],
]);

/**
 * Tipo de evento de una invitación a partir del NOMBRE que devuelve `/user/invitations/all`.
 * Sin coincidencia devuelve `generic`, que es un valor de dominio legítimo («evento fuera del
 * catálogo específico»), nunca un descarte silencioso.
 */
export function eventKindDeNombre(nombre: string | null | undefined): EventKind {
  if (!nombre) return "generic";
  return NOMBRE_A_KIND.get(normalizar(nombre)) ?? "generic";
}

// ── `?tipo=` de la URL ─────────────────────────────────────────────────────────────────────────
//
// La portada enlaza `/editor?tipo=<slug en español>` (`components/sitio/TiposDeEvento.tsx`:
// `boda`, `xv-anos`, `bautizo`, `comunion`, `cumpleanos`, `graduacion`, `corporativo`) y ninguno de
// esos siete valores es un `EventKind`, así que el asistente los descartaba TODOS en silencio
// (3C-UX G-02: «`?tipo=xv-anos` de la portada se ignora»). Esta tabla es el puente, y va aquí y no
// en la portada porque el asistente es quien LEE el parámetro: el enlace de la portada no cambia.
//
// También se escribe el slug en español al navegar entre pasos (3C-UX B-19: `?tipo=quince` y
// `?tipo=baptism` eran identificadores internos a la vista); el lector sigue aceptando los ocho
// `EventKind` crudos, que es lo que teclean las pruebas y lo que quedó en enlaces ya compartidos.
const SLUG_A_KIND: ReadonlyMap<string, EventKind> = new Map([
  ["boda", "wedding" as const],
  ["xv-anos", "quince" as const],
  ["xv", "quince" as const],
  ["quince-anos", "quince" as const],
  ["bautizo", "baptism" as const],
  ["comunion", "communion" as const],
  ["primera-comunion", "communion" as const],
  ["confirmacion", "confirmation" as const],
  ["cumpleanos", "birthday" as const],
  ["graduacion", "graduation" as const],
  // `corporativo` es el octavo cuadro de la portada y NO es un `EventKind` (`11 §4.2`): cae en
  // `generic` («Otra celebración»), que es su sitio en el catálogo cerrado del dominio.
  ["corporativo", "generic" as const],
  ["otra", "generic" as const],
]);

const KIND_A_SLUG: ReadonlyMap<EventKind, string> = new Map([
  ["wedding", "boda"],
  ["quince", "xv-anos"],
  ["baptism", "bautizo"],
  ["communion", "comunion"],
  ["confirmation", "confirmacion"],
  ["birthday", "cumpleanos"],
  ["graduation", "graduacion"],
  ["generic", "otra"],
]);

/** `?tipo=` → `EventKind`. Acepta el slug en español de la portada y el `EventKind` crudo. */
export function eventKindDeParametro(valor: string | null | undefined): EventKind | null {
  if (valor === null || valor === undefined) return null;
  const limpio = normalizar(valor).replace(/\s+/g, "-");
  if (esEventKind(limpio)) return limpio;
  return SLUG_A_KIND.get(limpio) ?? null;
}

/** `EventKind` → el slug en español que viaja en `?tipo=` (el mismo que enlaza la portada). */
export function slugDeTipo(kind: EventKind): string {
  return KIND_A_SLUG.get(kind) ?? "otra";
}
