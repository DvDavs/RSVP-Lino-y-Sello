// app/(chrome)/editor/page.tsx — la puerta de entrada del cliente, rediseñada en la fase 3-C como
// ASISTENTE DE CREACIÓN de cuatro pasos (`diseno/11-sistema-de-diseno.md` §7).
//
// Qué había antes y por qué cambia. Esta pantalla era un catálogo plano: la lista de invitaciones y
// una rejilla con TODAS las plantillas publicadas, sin filtrar por tipo de evento. Esa falta de
// filtro es la fricción UX-N-02 medida en la fase 3-B (`bitacora/3b-adv.md` §8.1): una clienta de XV
// años vio «Boda clásica», la eligió, y acabó con las secciones «Los novios» y «Nuestros padres y
// padrinos» en la invitación de su hija. El backend YA sabía filtrar
// (`TemplateCatalogService.catalogo(eventKind, …)`); lo que faltaba era que `apps/web` mandara el
// parámetro. El asistente lo manda: el paso 1 fija el tipo de evento y el paso 2 pide
// `GET /editor/templates2/catalog?eventKind=…`.
//
// Lo que NO cambia: las llamadas y los contratos de `lib/api-client.ts` (catálogo, elegir plantilla,
// operaciones y `PUT …/event`, todas ya existentes) y el hecho de que una invitación nace de una
// compra, no de esta pantalla (ADR-2-4-02).
//
// El grueso del asistente vive en `components/asistente/**`. Aquí queda solo el armazón de la ruta:
// la cabecera del sitio y la frontera de Suspense que `useSearchParams()` exige en Next 16 (sin
// ella, `next build` falla en esta ruta: el hook obliga a renderizado dinámico).
import { Suspense } from "react";
import type { Metadata } from "next";
import { AsistenteDeCreacion } from "@/components/asistente/AsistenteDeCreacion";
import { EncabezadoSitio } from "@/components/editor/EncabezadoSitio";
import { es_MX } from "@/lib/i18n";

export const metadata: Metadata = { title: "Crear mi invitación" };

export default function PaginaAsistente() {
  return (
    <>
      <EncabezadoSitio volverA="/editor" />
      <Suspense
        fallback={
          <main className="mx-auto w-full max-w-ui-page px-6 py-10">
            <p role="status" className="text-md text-ui-ink-muted">
              {es_MX.asistente.cargando}
            </p>
          </main>
        }
      >
        <AsistenteDeCreacion />
      </Suspense>
    </>
  );
}
