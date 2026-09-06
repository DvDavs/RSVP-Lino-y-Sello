// preview-app/Diagnostico.tsx — los hallazgos de `check`, en el navegador, con EL MISMO texto que
// en la terminal.
//
// Importa `formatearHallazgo` y `resumen` de `../src/formato.ts` a propósito: ese módulo es el
// contrato del formato («tres líneas y ninguna más», `formato.ts:7-15`) y la guía de 30 minutos lo
// cita literalmente. Reescribir aquí un formato «más bonito» produciría dos mensajes distintos para
// el mismo fallo, que es justo lo que P1 prohíbe.
import { formatearHallazgo, resumen, type Hallazgo } from "../src/formato.ts";
import type { EstadoPreview } from "./estado.ts";
import "./diagnostico.css";

export function Diagnostico({ estado }: { readonly estado: EstadoPreview }) {
  const hallazgos = estado.hallazgos as readonly Hallazgo[];
  return (
    <section className="kit-diagnostico" aria-labelledby="kit-diag-titulo">
      <h2 id="kit-diag-titulo">El paquete no pasa <code>check</code></h2>
      <p className="kit-diagnostico__ruta">{estado.dir}</p>
      {hallazgos.length > 0
        ? (
          <ol className="kit-diagnostico__lista">
            {hallazgos.map((h, i) => (
              <li key={`${h.codigo}-${h.puntero}-${i}`} data-severidad={h.severidad}>
                <pre>{formatearHallazgo(h)}</pre>
              </li>
            ))}
          </ol>
        )
        : <pre className="kit-diagnostico__crudo">{estado.diagnostico}</pre>}
      <p className="kit-diagnostico__resumen">{resumen(hallazgos)}</p>
      <p className="kit-diagnostico__pie">
        El mismo texto sale de <code>pnpm plantilla check {estado.dir}</code>. Arregla, guarda y esta
        página se repinta sola.
      </p>
    </section>
  );
}
