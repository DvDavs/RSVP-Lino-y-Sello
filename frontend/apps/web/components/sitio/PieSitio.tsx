// components/sitio/PieSitio.tsx — pie compartido de la web pública. Cierra con la onda del sistema
// (`WaveDivider`, `11 §3.1`: divisor entre secciones) para que el final de la página sea una forma
// y no una línea gris; la onda es la ÚNICA forma de este bloque (`11 §3.4` regla 1).
import Link from "next/link";
import { WaveDivider } from "@invitaciones/ui/shapes";
import { es_MX } from "@/lib/i18n";

const CLASE_ENLACE = "rounded-ui-control py-2 text-sm font-semibold text-ui-link hover:underline";

export function PieSitio({ anio = 2026 }: { readonly anio?: number }) {
  return (
    <footer className="bg-ui-surface-alt">
      {/* `doble`: el papel y el rosa del pie están a dos pasos de luminosidad, y con UNA capa la
          onda casi no se ve. La segunda capa va en un apoyo `-soft` (el mecanismo que la propia API
          contempla para dar profundidad sin sombra), no en un tercer color inventado. */}
      <WaveDivider
        from="surface"
        to="surface-alt"
        profile="doble"
        tones={["support-2-soft"]}
        height={72}
        className="block w-full"
      />
      <div className="mx-auto flex w-full max-w-ui-page flex-col gap-6 px-5 pb-10 sm:px-8 md:flex-row md:items-end md:justify-between">
        <div>
          {/* Misma marca tipográfica temporal que `CabeceraSitio` (D-02): `display-sm`, no
              `heading-sm` — el nombre es identidad, no el título de este bloque. */}
          <p className="display-sm text-ui-ink">{es_MX.comun.marca}</p>
          <p className="text-sm mt-1 max-w-[42ch] text-ui-ink-muted">{es_MX.sitio.pie.lema}</p>
        </div>
        <nav aria-label={es_MX.sitio.navegacionPie} className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <Link href="/#como-funciona" className={CLASE_ENLACE}>
            {es_MX.sitio.comoFunciona}
          </Link>
          <Link href="/ayuda" className={CLASE_ENLACE}>
            {es_MX.comun.ayuda}
          </Link>
          {/* E3 las añade aquí (README de `/legal`): hasta ahora el pie no apuntaba a propósito a
              ninguna de las dos, porque no había nada real detrás. Ya lo hay. */}
          <Link href="/contacto" className={CLASE_ENLACE}>
            {es_MX.comun.contacto}
          </Link>
          <Link href="/legal" className={CLASE_ENLACE}>
            {es_MX.legal.indice.titulo}
          </Link>
          <Link href="/acceso" className={CLASE_ENLACE}>
            {es_MX.comun.entrar}
          </Link>
        </nav>
      </div>
      <p className="label-sm mx-auto w-full max-w-ui-page px-5 pb-8 text-ui-ink-muted sm:px-8">
        {es_MX.sitio.pie.derechos(anio)}
      </p>
    </footer>
  );
}
