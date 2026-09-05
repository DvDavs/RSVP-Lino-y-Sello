// instrumentation.ts — comprobación de arranque del servidor (U-6 y N-02).
//
// Next ejecuta `register()` UNA vez, al arrancar el servidor, antes de atender ninguna petición
// (convención `instrumentation.ts`, next@16). Es el único punto donde se puede negar el arranque.
//
// Son DOS comprobaciones distintas y las dos tienen que pasar:
//   · `motivoDeArranqueInvalido` (U-6, bloque 3-8) — el origen público declarado no puede ser
//     `localhost` en un despliegue real. Puerta de escape: `PERMITIR_ORIGEN_LOCAL=1`.
//   · `motivoDeOrigenDesalineado` (N-02, `ADR-3C-N02-01`) — el origen HORNEADO en el build no puede
//     discrepar del que este proceso va a servir. Puerta de escape: `PERMITIR_ORIGEN_DESALINEADO=1`.
//     Sin ella, el desajuste rompe la vista previa del lienzo y los enlaces compartidos EN SILENCIO,
//     y ninguna compuerta del repositorio lo ve (Playwright y LHCI reconstruyen antes de servir).
//
// ─── POR QUÉ `process.exit` Y NO `throw` ───────────────────────────────────────────────────────
// El bloque 3-8 escribió aquí un `throw`, dando por hecho que mataba el proceso («lo más parecido a
// no arrancar que ofrece el marco»). **No lo mata.** Medido en la fase 3-C, con `next@16` y un
// artefacto horneado para `:3050` arrancado con `PORT=3000`: Next CAPTURA la excepción de
// `register()`, la imprime como un error más del registro y **sigue sirviendo**; el servidor quedó
// escuchando en `:3000` (lo delató un `EADDRINUSE` al intentar levantar otro encima). Es decir: la
// guarda de arranque de U-6 llevaba desde el bloque 3-8 siendo un mensaje en un log que nadie mira,
// no una guarda. La salida literal está en
// `docs/rediseno-plantillas/evidencia/fase-3c/bloque-menos1/ab-origen-salida.txt`.
//
// Con `process.exit(1)` el proceso muere de verdad y el orquestador de despliegue lo ve como lo que
// es: un arranque fallido. El mensaje va a `stderr` en un recuadro, para que tampoco se pueda pasar
// por alto en el caso de que alguien lo relance en bucle.
//
// El criterio de cada comprobación y sus puertas de escape están explicados y probados en
// `lib/enlace-publico.ts` y `lib/enlace-publico.test.ts`; aquí sólo se aplican.
import { motivoDeArranqueInvalido, motivoDeOrigenDesalineado } from "./lib/enlace-publico.ts";

function abortar(titulo: string, motivo: string): never {
  const raya = "═".repeat(96);
  console.error(`\n${raya}\n  ARRANQUE ABORTADO · ${titulo}\n${raya}\n  ${motivo}\n${raya}\n`);
  process.exit(1);
}

export function register(): void {
  const motivo = motivoDeArranqueInvalido();
  if (motivo) abortar("configuración inválida del origen público (U-6)", motivo);

  const desalineado = motivoDeOrigenDesalineado();
  if (desalineado) abortar("el origen del build no es el que se va a servir (N-02)", desalineado);
}
