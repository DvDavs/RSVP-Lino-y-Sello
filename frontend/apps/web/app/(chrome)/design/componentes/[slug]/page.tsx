import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { metadatos } from "@invitaciones/ui";
import { VistaComponente } from "./vista-componente.tsx";

// app/(chrome)/design/componentes/[slug]/page.tsx — una historia completa (`11 §5`, `11 §8.1`):
// todas sus variantes y, si las declara, todos sus estados. El `data-theme` claro/oscuro lo da el
// `MarcoDeTema` de `design/layout.tsx` (conmutador ya existente, ambiental — ningún componente de
// aquí sabe en qué tema está); el ancho móvil/escritorio lo da la propia rejilla responsiva más las
// capturas de Playwright a 390 y 1440 (`e2e/design.spec.ts`), no una vista previa de ancho fijo.
//
// Server Component MÍNIMO a propósito, y lee `metadatos` (raíz del paquete), NUNCA `registro`: ver
// el comentario de `componentes/page.tsx` y de `historias/registro.ts` (contrato de integración
// F1+F2) para el porqué — una historia de otro bloque puede ser `"use client"`, y evaluarla aquí
// rompería `next build`. El cuerpo real, que SÍ necesita el registro completo (con los `render()`
// de verdad), vive en `vista-componente.tsx`, un componente de cliente.
export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return metadatos.map((metadato) => ({ slug: metadato.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const metadato = metadatos.find((m) => m.slug === slug);
  return { title: metadato ? metadato.nombre : "Componente" };
}

export default async function PaginaComponente({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!metadatos.some((metadato) => metadato.slug === slug)) notFound();
  return <VistaComponente slug={slug} />;
}
