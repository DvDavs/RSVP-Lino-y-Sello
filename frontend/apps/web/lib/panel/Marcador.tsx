// lib/panel/Marcador.tsx — la pantalla EN CONSTRUCCIÓN de las rutas que la fase 5 deja reservadas.
//
// QUÉ ES Y QUÉ NO ES. Es un marcador HONESTO: dice qué va a haber aquí y que todavía no está. No
// inventa datos, no pinta un botón que no hace nada y no insinúa que exista información detrás. La
// sesión dueña de cada ruta sustituye su `page.tsx` ENTERO y este componente desaparece con la
// última que quede (5-0d).
//
// POR QUÉ VIVE EN `lib/panel/` Y NO EN `components/`. Territorio: la fase 5 reparte `components/**`
// entre las cuatro sesiones, y este andamio no puede aterrizar en un directorio que otra sesión esté
// editando. `lib/panel/**` es del andamio y de nadie más.
//
// Server Component a propósito (sin `"use client"`): no hay estado ni efectos, y `Badge` es
// server-safe. Se importa por SUBRUTA directa y no por el barril `@invitaciones/ui`, que reexporta
// 25 componentes —la mitad con Radix dentro— y metería todo ese lado cliente en el JS de rutas que
// solo enseñan un título y un párrafo (medido en 3C-5: 92,3 → 8,9 KB gz en la portada).
import Link from "next/link";
import type { JSX } from "react";
import { Badge } from "@invitaciones/ui/componentes/Badge/index.ts";
import { es_MX } from "../i18n.ts";

export interface AccionDelMarcador {
  /** Ruta REAL que ya sirve el producto hoy. Nunca una que todavía no exista. */
  readonly href: string;
  readonly etiqueta: string;
}

export interface PropsMarcador {
  readonly titulo: string;
  readonly texto: string;
  /**
   * Salida de la pantalla. Solo donde el marcador quedaría en un callejón sin salida — es decir,
   * fuera del grupo `(sitio)`, que ya trae cabecera y pie con enlaces (`11 §7`, «ningún callejón
   * sin salida»).
   */
  readonly accion?: AccionDelMarcador;
  /**
   * `main` por defecto. Las rutas del grupo `(sitio)` pasan `div`: su layout (`MarcoSitio`) ya
   * envuelve el contenido en `<main id="contenido">`, y dos landmarks principales en el mismo
   * documento son una violación de axe (`landmark-no-duplicate-main`) — el mismo defecto que
   * `app/(chrome)/design/iconos/page.tsx` documenta y corrige.
   */
  readonly contenedor?: "main" | "div";
}

export function Marcador({ titulo, texto, accion, contenedor = "main" }: PropsMarcador): JSX.Element {
  const Envoltura = contenedor;
  return (
    <Envoltura className="mx-auto w-full max-w-ui-page px-5 py-16 sm:px-8">
      <Badge tone="neutro">{es_MX.panel.marcador.enConstruccion}</Badge>
      <h1 className="display-sm mt-4 text-ui-ink">{titulo}</h1>
      <p className="text-lg mt-3 max-w-[56ch] text-ui-ink-muted">{texto}</p>
      {accion ? (
        <p className="mt-8">
          {/* `inline-flex items-center py-1`: un enlace solo en su párrafo no tiene la excepción
              «inline» de WCAG 2.2 AA 2.5.8 y necesita 24 px de alto (mismo arreglo que `/ayuda`). */}
          <Link
            href={accion.href}
            className="inline-flex items-center rounded-ui-control py-1 text-sm font-semibold text-ui-link hover:underline"
          >
            {accion.etiqueta}
          </Link>
        </p>
      ) : null}
    </Envoltura>
  );
}
