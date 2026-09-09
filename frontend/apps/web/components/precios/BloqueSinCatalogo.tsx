// components/precios/BloqueSinCatalogo.tsx — el estado «vacío/error» de `/precios` (wireframe
// `12-producto-completo.md` §4): sin catálogo del backend NO se pinta una tabla vacía, solo el
// bloque de contacto con «Escríbenos y te pasamos los precios»; en error se suma un «Reintentar»
// discreto. El contacto nunca falla: es contenido estático, no depende de la petición que sí falló.
"use client";

import { Button } from "@invitaciones/ui/componentes/Button/index.ts";
import { ContactoParaContratar } from "@/components/sitio/ContactoParaContratar";
import { es_MX } from "@/lib/i18n";

export interface PropsBloqueSinCatalogo {
  /** Solo en el estado de error (la petición lanzó): el catálogo vino vacío no lleva reintento. */
  readonly onReintentar?: () => void;
}

export function BloqueSinCatalogo({ onReintentar }: PropsBloqueSinCatalogo) {
  return (
    <div
      data-testid="precios-vacio"
      className="rounded-ui-card border border-ui-divider bg-ui-surface-raised p-6 sm:p-8"
    >
      <h2 className="heading-lg text-ui-ink">{es_MX.sitio.precios.vacio.titulo}</h2>
      <p className="text-md mt-2 max-w-[56ch] text-ui-ink-muted">{es_MX.sitio.precios.vacio.texto}</p>

      {onReintentar ? (
        <Button
          type="button"
          variant="terciario"
          size="sm"
          onClick={onReintentar}
          data-testid="precios-reintentar"
          className="mt-4"
        >
          {es_MX.comun.reintentar}
        </Button>
      ) : null}

      <ContactoParaContratar conTitulo nivelTitulo="h3" className="mt-6 border-t border-ui-divider pt-6" />
    </div>
  );
}
