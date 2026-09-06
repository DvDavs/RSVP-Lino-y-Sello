// components/sitio/PasosComoFunciona.tsx — «Cómo funciona» en tres pasos (`11 §7`).
//
// Por qué NO usa `WizardProgress`: ese componente es el progreso de un asistente en curso —pinta
// «Paso 2 de 3» y marca el actual con `aria-current="step"`—, y aquí no hay ningún proceso en
// marcha que la persona esté recorriendo. Anunciarle a un lector de pantalla que está en el paso 1
// de 3 mientras lee una portada es mentirle. Lo que sí se conserva es la NUMERACIÓN visible del
// asistente (círculo con el número, misma medida de 30 px) sobre una lista ordenada de verdad.
import { Card } from "@invitaciones/ui/componentes/Card/index.ts";
import { Seal } from "@invitaciones/ui/shapes";
import { es_MX } from "@/lib/i18n";
import { Seccion } from "./Seccion.tsx";

const PASOS = [
  es_MX.sitio.pasos.uno,
  es_MX.sitio.pasos.dos,
  es_MX.sitio.pasos.tres,
] as const;

export function PasosComoFunciona() {
  return (
    <Seccion
      id="como-funciona"
      eyebrow={es_MX.sitio.comoFunciona}
      titulo={es_MX.sitio.pasos.titulo}
      intro={es_MX.sitio.pasos.intro}
      fondo="alterno"
    >
      <ol className="mt-10 grid gap-5 md:grid-cols-3">
        {PASOS.map((paso, indice) => (
          <li key={paso.titulo}>
            <Card variant="plana" as="article" className="h-full p-6">
              {/* El sello es la forma de la tarjeta (una por tarjeta, `11 §3.4` R1) y solo vive
                  detrás del número, nunca bajo el párrafo (R3). */}
              <div className="relative grid h-12 w-12 place-items-center">
                <Seal
                  points={12}
                  amplitude={4}
                  tone="primary-soft"
                  className="absolute inset-0 h-12 w-12"
                />
                <span className="label-lg relative text-ui-on-primary-soft">{indice + 1}</span>
              </div>
              <h3 className="heading-sm mt-4 text-ui-ink">{paso.titulo}</h3>
              <p className="text-md mt-2 text-ui-ink-muted">{paso.cuerpo}</p>
            </Card>
          </li>
        ))}
      </ol>
    </Seccion>
  );
}
