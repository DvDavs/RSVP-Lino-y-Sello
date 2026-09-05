// app/(chrome)/design/iconos/mitad-a.tsx — los primeros 41 nombres del inventario (doc 11 §4.2,
// en el orden del doc: navegación, edición, y las 6 secciones de invitación que caen antes del
// nombre 41 "familia"). Lista EXPLÍCITA (no derivada de `iconNames` de `@invitaciones/icons`):
// tras el merge con la mitad B ese paquete expondrá los 82 nombres y una lista derivada
// duplicaría entradas entre `mitad-a.tsx` y `mitad-b.tsx`.
import type { EntradaGaleria } from "./tipos.ts";

const NOMBRES = [
  "inicio", "atras", "adelante", "menu", "cerrar", "buscar", "ayuda", "ajustes", "externo",
  "chevron-abajo", "chevron-derecha",
  "editar", "deshacer", "rehacer", "guardar", "arrastrar", "subir", "bajar", "ver", "ocultar",
  "duplicar", "borrar", "agregar", "quitar", "recortar", "punto-focal", "paleta", "tipografia",
  "movil", "escritorio", "vista-previa",
  "portada", "celebrantes", "evento-fecha", "itinerario", "galeria", "mesa-de-regalos",
  "sugerencias", "comodidades", "rsvp-confirmado", "familia",
] as const;

export const iconosMitadA: EntradaGaleria[] = NOMBRES.map((nombre) => ({ nombre }));
