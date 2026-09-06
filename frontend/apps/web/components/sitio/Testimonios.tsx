// components/sitio/Testimonios.tsx — prueba social de la portada (`11 §7`).
//
// REGLA QUE NO SE NEGOCIA: no hay clientas reales todavía, así que estos textos van marcados como
// ejemplo con un `Badge` en cada tarjeta y un aviso a la vista. Un testimonio inventado sin marcar
// es publicidad falsa, y ni la portada ni ninguna captura de esta fase pueden contenerlo. Los
// retratos tampoco existen (`11 §9`, `testimonio-1..3`): el `Avatar` cae en iniciales, que es su
// estado diseñado, no un hueco.
//
// Forma del bloque: la sombra de color de la primera tarjeta (`Card variant="color"`), ÚNICA en
// toda la página (`11 §3.4` R8).
import { Avatar } from "@invitaciones/ui/componentes/Avatar/index.ts";
import { Badge } from "@invitaciones/ui/componentes/Badge/index.ts";
import { Card } from "@invitaciones/ui/componentes/Card/index.ts";
import { es_MX } from "@/lib/i18n";
import { Seccion } from "./Seccion.tsx";

const TESTIMONIOS = [
  es_MX.sitio.testimonios.uno,
  es_MX.sitio.testimonios.dos,
  es_MX.sitio.testimonios.tres,
] as const;

export function Testimonios() {
  return (
    <Seccion id="testimonios" titulo={es_MX.sitio.testimonios.titulo} intro={es_MX.sitio.testimonios.aviso} fondo="alterno">
      <ul className="mt-10 grid gap-6 md:grid-cols-3">
        {TESTIMONIOS.map((testimonio, indice) => (
          <li key={testimonio.autora} className="h-full">
            <Card variant={indice === 0 ? "color" : "plana"} tone="support-2" as="figure" className="h-full">
              <Badge tone="neutro">{es_MX.comun.ejemplo}</Badge>
              <blockquote className="text-md mt-3 text-ui-ink">{testimonio.cita}</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <Avatar nombre={testimonio.autora} size="md" />
                <span className="min-w-0">
                  <span className="text-sm block font-semibold text-ui-ink">{testimonio.autora}</span>
                  <span className="text-sm block text-ui-ink-muted">{testimonio.evento}</span>
                </span>
              </figcaption>
            </Card>
          </li>
        ))}
      </ul>
    </Seccion>
  );
}
