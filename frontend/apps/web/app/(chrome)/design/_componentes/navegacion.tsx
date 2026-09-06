"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PAGINAS = [
  { href: "/design", etiqueta: "Índice", estado: "" },
  { href: "/design/tokens", etiqueta: "Tokens", estado: "" },
  { href: "/design/tipografia", etiqueta: "Tipografía", estado: "disponible" },
  { href: "/design/iconos", etiqueta: "Iconos", estado: "disponible" },
  { href: "/design/formas", etiqueta: "Formas", estado: "disponible" },
  { href: "/design/componentes", etiqueta: "Componentes", estado: "disponible" },
] as const;

/** Navegación de la galería. Marca la página actual con `aria-current`, no solo con color. */
export function NavegacionGaleria() {
  const ruta = usePathname();
  return (
    <nav aria-label="Secciones del sistema de diseño" className="md:sticky md:top-20">
      <ul className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
        {PAGINAS.map((p) => {
          const actual = ruta === p.href;
          return (
            /* `shrink-0`: en móvil la lista es un carrusel horizontal; sus elementos no se encogen. */
            <li key={p.href} className="shrink-0">
              <Link
                href={p.href}
                aria-current={actual ? "page" : undefined}
                className={
                  "flex items-baseline gap-2 whitespace-nowrap rounded-ui-control px-3 py-2 font-ui-text text-ui-text-sm transition-colors duration-[var(--ui-dur-1)] ease-ui-out " +
                  (actual
                    ? "bg-ui-primary-soft text-ui-on-primary-soft"
                    : "text-ui-ink hover:bg-ui-surface-alt")
                }
              >
                {p.etiqueta}
                {p.estado ? (
                  <span className="font-ui-label text-ui-label-sm uppercase text-ui-ink-muted">{p.estado}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
