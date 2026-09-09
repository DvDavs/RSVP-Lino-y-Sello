// components/sitio/TarjetasContacto.tsx — las dos tarjetas de `/contacto` (`12-producto-completo.md
// §B3.8`): una por canal de venta, WhatsApp y correo. Es la versión en tarjeta del MISMO criterio
// honesto de `ContactoParaContratar` (G-01, `bitacora/3c-ux.md §4`): con un canal configurado hay
// tarjeta y botón; sin ninguno, la frase honesta ya existente y ni una tarjeta vacía. No se repite
// la lógica de lectura del entorno: el número y el correo siguen siendo de `lib/contacto.ts`.
//
// COMPONENTE DE SERVIDOR: como `ContactoParaContratar`, sin estado ni efectos — dos tarjetas, dos
// enlaces. El único módulo de cliente es `Button` con `asChild`, ya cargado por el resto del sitio.
import { Button } from "@invitaciones/ui/componentes/Button/index.ts";
import { IconoChat, IconoCorreo } from "@invitaciones/icons";
import { contactoDelEntorno, type ContactoDeVenta } from "@/lib/contacto";
import { es_MX } from "@/lib/i18n";

export interface PropsTarjetasContacto {
  /** Inyectable para poder probar los dos estados sin tocar `process.env`. */
  readonly contacto?: ContactoDeVenta;
}

export function TarjetasContacto({ contacto }: PropsTarjetasContacto) {
  const datos = contacto ?? contactoDelEntorno();

  if (!datos.configurado) {
    return (
      <p className="text-md mt-8 max-w-[56ch] text-ui-ink-muted">{es_MX.sitio.contactar.sinContacto}</p>
    );
  }

  return (
    <div className="mt-10 grid gap-6 sm:grid-cols-2">
      {datos.whatsapp ? (
        <article className="rounded-ui-card border border-ui-divider bg-ui-surface p-6">
          <div className="flex items-center gap-3">
            <IconoChat size={24} tone="mono" />
            <h2 className="heading-md text-ui-ink">{es_MX.sitio.paginaContacto.tarjetaWhatsapp.titulo}</h2>
          </div>
          <p className="text-sm mt-3 text-ui-ink-muted">{datos.whatsapp.etiqueta}</p>
          <p className="text-md mt-1 text-ui-ink-muted">{es_MX.sitio.paginaContacto.tarjetaWhatsapp.texto}</p>
          <Button asChild variant="primario" size="md" className="mt-5">
            <a href={datos.whatsapp.enlace} target="_blank" rel="noopener noreferrer">
              {es_MX.sitio.contactar.whatsapp}
            </a>
          </Button>
        </article>
      ) : null}
      {datos.correo ? (
        <article className="rounded-ui-card border border-ui-divider bg-ui-surface p-6">
          <div className="flex items-center gap-3">
            <IconoCorreo size={24} tone="mono" />
            <h2 className="heading-md text-ui-ink">{es_MX.sitio.paginaContacto.tarjetaCorreo.titulo}</h2>
          </div>
          <p className="text-sm mt-3 text-ui-ink-muted">{datos.correo.etiqueta}</p>
          <p className="text-md mt-1 text-ui-ink-muted">{es_MX.sitio.paginaContacto.tarjetaCorreo.texto}</p>
          <Button asChild variant="secundario" size="md" className="mt-5">
            <a href={datos.correo.enlace}>{es_MX.sitio.contactar.correo}</a>
          </Button>
        </article>
      ) : null}
    </div>
  );
}
