"use client";

// app/(chrome)/editor/page.tsx — catálogo de plantillas (04 §6.1). ESQUELETO: pinta estados reales
// de carga/error/vacío contra `GET /editor/templates2/catalog` (ruta 1). El bloque 3-4 sustituye
// esta página por el flujo completo (filtros por `eventKind`, comparación real contra el plan del
// cliente autenticado, etc.); el punto de extensión es el propio componente `CatalogoPlantillas`.
//
// Dirección visual — MEDIDA, `docs/rediseno-plantillas/diseno/arte-chrome.md` §5 ("Tarjeta del
// listado") y §7 ("Navegación"), adaptada (instrucción del revisor, corrección 2): la referencia
// mide una ficha de proveedor con foto de PERSONA en 1:1; aquí la tarjeta muestra la vista previa de
// una INVITACIÓN (vertical), así que se conserva el SISTEMA (radio 20px, sombra tintada de púrpura,
// CERO borde, onda decorativa en el borde inferior de la imagen, CTA en píldora a ancho completo,
// line-clamp del título) y se adapta la geometría de la media a proporción vertical. Cabecera
// `position: static`, 96px — vale para esta página de catálogo (marketing-listado); NO para el
// editor de dos paneles, que necesita una barra persistente (corrección 4, ver
// `app/(chrome)/editor/[invitationId]/page.tsx`).
import { PartyPopper, Sparkles } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError, SessionError, getCatalog } from "@/lib/api-client";
import type { CatalogItem, CatalogResponse } from "@/lib/api-types";
import { es_MX } from "@/lib/i18n";

type Estado =
  | { tipo: "cargando" }
  | { tipo: "listo"; datos: CatalogResponse }
  | { tipo: "sesion" }
  | { tipo: "error"; mensaje: string; codigo?: string };

const ETIQUETA_EVENTO: Record<string, string> = {
  wedding: "Boda",
  quince: "XV años",
  baptism: "Bautizo",
  communion: "Primera comunión",
  confirmation: "Confirmación",
  birthday: "Cumpleaños",
  graduation: "Graduación",
  generic: "Evento",
};

/**
 * Onda decorativa del borde inferior de la imagen (arte-chrome.md §5.1: "se pinta como <image>
 * dentro de un <svg> con clipPath: el borde inferior es una onda decorativa, no una recta"). Curva
 * propia (el documento describe el efecto, no publica las coordenadas exactas del trazo original) en
 * espacio `objectBoundingBox` para que escale con cualquier tamaño de tarjeta.
 */
function OndaClipPath({ id }: { id: string }) {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
      <defs>
        <clipPath id={id} clipPathUnits="objectBoundingBox">
          <path d="M0,0 H1 V0.90 C0.83,0.99 0.63,1.0 0.47,0.93 C0.31,0.86 0.14,0.87 0,0.95 Z" />
        </clipPath>
      </defs>
    </svg>
  );
}

function TarjetaPlantilla({ item }: { item: CatalogItem }) {
  const clipId = `onda-${item.slug}`;
  return (
    // Sin `hover:scale`/`transform` en la tarjeta (corrección 3, arte-chrome.md §5: "transition:
    // all 0s ease… es decisión, no olvido: la rejilla no salta"). Solo el título transiciona con el
    // hover del `article` (`group`); el CTA ya transiciona por su propio hover (Button).
    <li className="group flex h-full flex-col overflow-hidden rounded-ui-card bg-ui-surface shadow-ui-1">
      <OndaClipPath id={clipId} />
      <div className="relative aspect-[3/4] w-full bg-ui-bg-alt" style={{ clipPath: `url(#${clipId})` }}>
        <Image
          src={item.previewUrl}
          alt=""
          fill
          sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
      </div>
      <div className="flex flex-1 flex-col gap-4 p-6">
        <h3 className="text-ui-card font-bold leading-[var(--text-ui-card--line-height)] text-ui-ink-heading transition-colors duration-[var(--ui-duration)] ease-[var(--ui-ease)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden group-hover:text-ui-accent-hover">
          {item.name["es-MX"]}
        </h3>
        <ul className="flex flex-col gap-2">
          {/* Metadatos SIEMPRE en este orden: tipo de evento → plan mínimo requerido (corrección 2:
              mapeo de "ciudad → categoría → precio" de la referencia; aquí no hay precio, no se
              inventa uno). */}
          <li className="flex min-w-0 items-center gap-2 text-ui-aux text-ui-ink">
            <PartyPopper className="size-4 shrink-0 text-ui-accent-hover" aria-hidden="true" />
            <span className="truncate">{item.eventKinds.map((k) => ETIQUETA_EVENTO[k] ?? k).join(", ")}</span>
          </li>
          <li className="flex min-w-0 items-center gap-2 text-ui-aux text-ui-ink">
            <Sparkles className="size-4 shrink-0 text-ui-accent-hover" aria-hidden="true" />
            <span className="truncate">
              {item.minPlanTier > 1 ? `Requiere el plan ${item.minPlanTier} o superior` : "Incluida en todos los planes"}
            </span>
          </li>
        </ul>
        <Button className="mt-auto w-full">Elegir esta plantilla</Button>
      </div>
    </li>
  );
}

function CatalogoPlantillas() {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });

  useEffect(() => {
    let cancelado = false;
    setEstado({ tipo: "cargando" });
    getCatalog()
      .then((datos) => {
        if (!cancelado) setEstado({ tipo: "listo", datos });
      })
      .catch((err: unknown) => {
        if (cancelado) return;
        if (err instanceof SessionError) {
          setEstado({ tipo: "sesion" });
        } else if (err instanceof ApiError) {
          setEstado({ tipo: "error", mensaje: err.message, codigo: err.code });
        } else {
          setEstado({ tipo: "error", mensaje: err instanceof Error ? err.message : String(err) });
        }
      });
    return () => {
      cancelado = true;
    };
  }, []);

  if (estado.tipo === "cargando") {
    return (
      <p role="status" aria-live="polite" className="text-ui-ink-muted">
        {es_MX.comun.cargando}
      </p>
    );
  }

  if (estado.tipo === "sesion") {
    return (
      <div role="alert" className="rounded-ui-control border border-ui-border bg-ui-surface p-4 text-ui-ink">
        <p>{es_MX.errores.sesionInvalida}</p>
      </div>
    );
  }

  if (estado.tipo === "error") {
    return (
      <div role="alert" className="rounded-ui-control border border-ui-border bg-ui-surface p-4 text-ui-ink">
        <p>{estado.mensaje}</p>
        {estado.codigo ? <p className="text-ui-ink-muted">{es_MX.errores.codigo(estado.codigo)}</p> : null}
      </div>
    );
  }

  const { items } = estado.datos;
  if (items.length === 0) {
    return <p className="text-ui-ink-muted">{es_MX.editor.catalogo.vacio}</p>;
  }

  return (
    <ul className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <TarjetaPlantilla key={`${item.slug}@${item.version}`} item={item} />
      ))}
    </ul>
  );
}

/** Cabecera `position: static`, 96px (arte-chrome.md §7). Válida para esta página de catálogo. */
function Cabecera() {
  return (
    <header className="static flex h-24 items-center justify-between bg-ui-bg px-6">
      <span className="font-ui-display text-ui-title font-semibold text-ui-ink-heading">Invitaciones</span>
      <nav className="flex items-center gap-3 text-ui-aux text-ui-ink">
        <a href="#" className="rounded-ui-control px-2 py-1">
          {es_MX.comun.ayuda}
        </a>
        <a href="#" className="rounded-ui-control px-2 py-1">
          {es_MX.comun.miCuenta}
        </a>
      </nav>
    </header>
  );
}

export default function PaginaCatalogo() {
  return (
    <>
      <Cabecera />
      <main className="mx-auto max-w-(--ui-content-max) px-6 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-ui-display text-ui-section font-semibold text-ui-ink-heading">{es_MX.editor.catalogo.titulo}</h1>
            <p className="mt-1 text-ui-ink-muted">Elige el punto de partida para tu invitación.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled>
              {es_MX.editor.catalogo.filtroTodas}
            </Button>
            <Button variant="secondary" size="sm" disabled>
              {es_MX.editor.catalogo.filtroIncluidasEnPlan}
            </Button>
          </div>
        </div>
        <CatalogoPlantillas />
      </main>
    </>
  );
}
