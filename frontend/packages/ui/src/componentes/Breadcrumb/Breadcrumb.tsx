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
      <ol className="flex items-center gap-2 text-[13.5px]">
        {items.map((item, indice) => {
          const esUltimo = indice === items.length - 1;
          return (
            <li key={`${item.label}-${String(indice)}`} className="flex items-center gap-2">
              {esUltimo || item.href === undefined ? (
                <span aria-current={esUltimo ? "page" : undefined} className={esUltimo ? "font-semibold text-ui-ink" : "text-ui-ink-muted"}>
                  {item.label}
                </span>
              ) : (
                <a
                  href={item.href}
                  className="rounded-[4px] text-ui-link hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface"
                >
                  {item.label}
                </a>
              )}
              {esUltimo ? null : (
                <span aria-hidden="true" className="text-ui-ink-muted">
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
