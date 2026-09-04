import estilos from "./pagina.module.css";

/**
 * Estado de carga de la primera visita (la que genera y cachea, `04 §15.1`). Las siguientes se
 * sirven del caché ISR y no pasan por aquí.
 *
 * Es un `<p role="status">` y no un esqueleto animado a propósito: un esqueleto con la forma de la
 * invitación se pintaría con colores que todavía no se conocen (el tema viene del documento) y
 * produciría el salto de layout que `04 §16.1` (CLS < 0,1) trata de evitar.
 */
export default function CargandoInvitacion() {
  return (
    <main className={estilos.aviso}>
      <p className={estilos.avisoCuerpo} role="status" aria-live="polite">
        Cargando la invitación…
      </p>
    </main>
  );
}
