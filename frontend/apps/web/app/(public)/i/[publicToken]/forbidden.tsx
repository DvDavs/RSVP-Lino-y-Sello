import estilos from "./pagina.module.css";
import { textosPublicos } from "./textos";

/**
 * `403 TPL_INVITATION_UNAVAILABLE` — página PROPIA, no un 404 (`handoffs/2-5.md`: "403
 * TPL_INVITATION_UNAVAILABLE si la invitación o su dueño no están disponibles"; el backend lo
 * comprueba con `invitation.is_enabled`, `customer.is_enabled` y `!customer.is_banned`).
 *
 * Por qué no se mezcla con el 404: aquí el enlace SÍ existe y SÍ apunta a una invitación real. Un
 * "no encontramos esta invitación" haría que el invitado tirara el enlace, cuando lo correcto es
 * que vuelva a intentarlo más tarde o le escriba al anfitrión. El motivo concreto (cuenta
 * deshabilitada, bloqueada, invitación apagada) NO se dice: es información de negocio del cliente y
 * el invitado no tiene por qué recibirla (P8).
 *
 * Convención de archivo de Next para `forbidden()` (`experimental.authInterrupts` en
 * `next.config.ts`): responde con estado HTTP **403**, no con 200 ni con 404.
 */
export default function InvitacionNoDisponiblePorAhora() {
  return (
    <main className={estilos.aviso}>
      <h1 className={estilos.avisoTitulo}>{textosPublicos.noDisponibleAhora.titulo}</h1>
      <hr className={estilos.filete} />
      <p className={estilos.avisoCuerpo}>{textosPublicos.noDisponibleAhora.cuerpo}</p>
    </main>
  );
}
