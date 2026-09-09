// e2e/preparar-invitados.ts — ayudante propio de `invitados.spec.ts` (sesión E2-F1), aparte de
// `preparar.ts` (no se toca). Dos cosas:
//
// 1. `borrarInvitacionConInvitados`: `borrarInvitacion` de `preparar.ts` no conoce
//    `invitation_guest` (tabla del módulo nuevo, `V8__create_invitation_guest_table.sql`), que
//    referencia `invitation.id` SIN `ON DELETE CASCADE`. Sin borrar esas filas primero, el
//    `DELETE FROM invitation` de `borrarInvitacion` choca con la FK, el `catch` de ese archivo lo
//    traga en silencio («no es fatal para la prueba») y la invitación —y sus invitados— se quedan
//    huérfanos en el clúster. Se borra aquí, antes de delegar en la limpieza real.
// 2. `crearInvitadoDirecto`: alta de un invitado por la RUTA REAL (`POST …/guests`), para sembrar
//    datos de apoyo (búsqueda, filtro) sin pasar por la interfaz cuando lo que se está midiendo es
//    otra cosa. Misma disciplina que `preparar-panel.ts`: sin mocks, backend real (04 §20.3).
import { API_BASE, borrarInvitacion, sql } from "./preparar.ts";

export function borrarInvitacionConInvitados(invitationId: number): void {
  try {
    sql(`DELETE FROM invitation_guest WHERE invitation_id = ${invitationId};`);
  } catch {
    /* puede no existir ninguno */
  }
  borrarInvitacion(invitationId);
}

export interface DatosInvitado {
  readonly fullName: string;
  readonly email?: string;
  readonly phone?: string;
  readonly adults?: number;
  readonly children?: number;
  readonly young?: number;
}

export async function crearInvitadoDirecto(invitationId: number, token: string, datos: DatosInvitado): Promise<number> {
  const r = await fetch(`${API_BASE}/product/invitations/${invitationId}/guests`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(datos),
  });
  if (!r.ok) throw new Error(`POST .../guests respondió ${r.status}: ${await r.text()}`);
  const cuerpo = (await r.json()) as { id: number };
  return cuerpo.id;
}
