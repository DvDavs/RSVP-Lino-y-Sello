"use client";

// components/asistente/PasoPlantilla.tsx — paso 2 del asistente («Elige el punto de partida»,
// `11 §7`). Las plantillas que llegan aquí YA vienen filtradas por el servidor: el asistente llama
// a `GET /editor/templates2/catalog?eventKind=…` con el tipo elegido en el paso 1. Ese parámetro es
// el que cierra UX-N-02 en el frontend (`bitacora/3b-adv.md` §8.1: el filtro existía en
// `TemplateCatalogService.catalogo(eventKind, …)` y `apps/web` no lo mandaba, así que una clienta de
// XV años podía elegir «Boda clásica» y acabar con las secciones «Los novios» y «Nuestros padres»).
//
// La tarjeta bloqueada por plan NO es un control mudo: dice el motivo («Requiere el plan 2») y
// ofrece una salida real («Ver qué incluye el plan 2» → `/ayuda#planes`, que existe y responde).
import { Badge, Button, Chip, EmptyState, Image, Skeleton } from "@invitaciones/ui";
import { IconoCandado } from "@invitaciones/icons";
import type { CatalogItem } from "@/lib/api-types";
import { es_MX } from "@/lib/i18n";
import {
  capacidadesDisponibles,
  claveDePlantilla,
  entraEnElPlan,
  filtrarPlantillas,
  type Capacidad,
  type FiltrosDePlantilla,
  type NivelDePlan,
} from "./catalogo.ts";

const AYUDA_PLANES = "/ayuda#planes";

export interface PasoPlantillaProps {
  readonly items: readonly CatalogItem[] | null;
  readonly plan: NivelDePlan;
  readonly filtros: FiltrosDePlantilla;
  readonly alCambiarFiltros: (filtros: FiltrosDePlantilla) => void;
  readonly alElegir: (item: CatalogItem) => void;
  /** `slug` de la plantilla cuya elección está en curso, o `null`. */
  readonly ocupada: string | null;
  /** Plantilla ya elegida (al volver al paso desde uno posterior). */
  readonly elegida: string | null;
  readonly alElegirOtroTipo: () => void;
}

export function PasoPlantilla({
  items,
  plan,
  filtros,
  alCambiarFiltros,
  alElegir,
  ocupada,
  elegida,
  alElegirOtroTipo,
}: PasoPlantillaProps) {
  if (items === null) {
    return (
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <li key={i} className="rounded-ui-card border border-ui-divider bg-ui-surface-raised p-4">
            <Skeleton variante="bloque" alto={220} etiqueta={es_MX.comun.cargando} />
            <div className="mt-4">
              <Skeleton variante="texto" lineas={2} />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        ilustracion="sin-invitaciones"
        titulo={es_MX.asistente.plantilla.vacioTitulo}
        texto={es_MX.asistente.plantilla.vacioTexto}
        accion={{ etiqueta: es_MX.asistente.plantilla.vacioAccion, onSelect: alElegirOtroTipo }}
      />
    );
  }

  const capacidades = capacidadesDisponibles(items);
  const visibles = filtrarPlantillas(items, filtros, plan);
  const sinFiltros = !filtros.soloDeMiPlan && filtros.capacidad === null;

  return (
    <div className="flex flex-col gap-6">
      <div role="group" aria-label={es_MX.asistente.plantilla.filtros} className="flex flex-wrap gap-2">
        <Chip
          seleccionado={sinFiltros}
          onClick={() => alCambiarFiltros({ soloDeMiPlan: false, capacidad: null })}
        >
          {es_MX.asistente.plantilla.todas(items.length)}
        </Chip>
        <Chip
          seleccionado={filtros.soloDeMiPlan}
          onClick={() => alCambiarFiltros({ ...filtros, soloDeMiPlan: !filtros.soloDeMiPlan })}
        >
          {es_MX.asistente.plantilla.enMiPlan}
        </Chip>
        {capacidades.map((capacidad) => (
          <Chip
            key={capacidad}
            seleccionado={filtros.capacidad === capacidad}
            onClick={() =>
              alCambiarFiltros({ ...filtros, capacidad: filtros.capacidad === capacidad ? null : capacidad })
            }
          >
            {es_MX.asistente.plantilla.capacidad[capacidad]}
          </Chip>
        ))}
      </div>

      <p role="status" className="text-sm text-ui-ink-muted">
        {es_MX.editor.catalogo.resultados(visibles.length)}
      </p>

      {visibles.length === 0 ? (
        <EmptyState
          ilustracion="sin-invitaciones"
          titulo={es_MX.asistente.plantilla.sinResultadosTitulo}
          texto={es_MX.asistente.plantilla.sinResultadosTexto}
          accion={{
            etiqueta: es_MX.asistente.plantilla.quitarFiltros,
            onSelect: () => alCambiarFiltros({ soloDeMiPlan: false, capacidad: null }),
          }}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((item) => (
            <TarjetaDePlantilla
              key={claveDePlantilla(item)}
              item={item}
              disponible={entraEnElPlan(item, plan)}
              ocupada={ocupada === item.slug}
              otraOcupada={ocupada !== null && ocupada !== item.slug}
              elegida={elegida === item.slug}
              alElegir={() => alElegir(item)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface TarjetaDePlantillaProps {
  readonly item: CatalogItem;
  readonly disponible: boolean;
  readonly ocupada: boolean;
  readonly otraOcupada: boolean;
  readonly elegida: boolean;
  readonly alElegir: () => void;
}

function TarjetaDePlantilla({ item, disponible, ocupada, otraOcupada, elegida, alElegir }: TarjetaDePlantillaProps) {
  const nombre = item.name["es-MX"];
  const capacidades = item.capabilities.filter((c): c is Capacidad => c in es_MX.asistente.plantilla.capacidad);
  return (
    <li className="flex">
      <article className="flex w-full flex-col gap-4 rounded-ui-card border border-ui-divider bg-ui-surface-raised p-4 shadow-ui-1">
        <Image
          src={item.previewUrl}
          alt={es_MX.asistente.plantilla.vistaPreviaDe(nombre)}
          mask="radius-lg"
          ratio="4 / 5"
          className="w-full"
        />
        <div className="flex flex-1 flex-col gap-3">
          {/* 3C-8: era `<h3>` sin ningún `<h2>` entre el `<h1>` del paso ("Elige el punto de
              partida", `AsistenteDeCreacion.tsx`) y esta tarjeta — axe `heading-order` (moderate),
              detectado por `e2e/a11y-producto.spec.ts` (más estricto que `sinViolacionesGraves`,
              que solo mira `critical`/`serious`). Mismo tamaño visual (`heading-sm`): el nivel es
              semántico, no de estilo. */}
          <h2 className="heading-sm text-ui-ink">{nombre}</h2>
          <ul className="flex flex-wrap gap-1.5">
            <li>
              {disponible ? (
                <Badge tone="success">{es_MX.asistente.plantilla.incluida}</Badge>
              ) : (
                <Badge tone="warning">{es_MX.asistente.plantilla.requierePlan(item.minPlanTier)}</Badge>
              )}
            </li>
            {capacidades.map((capacidad) => (
              <li key={capacidad}>
                <Badge tone="neutro">{es_MX.asistente.plantilla.capacidad[capacidad]}</Badge>
              </li>
            ))}
          </ul>
          {disponible ? (
            <Button
              className="mt-auto w-full"
              loading={ocupada}
              loadingText={es_MX.asistente.plantilla.usando}
              disabled={otraOcupada}
              data-testid={`asistente-usar-${item.slug}`}
              onClick={alElegir}
            >
              {elegida ? es_MX.asistente.plantilla.elegida : es_MX.asistente.plantilla.usar}
            </Button>
          ) : (
            <div className="mt-auto flex flex-col gap-2">
              <p className="flex items-start gap-1.5 text-sm text-ui-ink-muted">
                <IconoCandado size={18} className="mt-px shrink-0" />
                {es_MX.asistente.plantilla.requierePlan(item.minPlanTier)}
              </p>
              <Button variant="secundario" className="w-full" asChild>
                <a href={AYUDA_PLANES}>{es_MX.asistente.plantilla.verQueIncluye(item.minPlanTier)}</a>
              </Button>
            </div>
          )}
        </div>
      </article>
    </li>
  );
}
