// components/sitio/ContactoParaContratar.tsx — la salida del circuito cerrado (G-01).
//
// El recorrido de uso sin instrucciones (`bitacora/3c-ux.md §1.3`) terminó en cuatro toques dentro
// de un anillo: portada → `/acceso` → «Todavía no tienes invitaciones… contrata un plan» →
// `/ayuda#planes` → «escríbenos por el mismo medio por el que contrataste», que es el medio que
// quien no ha contratado no tiene. Este bloque es el único sitio del sitio público donde se puede
// EMPEZAR una conversación, y sale en los dos extremos del anillo: la sección «Planes» de la
// portada y la caja de contacto de `/ayuda` (a la que apunta el botón «Ver planes» del asistente).
//
// COMPONENTE DE SERVIDOR, a propósito y con una cifra detrás: `/` tiene presupuesto de 150 KB gz de
// JS de primera carga (`contratos.md §8`) y estaba en 148,1 KB. Aquí no hay estado, ni
// `useEffect`, ni un manejador de eventos: dos enlaces y un texto. El único módulo de cliente que
// toca es `Button` con `asChild`, que la misma sección ya cargaba antes de este cambio, así que el
// bloque no añade ni un módulo nuevo al bundle de la ruta.
//
// El número y el correo NO están en el código: `lib/contacto.ts` los lee del entorno. Sin ellos el
// bloque dice la verdad en vez de fingir un botón (ver `es_MX.sitio.contactar.sinContacto`).
import { Button } from "@invitaciones/ui/componentes/Button/index.ts";
import { IconoChat, IconoCorreo } from "@invitaciones/icons";
import { contactoDelEntorno, type ContactoDeVenta } from "@/lib/contacto";
import { es_MX } from "@/lib/i18n";

export interface PropsContactoParaContratar {
  /** Inyectable para poder probar los dos estados sin tocar `process.env`. */
  readonly contacto?: ContactoDeVenta;
  /** Se omite cuando el bloque vive dentro de una sección que ya tiene su propio encabezado. */
  readonly conTitulo?: boolean;
  /** Nivel del encabezado, para no saltarse ninguno en la página donde se inserta. */
  readonly nivelTitulo?: "h2" | "h3";
  readonly className?: string;
}

export function ContactoParaContratar({
  contacto,
  conTitulo = false,
  nivelTitulo = "h3",
  className,
}: PropsContactoParaContratar) {
  const datos = contacto ?? contactoDelEntorno();
  const Titulo = nivelTitulo;

  return (
    <div className={className}>
      {conTitulo ? (
        <Titulo className="heading-sm text-ui-ink">{es_MX.sitio.contactar.titulo}</Titulo>
      ) : null}

      {datos.configurado ? (
        <>
          <p className="text-md mt-2 max-w-[56ch] text-ui-ink">{es_MX.sitio.contactar.intro}</p>
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
            {datos.whatsapp ? (
              <Button asChild variant="primario" size="md">
                <a href={datos.whatsapp.enlace} target="_blank" rel="noopener noreferrer">
                  <IconoChat size={20} tone="mono" />
                  {es_MX.sitio.contactar.whatsapp}
                </a>
              </Button>
            ) : null}
            {datos.correo ? (
              <a
                href={datos.correo.enlace}
                className="inline-flex items-center gap-2 rounded-ui-control py-2 text-sm font-semibold text-ui-link hover:underline"
              >
                <IconoCorreo size={20} tone="mono" />
                {es_MX.sitio.contactar.correo}
              </a>
            ) : null}
          </div>
          {/* El dato en claro, además del enlace: se puede copiar, teclear o marcar desde otro
              aparato, y quien no use WhatsApp ve a dónde le llevaría el botón antes de tocarlo. Va
              como lista y no como una cadena unida por «·»: a 390 px el separador se quedaba
              colgando al final del renglón. */}
          <ul className="text-sm mt-4 flex flex-wrap gap-x-4 gap-y-1 text-ui-ink-muted">
            {[datos.whatsapp?.etiqueta, datos.correo?.etiqueta].filter(Boolean).map((dato) => (
              <li key={dato}>{dato}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-md mt-2 max-w-[56ch] text-ui-ink-muted">{es_MX.sitio.contactar.sinContacto}</p>
      )}
    </div>
  );
}
