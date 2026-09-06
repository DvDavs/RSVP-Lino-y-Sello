// app/(chrome)/(sitio)/page.tsx — la PORTADA (`/`).
//
// Antes de esta fase, `/` era un 404 en inglés: la raíz del producto no existía (`11 §7`, «las
// fricciones medidas que esto corrige»). Ahora es la pantalla que tiene que explicar el producto en
// cinco segundos y dejar empezar, y es además la más exigente en rendimiento de todo el chrome:
// pública, primera impresión, LCP < 2,5 s en móvil y < 150 KB gz de JS de primera carga
// (`contratos.md §8`).
//
// Por eso TODO lo que se ve aquí es Componente de Servidor salvo los botones (`Button` del sistema
// es cliente porque calcula su anillo de foco): no hay carrusel, ni menú desplegable, ni fotografía
// —las imágenes reales todavía no existen (`docs/rediseno-plantillas/imagenes-pendientes.md`) y el
// placeholder del sistema es SVG—, y las cinco formas de la página son SVG en línea sin red.
import type { Metadata } from "next";
import { CtaFinal } from "@/components/sitio/CtaFinal";
import { Hero } from "@/components/sitio/Hero";
import { PasosComoFunciona } from "@/components/sitio/PasosComoFunciona";
import { Planes } from "@/components/sitio/Planes";
import { Testimonios } from "@/components/sitio/Testimonios";
import { TiposDeEvento } from "@/components/sitio/TiposDeEvento";
import { es_MX } from "@/lib/i18n";

export const metadata: Metadata = {
  // La portada SÍ se indexa (a diferencia de `/i`, `/preview` y `/design`).
  title: { absolute: `${es_MX.comun.marca} · ${es_MX.sitio.hero.eyebrow}` },
  description: es_MX.sitio.hero.cuerpo,
  robots: { index: true, follow: true },
};

export default function Portada() {
  return (
    <>
      <Hero />
      <PasosComoFunciona />
      <TiposDeEvento />
      <Testimonios />
      <Planes />
      <CtaFinal />
    </>
  );
}
