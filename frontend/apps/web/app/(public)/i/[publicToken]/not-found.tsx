import { textosPublicos } from "./textos";
import estilos from "./pagina.module.css";

/**
 * `404 TPL_RELEASE_NOT_FOUND` — UN SOLO estado para token inexistente, rotado, sin release,
 * despublicado y `uses_templates2=false` (`handoffs/2-5.md`, `03 §3.15`). El backend no los
 * distingue a propósito, para no dar un oráculo de enumeración de tokens, y esta página tampoco:
 * el mismo texto para los cinco casos.
 *
 * El literal del encabezado NO se cambia: `e2e/publico-no-disponible.spec.ts:10` y
 * `e2e/a11y.spec.ts:9` lo afirman y son de otro bloque (prohibido tocarlos). 3C-8: la fuente de ese
 * literal se movió de `es_MX.publico.noDisponible` (`lib/i18n.ts`) a `textosPublicos` (`./textos.ts`)
 * — mismo texto, sin arrastrar el resto del chrome (`editor.*`, `asistente.*`) a esta ruta pública.
 *
 * Sin chrome y sin `--ui-*`: esta ruta no importa `globals.css` (P3). Los `--inv-*` que usa son los
 * valores de RESERVA de `tokens.css` — aquí no hay documento del que sacar tema.
 */
export default function InvitacionNoDisponible() {
  return (
    <main className={estilos.aviso}>
      <h1 className={estilos.avisoTitulo}>{textosPublicos.noDisponible.titulo}</h1>
      <hr className={estilos.filete} />
      <p className={estilos.avisoCuerpo}>{textosPublicos.noDisponible.cuerpo}</p>
    </main>
  );
}
