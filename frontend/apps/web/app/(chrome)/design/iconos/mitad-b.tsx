// app/(chrome)/design/iconos/mitad-b.tsx — los nombres 42 a 82 del inventario (doc 11 §4.2, en el
// orden del doc: historia y las secciones restantes, estados, RSVP e invitados, compartir, cuenta y
// tipos de evento). Misma convención que `mitad-a.tsx`: lista EXPLÍCITA, no derivada de `iconNames`,
// para que las dos mitades no dupliquen entradas. Reescrito por el orquestador al integrar 3C-3B
// sobre la infraestructura de 3C-3A (los 41 SVG de la mitad B se conservan tal cual).
import type { EntradaGaleria } from "./tipos.ts";

const NOMBRES = [
  "historia", "vestimenta", "pie", "lugar", "reloj", "exito", "aviso", "error", "info",
  "cargando", "candado", "chispa", "imagen-pendiente", "confirmar", "rechazar", "invitados", "mesa", "nota",
  "alergia", "ninos", "compartir", "enlace", "copiar", "chat", "descargar", "qr", "correo",
  "telefono", "cuenta", "plan", "pago", "salir", "entrar", "boda", "xv-anos", "bautizo",
  "comunion", "cumpleanos", "graduacion", "corporativo", "invitacion",
] as const;

export const iconosMitadB: EntradaGaleria[] = NOMBRES.map((nombre) => ({ nombre }));
