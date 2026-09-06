"use client";

// app/(chrome)/design/componentes/[slug]/vista-componente.tsx — el cuerpo real de la página de una
// historia. Componente de CLIENTE a propósito: algunas historias (cualquier acción con `onSelect`,
// como la de `EmptyState` «Error genérico») construyen un elemento nativo con manejador de evento
// (`<button onClick>`), y React solo lo permite dentro del árbol de un componente de cliente — un
// Server Component no puede crear un nodo con una prop función (`Event handlers cannot be passed to
// Client Component props`). Por eso `page.tsx` (servidor, con `generateStaticParams`) solo valida y
// pasa el `slug` —una cadena, serializable— y este componente vuelve a resolver la historia por su
// cuenta, ya en el cliente, donde las `render()` de sus variantes son funciones normales.
//
// `@invitaciones/ui/historias` (subpath, NO la raíz del paquete): es el registro completo, con los
// `render()` reales — incluida cualquier historia `"use client"` que registre otro bloque. Un
// Server Component no puede tocar ese registro (contrato de integración F1+F2, ver el comentario de
// `historias/registro.ts`); este componente SÍ puede, porque él mismo es de cliente.
import { historiaPorSlug } from "@invitaciones/ui/historias";
import type { Variante } from "@invitaciones/ui/historias";

function Ficha({ variante }: { variante: Variante }) {
  return (
    <article
      className={`grid gap-3 rounded-ui-card bg-ui-surface-raised p-5 shadow-ui-1${
        variante.ancho === "completo" ? " sm:col-span-2 lg:col-span-3" : ""
      }`}
    >
      <h3 className="font-ui-text text-ui-text-sm font-semibold text-ui-ink">{variante.nombre}</h3>
      {/* `grid-cols-[minmax(0,1fr)]` + `[&>*]:max-w-full`: con la rejilla implícita (`auto`) la
          COLUMNA se dimensiona a `max-content`, así que un `max-width: 100%` del hijo se mide
          contra la propia columna desbordada y no acota nada (el clásico «grid blowout»): medido
          con Skeleton «Texto · 3 líneas» y con la lista de Tabs a 1440, que se salían de la ficha
          por la derecha aun teniendo `max-w-full`/`overflow-x-auto`. Con la columna fijada a
          `minmax(0,1fr)` el hijo se acota de verdad y lo ancho scrollea DENTRO de su componente.
          Antes: con `place-items-center` un hijo se dimensiona a `max-content` y se
          sale de la ficha por los dos lados si es más ancho que ella (medido en la revisión del
          bloque 2 con la variante «Tamaños» de Button a 1440). El hijo se acota aquí; envolver o
          apilar es cosa de cada historia — recortar, nunca. */}
      <div className="grid min-h-24 grid-cols-[minmax(0,1fr)] place-items-center rounded-ui-media bg-ui-surface-alt p-6 [&>*]:max-w-full">
        {variante.render()}
      </div>
      {variante.nota ? <p className="font-ui-text text-ui-text-xs text-ui-ink-muted">{variante.nota}</p> : null}
    </article>
  );
}

export function VistaComponente({ slug }: { slug: string }) {
  const historia = historiaPorSlug(slug);
  // `page.tsx` ya llamó a `notFound()` si la historia no existe; esto es solo para que TypeScript
  // no exija comprobar `undefined` en cada uso de abajo.
  if (!historia) return null;

  return (
    <div className="grid gap-10">
      <header className="grid gap-3">
        <p className="font-ui-label text-ui-label-md uppercase text-ui-ink-muted">Componentes · {historia.familia}</p>
        <h1 className="font-ui-display text-ui-display-xl text-ui-ink">{historia.nombre}</h1>
        <p className="max-w-[68ch] font-ui-text text-ui-text-lg text-ui-ink-muted">{historia.descripcion}</p>
      </header>

      <section aria-labelledby="variantes" className="grid gap-4">
        <h2 id="variantes" className="font-ui-display text-ui-heading-lg text-ui-ink">
          Variantes
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {historia.variantes.map((variante) => (
            <Ficha key={variante.nombre} variante={variante} />
          ))}
        </div>
      </section>

      {historia.estados && historia.estados.length > 0 ? (
        <section aria-labelledby="estados" className="grid gap-4">
          <h2 id="estados" className="font-ui-display text-ui-heading-lg text-ui-ink">
            Estados
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {historia.estados.map((estado) => (
              <Ficha key={estado.nombre} variante={estado} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
