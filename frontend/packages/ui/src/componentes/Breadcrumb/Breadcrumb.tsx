// packages/ui/src/componentes/Breadcrumb/Breadcrumb.tsx — ruta de navegación (`11 §5` fila
// «Breadcrumb»): enlaces 13,5 con «/» en `ink-muted`; el último tramo es texto, no enlace, con
// `aria-current="page"`. Solo en escritorio (`11 §7`: "en móvil, el stepper del asistente o el
// botón «Atrás» con el nombre del paso anterior" — eso lo decide la pantalla, este componente solo
// se oculta a sí mismo por debajo del punto de corte).
import type { JSX } from "react";
import { twMerge } from "tailwind-merge";

export interface BreadcrumbItem {
  readonly label: string;
  /** Sin `href`, el tramo se pinta como texto (además del último, que nunca es enlace). */
  readonly href?: string;
}

export interface BreadcrumbProps {
  readonly items: readonly BreadcrumbItem[];
  readonly className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps): JSX.Element {
  return (
    <nav aria-label="Ruta" className={twMerge("hidden lg:block", className)}>
      {/* Una sola línea SIEMPRE. Sin esto, en un contenedor estrecho los tramos se parten por
          palabras y la ruta se vuelve ilegible (medido en la revisión del bloque 2, ficha de 301 px
          de la galería a 1440: «Mis invitaciones / Boda de Mariana y Rodrigo» se apilaba en tres
          renglones con las barras desalineadas). Los tramos intermedios se recortan con puntos
          suspensivos; el ÚLTIMO —la página actual, `aria-current`— nunca se recorta.
          `py-1`: sin él el enlace mide 20,3 px de alto y WCAG 2.2 AA 2.5.8 pide 24 (medido
          con `design-objetivos.spec.ts`; la excepción «en línea» no aplica: un tramo de ruta
          no va dentro de una frase). */}
      <ol className="flex items-center gap-2 text-[13.5px]">
        {items.map((item, indice) => {
          const esUltimo = indice === items.length - 1;
          return (
            <li
              key={`${item.label}-${String(indice)}`}
              className={twMerge("flex items-center gap-2", esUltimo ? "shrink-0" : "min-w-0")}
            >
              {esUltimo || item.href === undefined ? (
                <span
                  aria-current={esUltimo ? "page" : undefined}
                  className={esUltimo ? "whitespace-nowrap py-1 font-semibold text-ui-ink" : "block truncate py-1 text-ui-ink-muted"}
                >
                  {item.label}
                </span>
              ) : (
                <a
                  href={item.href}
                  className="block truncate rounded-[4px] py-1 text-ui-link hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface"
                >
                  {item.label}
                </a>
              )}
              {esUltimo ? null : (
                <span aria-hidden="true" className="shrink-0 text-ui-ink-muted">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
