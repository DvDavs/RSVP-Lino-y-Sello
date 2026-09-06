// components/sitio/TiposDeEvento.tsx — el catálogo de tipos de celebración de la portada (`11 §7`).
//
// Cada cuadro lleva a `/editor?tipo=…`, que es el paso 1 del asistente («¿Qué vamos a celebrar?»):
// el tipo viaja en la URL para que quien llega desde aquí no tenga que volver a elegirlo. El
// parámetro se ignora sin daño si el asistente todavía no lo lee (`preguntas-abiertas.md`).
//
// Color por categoría (`11 §4.1`): cuadro de fondo `-soft` y trazo del `on-*-soft` de la MISMA
// pareja verificada AA, con el icono en `tone="mono"` para que herede ese color exacto en vez del
// relleno de dos tonos fijo del sistema.
import Link from "next/link";
import {
  IconoBautizo,
  IconoBoda,
  IconoComunion,
  IconoCorporativo,
  IconoCumpleanos,
  IconoGraduacion,
  IconoXvAnos,
} from "@invitaciones/icons";
import { es_MX } from "@/lib/i18n";
import { Seccion } from "./Seccion.tsx";

interface TipoDeEvento {
  readonly slug: string;
  readonly nombre: string;
  readonly Icono: typeof IconoBoda;
  readonly clases: string;
}

export const TIPOS_DE_EVENTO: readonly TipoDeEvento[] = [
  { slug: "boda", nombre: es_MX.sitio.tipos.boda, Icono: IconoBoda, clases: "bg-ui-primary-soft text-ui-on-primary-soft" },
  { slug: "xv-anos", nombre: es_MX.sitio.tipos.xv, Icono: IconoXvAnos, clases: "bg-ui-accent-soft text-ui-on-accent-soft" },
  { slug: "bautizo", nombre: es_MX.sitio.tipos.bautizo, Icono: IconoBautizo, clases: "bg-ui-info-soft text-ui-on-info-soft" },
  { slug: "comunion", nombre: es_MX.sitio.tipos.comunion, Icono: IconoComunion, clases: "bg-ui-surface-alt text-ui-ink" },
  { slug: "cumpleanos", nombre: es_MX.sitio.tipos.cumpleanos, Icono: IconoCumpleanos, clases: "bg-ui-success-soft text-ui-on-success-soft" },
  { slug: "graduacion", nombre: es_MX.sitio.tipos.graduacion, Icono: IconoGraduacion, clases: "bg-ui-info-soft text-ui-on-info-soft" },
  { slug: "corporativo", nombre: es_MX.sitio.tipos.corporativo, Icono: IconoCorporativo, clases: "bg-ui-surface-alt text-ui-ink" },
];

export function TiposDeEvento() {
  return (
    // Sin `eyebrow`: el antetítulo sería la misma frase que el titular, y repetir un texto en dos
    // tamaños distintos no es jerarquía, es ruido (y el lector de pantalla lo lee dos veces).
    <Seccion id="tipos-de-evento" titulo={es_MX.sitio.tipos.titulo} intro={es_MX.sitio.tipos.intro}>
      <ul className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {TIPOS_DE_EVENTO.map(({ slug, nombre, Icono, clases }) => (
          <li key={slug}>
            <Link
              href={`/editor?tipo=${slug}`}
              // La rejilla NO se eleva al pasar por encima (`11 §6.2` R3): cambia el borde y el
              // color del título, nada más.
              className="group flex h-full min-h-[112px] flex-col items-start gap-3 rounded-ui-card border border-ui-divider bg-ui-surface-raised p-4 transition-colors hover:border-ui-primary"
              aria-label={es_MX.sitio.tipos.empezarCon(nombre)}
            >
              <span className={`grid h-12 w-12 place-items-center rounded-ui-control ${clases}`}>
                <Icono size={26} tone="mono" />
              </span>
              <span className="heading-sm text-ui-ink group-hover:text-ui-link">{nombre}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Seccion>
  );
}
