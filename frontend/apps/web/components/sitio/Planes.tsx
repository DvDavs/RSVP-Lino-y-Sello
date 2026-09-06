// components/sitio/Planes.tsx — «Elige tu plan» (`11 §7`).
//
// POR QUÉ NO HAY PRECIOS. Se buscó el extremo que los sirviera: el único que existe es
// `GET /master/plans` (`MasterPlansController.kt:33`), del módulo ANTIGUO de administración, y
// `lib/api-client.ts` no lo expone porque no es una ruta pública ni de cliente. `templates2` no
// tiene planes. Inventar una tabla de precios en la portada sería publicar una cifra que el
// producto no puede sostener, así que esta sección dice la verdad —el plan se contrata fuera—.
// Registrado en `preguntas-abiertas.md` (P-3C-5-1).
//
// G-01 (cierre 3-C, UX-C). Lo que faltaba no eran los precios: era A QUIÉN preguntárselos. La
// sección mandaba a `/acceso` («Entrar a mi cuenta»), y desde ahí la clienta sin invitación volvía
// a `/ayuda#planes`, cerrando el anillo. Ahora la acción principal del bloque es `ContactoParaContratar`
// —un canal de verdad, configurable por entorno— y «entrar» baja a salida secundaria, que es lo
// que de verdad es: el atajo de quien YA compró.
import Link from "next/link";
import { Button } from "@invitaciones/ui/componentes/Button/index.ts";
import { IconoPlan } from "@invitaciones/icons";
import { es_MX } from "@/lib/i18n";
import { ContactoParaContratar } from "./ContactoParaContratar.tsx";
import { Seccion } from "./Seccion.tsx";

export function Planes() {
  return (
    <Seccion id="planes" eyebrow={es_MX.sitio.planes} titulo={es_MX.sitio.planesSeccion.titulo}>
      <div className="mt-6 flex max-w-[62ch] flex-col gap-5 rounded-ui-card border border-ui-divider bg-ui-surface-raised p-6">
        <span className="grid h-12 w-12 place-items-center rounded-ui-control bg-ui-primary-soft text-ui-on-primary-soft">
          <IconoPlan size={26} tone="mono" />
        </span>
        <p className="text-lg text-ui-ink">{es_MX.sitio.planesSeccion.cuerpo}</p>
        <p className="text-sm text-ui-ink-muted">{es_MX.sitio.planesSeccion.nota}</p>

        <ContactoParaContratar conTitulo nivelTitulo="h3" className="border-t border-ui-divider pt-5" />

        <div>
          <Button asChild variant="secundario" size="md">
            <Link href="/acceso">{es_MX.sitio.planesSeccion.accion}</Link>
          </Button>
        </div>
      </div>
    </Seccion>
  );
}
