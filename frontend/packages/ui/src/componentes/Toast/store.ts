// packages/ui/src/componentes/Toast/store.ts — cola de tostadas del sistema (`11 §5` fila «Toast»):
// "cola, máximo 2 apilados". Un almacén externo minúsculo (sin contexto de React) para que `toast()`
// se pueda llamar desde cualquier parte (un manejador de evento, un efecto, fuera de un componente)
// sin tener que perforar props hasta la raíz; `Toaster` (el único punto de montaje) se suscribe con
// `useSyncExternalStore`.
export type TostadaVariante = "info" | "exito" | "error";

export interface TostadaEntrada {
  readonly id: string;
  readonly titulo?: string;
  readonly descripcion: string;
  readonly variante: TostadaVariante;
  /** Milisegundos antes del cierre automático. `Infinity` desactiva el cierre automático. */
  readonly duracion: number;
}

export type TostadaOpciones = Partial<Omit<TostadaEntrada, "id" | "descripcion">> & {
  readonly descripcion: string;
};

/** `11 §5`: "máximo 2 apilados". Al llegar una tercera, se retira la más antigua. */
export const TOPE_COLA = 2;
const DURACION_DEFECTO_MS = 4000;

type Escucha = () => void;

let cola: readonly TostadaEntrada[] = [];
const escuchas = new Set<Escucha>();
let contador = 0;

function emitir(): void {
  for (const escucha of escuchas) escucha();
}

function idNuevo(): string {
  contador += 1;
  return `tostada-${contador}`;
}

/** Encola una tostada y devuelve su id (útil para cerrarla a mano antes de que expire). */
export function agregarTostada(opciones: TostadaOpciones): string {
  const entrada: TostadaEntrada = {
    id: idNuevo(),
    titulo: opciones.titulo,
    descripcion: opciones.descripcion,
    variante: opciones.variante ?? "info",
    duracion: opciones.duracion ?? DURACION_DEFECTO_MS,
  };
  cola = cola.length >= TOPE_COLA ? [...cola.slice(1), entrada] : [...cola, entrada];
  emitir();
  return entrada.id;
}

export function quitarTostada(id: string): void {
  const siguiente = cola.filter((tostada) => tostada.id !== id);
  if (siguiente.length !== cola.length) {
    cola = siguiente;
    emitir();
  }
}

export function suscribirTostadas(escucha: Escucha): () => void {
  escuchas.add(escucha);
  return () => escuchas.delete(escucha);
}

export function obtenerCola(): readonly TostadaEntrada[] {
  return cola;
}

/** Solo para pruebas: deja la cola vacía entre casos (evita fugas entre `it()`). */
export function _reiniciarTostadasParaPruebas(): void {
  cola = [];
  emitir();
}
