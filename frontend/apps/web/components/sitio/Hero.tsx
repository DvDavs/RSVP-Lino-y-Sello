// components/sitio/Hero.tsx — el primer bloque de `/`: entender en cinco segundos y empezar
// (`11 §7`, fila «Web pública»). Forma protagonista: RAYOS detrás de la foto con máscara de sello
// —la composición exacta que fija el mapa de pantallas— y ninguna otra en el bloque (`11 §3.4` R1).
//
// La foto todavía no existe (`11 §9`, `imagenes-pendientes.md` → `landing-hero`): se pinta el
// placeholder del sistema, que ya es un degradado de dos tonos `-soft` con el icono de galería, no
// un hueco gris. El texto NUNCA se apoya sobre la imagen (`11 §3.4` R5): vive en su propia columna.
import Link from "next/link";
import { Button } from "@invitaciones/ui/componentes/Button/index.ts";
import { Composition, Image, Pill, Rays } from "@invitaciones/ui/shapes";
import { es_MX } from "@/lib/i18n";

export function Hero() {
  return (
    <section aria-labelledby="hero-titulo" className="bg-ui-surface">
      <div className="mx-auto grid w-full max-w-ui-page items-center gap-10 px-5 py-12 sm:px-8 lg:grid-cols-2 lg:gap-14 lg:py-20">
        <div className="order-2 lg:order-1">
          <Pill tone="support-1" dot>
            {es_MX.sitio.hero.eyebrow}
          </Pill>
          <h1 id="hero-titulo" className="display-2xl mt-5 text-balance text-ui-ink">
            {es_MX.sitio.hero.titulo}
          </h1>
          <p className="text-lg mt-5 max-w-[52ch] text-ui-ink-muted">{es_MX.sitio.hero.cuerpo}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Un solo botón primario en toda la vista (`11 §5`): el segundo es secundario y el
                cierre de la página usa la variante de acento. */}
            <Button asChild size="lg">
              <Link href="/editor">{es_MX.sitio.hero.empezar}</Link>
            </Button>
            <Button asChild variant="secundario" size="lg">
              <Link href="#como-funciona">{es_MX.sitio.hero.verComoFunciona}</Link>
            </Button>
          </div>
        </div>

        <Composition
          className="order-1 mx-auto w-full max-w-[420px] lg:order-2 lg:max-w-none"
          shape={<Rays tone="primary-soft" density={12} radius={150} breathe />}
          place="centro"
          size="118%"
        >
          <Image
            mask="seal"
            points={14}
            amplitude={3.5}
            ratio="1 / 1"
            imageId="landing-hero"
            alt={es_MX.sitio.hero.fotoPendiente}
            className="mx-auto w-[86%]"
          />
        </Composition>
      </div>
    </section>
  );
}
