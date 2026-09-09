// app/(chrome)/(sitio)/contacto/page.tsx — `/contacto` (`12-producto-completo.md §B3.8`). Sustituye
// ENTERO al marcador de `5-0d` (ver `README.md` de esta carpeta): esta sí llama a las fuentes reales
// (`lib/contacto.ts`, `lib/env.ts`), sin ningún número ni correo escrito en el código.
//
// Forma protagonista única del bloque (`11 §3.4` regla 1): la onda entre el encabezado y las
// tarjetas, tal y como pide el wireframe. Las tarjetas viven en `TarjetasContacto` porque llevan su
// propio estado vacío honesto (G-01) y se prueban solas.
import type { Metadata } from "next";
import { Pill, WaveDivider } from "@invitaciones/ui/shapes";
import { TarjetasContacto } from "@/components/sitio/TarjetasContacto";
import { correoDeSoporteDelEntorno } from "@/lib/env";
import { es_MX } from "@/lib/i18n";

export const metadata: Metadata = {
  title: es_MX.sitio.paginaContacto.titulo,
  description: es_MX.sitio.paginaContacto.subtitulo,
  // Marcador de `5-0d` quitado: esta es una página de venta real y SÍ se indexa (`12 §B3.8`).
  robots: { index: true, follow: true },
};

export default function PaginaContacto() {
  const correoSoporte = correoDeSoporteDelEntorno();

  return (
    <div className="mx-auto w-full max-w-ui-page px-5 pb-16 sm:px-8">
      <header className="pt-12">
        <Pill tone="support-2">{es_MX.sitio.paginaContacto.eyebrow}</Pill>
        <h1 className="display-xl mt-5 text-balance text-ui-ink">{es_MX.sitio.paginaContacto.titulo}</h1>
        <p className="text-lg mt-3 max-w-[52ch] text-ui-ink-muted">{es_MX.sitio.paginaContacto.subtitulo}</p>
      </header>

      <WaveDivider
        from="surface"
        to="surface-alt"
        profile="suave"
        height={64}
        className="-mx-5 mt-10 block w-full sm:-mx-8"
      />

      <div className="-mx-5 bg-ui-surface-alt px-5 pb-10 pt-2 sm:-mx-8 sm:px-8">
        <TarjetasContacto />
      </div>

      {/* G-01, otra bandeja: quien YA contrató y algo no le funciona no debería tener que mandar
          «hola, quiero contratar» al mismo número de ventas. `NEXT_PUBLIC_SOPORTE_CORREO`, no
          `NEXT_PUBLIC_CONTACTO_CORREO`. */}
      <section aria-labelledby="contacto-soporte" className="mt-12 rounded-ui-card bg-ui-surface-alt p-6">
        <h2 id="contacto-soporte" className="heading-md text-ui-ink">
          {es_MX.sitio.paginaContacto.soporte.titulo}
        </h2>
        {correoSoporte ? (
          <p className="text-md mt-2 max-w-[56ch] text-ui-ink-muted">
            {es_MX.sitio.paginaContacto.soporte.prefijo}{" "}
            <a href={`mailto:${correoSoporte}`} className="font-semibold text-ui-link hover:underline">
              {correoSoporte}
            </a>{" "}
            {es_MX.sitio.paginaContacto.soporte.sufijo}
          </p>
        ) : (
          <p className="text-md mt-2 max-w-[56ch] text-ui-ink-muted">
            {es_MX.sitio.paginaContacto.soporte.sinConfigurar}
          </p>
        )}
      </section>
    </div>
  );
}
