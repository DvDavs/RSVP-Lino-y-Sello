// components/precios/PantallaPrecios.tsx — `/precios` entera: el catálogo real de planes
// (wireframe `12-producto-completo.md` §4), sustituyendo el marcador de la sesión E4.
//
// Client component completo (`ui-pantalla` §5): el catálogo se pide al backend DESDE EL NAVEGADOR
// (`GET /public/plans`, sin auth) y la URL puede traer `?inv=<id>` de la puerta de publicación
// (ADR-5-0B-01), que solo se lee con `useSearchParams`. `page.tsx` se queda con los metadatos y el
// límite de Suspense que ese hook exige (mismo patrón que `/acceso`).
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Composition, Pill, Rays } from "@invitaciones/ui/shapes";
import { ContactoParaContratar } from "@/components/sitio/ContactoParaContratar";
import { pagoEnLineaDisponible } from "@/lib/env";
import { es_MX } from "@/lib/i18n";
import { obtenerCatalogo } from "@/lib/pagos/cliente";
import type { CatalogoDePlanes } from "@/lib/pagos/tipos";
import { BloqueSinCatalogo } from "./BloqueSinCatalogo.tsx";
import { CargaDePlanes } from "./CargaDePlanes.tsx";
import { TarjetaPlan } from "./TarjetaPlan.tsx";

type EstadoCatalogo =
  | { readonly tipo: "cargando" }
  | { readonly tipo: "error" }
  | { readonly tipo: "listo"; readonly catalogo: CatalogoDePlanes };

const PREGUNTAS = [es_MX.sitio.precios.preguntas.uno, es_MX.sitio.precios.preguntas.dos, es_MX.sitio.precios.preguntas.tres];

export function PantallaPrecios() {
  const parametros = useSearchParams();
  const invitationId = parametros.get("inv");
  const [estado, setEstado] = useState<EstadoCatalogo>({ tipo: "cargando" });

  const cargar = useCallback(() => {
    setEstado({ tipo: "cargando" });
    obtenerCatalogo()
      .then((catalogo) => setEstado({ tipo: "listo", catalogo }))
      .catch(() => setEstado({ tipo: "error" }));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // El pago solo se ofrece cuando LAS DOS partes están listas: el backend tiene clave secreta de
  // Stripe (`catalogo.pagoEnLinea`) y el frontend tiene la publicable (`NEXT_PUBLIC_STRIPE_...`).
  // Cualquiera de las dos en falso y ningún botón promete un pago que no se puede abrir (G-01).
  const entornoConfigurado = pagoEnLineaDisponible();

  return (
    <div className="mx-auto w-full max-w-ui-page px-5 pb-16 sm:px-8">
      <header className="pt-12">
        <Composition
          className="-mx-5 px-5 py-4 sm:-mx-8 sm:px-8"
          shape={<Rays tone="primary-soft" density={12} radius={120} origin="85% 20%" />}
          place="arriba-derecha"
          size="240px"
        >
          <Pill tone="support-1">{es_MX.sitio.precios.eyebrow}</Pill>
          <h1 className="display-xl mt-4 max-w-[24ch] text-balance text-ui-ink">{es_MX.sitio.precios.titulo}</h1>
        </Composition>
        <p className="text-lg mt-3 max-w-[58ch] text-ui-ink-muted">{es_MX.sitio.precios.intro}</p>
      </header>

      <div className="mt-10">
        {estado.tipo === "cargando" ? <CargaDePlanes /> : null}

        {estado.tipo === "error" ? <BloqueSinCatalogo onReintentar={cargar} /> : null}

        {estado.tipo === "listo" && estado.catalogo.planes.length === 0 ? <BloqueSinCatalogo /> : null}

        {estado.tipo === "listo" && estado.catalogo.planes.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-3" data-testid="precios-catalogo">
            {[...estado.catalogo.planes]
              .sort((a, b) => (a.recomendado === b.recomendado ? a.orden - b.orden : a.recomendado ? -1 : 1))
              .map((plan) => (
                <TarjetaPlan
                  key={plan.codigo}
                  plan={plan}
                  invitationId={invitationId}
                  pagoDisponible={estado.catalogo.pagoEnLinea && entornoConfigurado}
                />
              ))}
          </div>
        ) : null}
      </div>

      <section aria-labelledby="precios-preguntas-titulo" className="mt-16">
        <h2 id="precios-preguntas-titulo" className="heading-lg text-ui-ink">
          {es_MX.sitio.precios.preguntas.titulo}
        </h2>
        <dl className="mt-6 grid gap-8 sm:grid-cols-3">
          {PREGUNTAS.map((pregunta) => (
            <div key={pregunta.pregunta}>
              <dt className="heading-sm text-ui-ink">{pregunta.pregunta}</dt>
              <dd className="text-md mt-2 text-ui-ink-muted">{pregunta.respuesta}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="precios-contacto-titulo" id="contacto" className="mt-16 rounded-ui-card bg-ui-surface-alt p-6 sm:p-8">
        <h2 id="precios-contacto-titulo" className="heading-lg text-ui-ink">
          {es_MX.sitio.precios.contacto.titulo}
        </h2>
        <ContactoParaContratar className="mt-4" />
      </section>
    </div>
  );
}
