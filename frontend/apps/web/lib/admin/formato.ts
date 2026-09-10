// lib/admin/formato.ts — funciones PURAS de presentación para `/admin`. Viven aquí para que la
// pantalla que las use no tenga que decidir cómo se ve un importe, una fecha o un estado: solo
// llama a una función y pinta el resultado. Ninguna hace red, ninguna lanza — cada una tolera el
// dato ausente o vacío y devuelve el guion largo del sistema («—», el mismo que usa el wireframe
// de `12-producto-completo.md §B3.6` para «—» en la columna Plan) en vez de "Invalid Date" o
// cualquier otro texto en inglés.
import type { EstadoInvitacion, EstadoPago } from "./tipos.ts";
import { textosAdmin } from "./textos.ts";

/** El guion largo del sistema: el único "vacío" que se enseña en las tablas de `/admin`. */
export const GUION_LARGO = "—";

// -------------------------------------------------------------------------------------------
// Importes
// -------------------------------------------------------------------------------------------
/**
 * Formatea un importe en la moneda que trae el propio dato (`es-MX`, nunca codificada a "MXN"):
 * `contrato-admin.md §5` deja `moneda` como un campo del backend, no una constante. Un importe
 * ausente se trata como cero (una fila sin importe todavía debe poder pintarse en la tabla).
 */
export function formatearImporte(importe: number | null | undefined, moneda: string | null | undefined): string {
  const valor = typeof importe === "number" && Number.isFinite(importe) ? importe : 0;
  const codigoMoneda = moneda && moneda.trim().length > 0 ? moneda : "MXN";
  try {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: codigoMoneda }).format(valor);
  } catch {
    // Un código de moneda que `Intl` no reconoce (dato corrupto) no debe tirar la fila entera.
    return `${valor.toFixed(2)} ${codigoMoneda}`;
  }
}

// -------------------------------------------------------------------------------------------
// Fechas
// -------------------------------------------------------------------------------------------
/** Fecha corta es-MX a partir de un ISO 8601 (`altaEn`, `creadaEn`, `fecha` de pagos…). */
export function formatearFechaCorta(fechaIso: string | null | undefined): string {
  if (!fechaIso || fechaIso.trim().length === 0) return GUION_LARGO;
  const fecha = new Date(fechaIso);
  if (Number.isNaN(fecha.getTime())) return GUION_LARGO;
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(fecha);
}

/**
 * La fecha del evento: `YYYY-MM-DD` + `HH:mm` por separado (así los devuelve
 * `contrato-admin.md §3`, dos campos sueltos, no un ISO combinado). Cualquiera de los dos puede
 * venir vacío — una invitación recién creada todavía no tiene fecha de evento — y en ese caso se
 * omite esa parte; si las dos faltan, el resultado es el guion largo, nunca "Invalid Date".
 */
export function formatearFechaEvento(fecha: string | null | undefined, hora: string | null | undefined): string {
  const fechaLimpia = fecha && fecha.trim().length > 0 ? fecha.trim() : null;
  const horaLimpia = hora && hora.trim().length > 0 ? hora.trim() : null;

  if (!fechaLimpia && !horaLimpia) return GUION_LARGO;

  let fechaFormateada = fechaLimpia;
  if (fechaLimpia) {
    // `YYYY-MM-DD` se parsea a mano: `new Date("YYYY-MM-DD")` lo interpreta en UTC y puede mover
    // el día en zonas al oeste de Greenwich (la fecha del evento nunca lleva hora en esa cadena).
    const coincide = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaLimpia);
    if (coincide) {
      const [, anio, mes, dia] = coincide;
      const fechaLocal = new Date(Number(anio), Number(mes) - 1, Number(dia));
      if (!Number.isNaN(fechaLocal.getTime())) {
        fechaFormateada = new Intl.DateTimeFormat("es-MX", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(fechaLocal);
      }
    }
  }

  if (fechaFormateada && horaLimpia) return `${fechaFormateada}, ${horaLimpia}`;
  return fechaFormateada ?? horaLimpia ?? GUION_LARGO;
}

// -------------------------------------------------------------------------------------------
// Etiquetas de estado
// -------------------------------------------------------------------------------------------
/** Traduce un `EstadoInvitacion` a su etiqueta de interfaz (`textos.ts`). Tolera lo desconocido. */
export function etiquetaEstadoInvitacion(estado: string | null | undefined): string {
  switch (estado as EstadoInvitacion) {
    case "publicada":
      return textosAdmin.invitaciones.estados.publicada;
    case "en-edicion":
      return textosAdmin.invitaciones.estados.enEdicion;
    case "deshabilitada":
      return textosAdmin.invitaciones.estados.deshabilitada;
    default:
      return textosAdmin.comun.estadoDesconocido;
  }
}

/** Traduce un `EstadoPago` a su etiqueta de interfaz (`textos.ts`). Tolera lo desconocido. */
export function etiquetaEstadoPago(estado: string | null | undefined): string {
  switch (estado as EstadoPago) {
    case "pagado":
      return textosAdmin.pagos.estados.pagado;
    case "pendiente":
      return textosAdmin.pagos.estados.pendiente;
    case "devuelto":
      return textosAdmin.pagos.estados.devuelto;
    default:
      return textosAdmin.comun.estadoDesconocido;
  }
}
