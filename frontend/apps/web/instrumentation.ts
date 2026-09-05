// instrumentation.ts — comprobación de arranque del servidor (U-6).
//
// Next ejecuta `register()` UNA vez, al arrancar el servidor, antes de atender ninguna petición
// (convención `instrumentation.ts`, next@16). Lanzar aquí es lo más parecido a «no arrancar» que
// ofrece el marco: el proceso muere con el motivo en la salida de error, en vez de servir durante
// meses un enlace `http://localhost/i/…` que ninguna invitada puede abrir.
//
// El criterio de «despliegue real» y la puerta de escape (`PERMITIR_ORIGEN_LOCAL=1`) están
// explicados y probados en `lib/enlace-publico.ts`; aquí solo se aplica.
import { motivoDeArranqueInvalido } from "./lib/enlace-publico.ts";

export function register(): void {
  const motivo = motivoDeArranqueInvalido();
  if (motivo) {
    throw new Error(`[arranque] Configuración inválida del origen público: ${motivo}`);
  }
}
