// lib/admin/tipos.ts — los tipos TypeScript de las siete respuestas de `/product/admin/**`
// (contrato fijado por el orquestador de E5, `scratchpad/contrato-admin.md`). Una interfaz por
// ruta, con las claves EXACTAS que el backend devuelve — en español, porque `/product/**` es el
// módulo nuevo y esa es su convención (`contrato-admin.md` cabecera). Las uniones cerradas van
// como uniones de literales, nunca `string`: así un valor no contemplado por el contrato falla en
// compilación en vez de colarse silenciosamente hasta una pantalla.
//
// Excepción deliberada, la §4 del contrato: `alternarEstadoInvitacion` reutiliza
// `PUT /admin/invitations/{id}/toggle-status`, una ruta del backend HEREDADO
// (`InvitationController.kt:127-141`). Ese controlador no es `/product/admin` y sus claves son
// inglés (`status`, `event`, `date`…) porque el backend heredado usa inglés y no se toca
// (`contrato-admin.md` cabecera: «el backend heredado usa inglés y no se toca»). Por eso los tipos
// de esa única función llevan el sufijo `Heredado` y NO se mezclan con los siete tipos en español
// de abajo — mezclar las dos convenciones en un mismo objeto sería peor que tener dos.

// -------------------------------------------------------------------------------------------
// 1. GET /product/admin/metricas
// -------------------------------------------------------------------------------------------
/**
 * Cinco enteros, ni uno más (contrato §1). `rsvpUltimos7Dias` es un aproximado: cuenta
 * `invitation_guest.updated_at >= now() - 7 días` con `is_attending = true` porque no existe
 * columna de fecha de confirmación propia — lo advierte el propio contrato y queda anotado en
 * `preguntas-abiertas.md` por quien escribe el backend.
 */
export interface MetricasAdmin {
  clientas: number;
  invitaciones: number;
  publicadas: number;
  pagadas: number;
  rsvpUltimos7Dias: number;
}

// -------------------------------------------------------------------------------------------
// 2. GET /product/admin/clientas
// -------------------------------------------------------------------------------------------
export type RolClienta = "USER" | "ADMIN" | "MASTER";

export interface ClientaAdmin {
  id: number;
  /** `name + " " + lastName` ya compuesto por el backend (contrato §2). */
  nombre: string;
  correo: string;
  rol: RolClienta;
  habilitada: boolean;
  /** Cuántas invitaciones tiene esta clienta. */
  invitaciones: number;
  /** ISO 8601 con offset, p. ej. `2026-03-02T10:00:00Z`. */
  altaEn: string;
}

export interface PaginaClientas {
  total: number;
  pagina: number;
  tamano: number;
  elementos: ClientaAdmin[];
}

/**
 * `tamano` fuera de `[1,100]` NO se acota en el backend: se rechaza con 400 (comprobado contra el
 * backend real, `5-E5-R1` MEDIA-3: `?tamano=500` y `?tamano=0` devuelven
 * `{"errors":{"error":"El parámetro 'tamano' está entre 1 y 100; se recibió …"}}`). Aquí solo se
 * omite el parámetro de la query si viene `undefined`; un valor fuera de rango se manda tal cual y
 * `peticionAdmin()` lo clasifica como `UnknownApiError`, nunca como una página recortada en
 * silencio.
 */
export interface ClientasQuery {
  pagina?: number;
  tamano?: number;
  buscar?: string;
}

// -------------------------------------------------------------------------------------------
// 3. GET /product/admin/invitaciones
// -------------------------------------------------------------------------------------------
/**
 * `deshabilitada` gana sobre las otras dos (`invitation.is_enabled = false`); si está habilitada,
 * `publicada` cuando tiene un `tpl_release` activo, si no `en-edicion` (contrato §3).
 */
export type EstadoInvitacion = "publicada" | "en-edicion" | "deshabilitada";

/** Filtro de pago de la tabla de invitaciones (distinto del estado de un pago, ver `EstadoPago`). */
export type FiltroPagoInvitacion = "pagada" | "pendiente";

export interface InvitacionAdmin {
  id: number;
  evento: string;
  /** `YYYY-MM-DD`; puede venir vacía. */
  fecha: string;
  /** `HH:mm`; puede venir vacía. */
  hora: string;
  clientaId: number;
  clienta: string;
  /** `null` cuando la invitación no tiene plan asignado. */
  plan: string | null;
  pagada: boolean;
  /** `invitation.total_amount`. */
  importe: number;
  estado: EstadoInvitacion;
  /** El `public_token` SOLO si hay release activo; `null` en cualquier otro caso (contrato §3). */
  enlacePublico: string | null;
  usaTemplates2: boolean;
  creadaEn: string;
}

export interface PaginaInvitaciones {
  total: number;
  pagina: number;
  tamano: number;
  elementos: InvitacionAdmin[];
}

export interface InvitacionesQuery {
  pagina?: number;
  tamano?: number;
  buscar?: string;
  estado?: EstadoInvitacion;
  pago?: FiltroPagoInvitacion;
}

// -------------------------------------------------------------------------------------------
// 4. PUT /admin/invitations/{id}/toggle-status — ruta HEREDADA, tipos en inglés (ver cabecera)
// -------------------------------------------------------------------------------------------
/**
 * `InvitationResponseItem` (`modules/user/invitations/service/model/InvitationResponse.kt:3-14`).
 * OJO: pese al nombre, `status` aquí es el estado de PAGO heredado (`"paid" | "pending_payment"`),
 * no si la invitación quedó habilitada o deshabilitada — ese resultado del alternado no viaja en
 * esta respuesta, solo en el mensaje humano de `message`. Quien pinte la pantalla necesita volver
 * a pedir `listarInvitaciones` (o guardar el estado optimista) para refrescar la columna «Estado».
 */
export interface InvitacionHeredada {
  id: number;
  status: "paid" | "pending_payment";
  eventId: number;
  event: string;
  planId: number;
  plan: string;
  price: number;
  currency: string;
  date: string;
  time: string;
}

/** `InvitationResponse` (`modules/user/invitations/service/model/InvitationResponse.kt:16-20`). */
export interface AlternarEstadoInvitacionResponse {
  status: string;
  message: string;
  invitation: InvitacionHeredada;
}

// -------------------------------------------------------------------------------------------
// 5. GET /product/admin/pagos
// -------------------------------------------------------------------------------------------
/**
 * `"devuelto"` está admitido por el contrato para cuando E4 aporte la fuente real de pagos
 * (`origen: "pagos"`); la fuente de hoy (`PagosDesdeInvitaciones`) solo puede producir
 * `"pagado" | "pendiente"`, pero el tipo del cliente admite el tercero para no romper cuando
 * llegue (contrato §5).
 */
export type EstadoPago = "pagado" | "pendiente" | "devuelto";

export interface PagoAdmin {
  /** Con la fuente de hoy es `"inv-<id>"`; con E4 será el id real del pago. */
  id: string;
  invitacionId: number;
  clientaId: number;
  clienta: string;
  plan: string | null;
  importe: number;
  /** Sale de `producto.pagos.moneda` (`application.yml`, hoy `MXN`). Nunca se asume fija. */
  moneda: string;
  estado: EstadoPago;
  fecha: string;
}

export type OrigenPagos = "invitaciones" | "pagos";

export interface PaginaPagos {
  total: number;
  pagina: number;
  tamano: number;
  origen: OrigenPagos;
  elementos: PagoAdmin[];
}

export interface PagosQuery {
  pagina?: number;
  tamano?: number;
  estado?: EstadoPago;
}

// -------------------------------------------------------------------------------------------
// 6. GET /product/admin/planes
// -------------------------------------------------------------------------------------------
export interface PlanAdmin {
  id: number;
  nombre: string;
  /** Cuántas invitaciones usan este plan. */
  invitaciones: number;
}

export interface ListaPlanes {
  elementos: PlanAdmin[];
}

// -------------------------------------------------------------------------------------------
// 7. GET /product/admin/plantillas
// -------------------------------------------------------------------------------------------
/** `tpl_template_version.status` (contrato §7): solo estas dos, nunca «borrador» en esta consola. */
export type EstadoPlantilla = "published" | "deprecated";

export interface PlantillaAdmin {
  slug: string;
  version: string;
  estado: EstadoPlantilla;
  /** `event_kinds` tal cual (p. ej. `["wedding"]`); catálogo abierto, no se cierra a unión. */
  tiposDeEvento: string[];
  registradaEn: string;
  /** Cuántas invitaciones usan esta versión exacta (por `tpl_document`), con alcance por rol. */
  invitaciones: number;
}

export interface ListaPlantillas {
  total: number;
  elementos: PlantillaAdmin[];
}
