import type { Metadata } from "next";
import Link from "next/link";
import { metadatos } from "@invitaciones/ui";
import type { FamiliaHistoria, MetadatoHistoria } from "@invitaciones/ui";

// app/(chrome)/design/componentes/page.tsx — índice de la galería de componentes (`11 §5`, `11
// §8.1`). Server Component que lee SOLO `metadatos` (`@invitaciones/ui`, raíz del paquete) — nunca
// `registro`: `registro` vive en el subpath `@invitaciones/ui/historias` y es exclusivo de
// componentes de cliente (contrato de integración F1+F2, medido en `4ea8d00`: una historia
// `"use client"` —Dialog, Tabs, Toast…— llega como referencia cliente sin `slug` a un Server
// Component y `next build` revienta). `metadatos` no tiene ese problema (es una lista de datos
// llana, sin `render()`), así que esta página sigue funcionando con lo que haya registrado y crece
// sola según F1/F2/F3 añaden entradas — con cero entradas también (mensaje de abajo).
export const metadata: Metadata = {
  title: "Componentes",
};

const NOMBRE_FAMILIA: Record<FamiliaHistoria, string> = {
  formularios: "Formularios",
  superficies: "Superficies",
  navegacion: "Navegación",
  estados: "Estados",
  imagen: "Imagen",
};

function agruparPorFamilia(lista: readonly MetadatoHistoria[]): ReadonlyMap<FamiliaHistoria, readonly MetadatoHistoria[]> {
  const grupos = new Map<FamiliaHistoria, MetadatoHistoria[]>();
  for (const metadato of lista) {
    const acumulado = grupos.get(metadato.familia) ?? [];
    acumulado.push(metadato);
    grupos.set(metadato.familia, acumulado);
  }
  for (const acumulado of grupos.values()) acumulado.sort((a, b) => a.nombre.localeCompare(b.nombre));
  return grupos;
}

export default function IndiceComponentes() {
  const grupos = agruparPorFamilia(metadatos);

  return (
    <div className="grid gap-10">
      <header className="grid gap-3">
        <p className="font-ui-label text-ui-label-md uppercase text-ui-ink-muted">Sistema de diseño · componentes</p>
        <h1 className="font-ui-display text-ui-display-xl text-ui-ink">Componentes</h1>
        <p className="max-w-[68ch] font-ui-text text-ui-text-lg text-ui-ink-muted">
          Cada componente con todas sus variantes y estados, como los ve el teclado y el lector de pantalla. Radix
          como base accesible, aspecto propio, color solo desde tokens. {metadatos.length} historia
          {metadatos.length === 1 ? "" : "s"} registrada{metadatos.length === 1 ? "" : "s"}.
        </p>
      </header>

      {metadatos.length === 0 ? (
        <p className="max-w-[60ch] rounded-ui-card bg-ui-surface-alt p-5 font-ui-text text-ui-text-sm text-ui-ink-muted">
          Ninguna historia registrada todavía en este árbol. Se añaden en{" "}
          <code className="font-ui-label">packages/ui/src/historias/registro.ts</code> (y su gemelo seguro para
          servidor, <code className="font-ui-label">metadatos.ts</code>); esta página no necesita cambiar cuando
          aparezcan.
        </p>
      ) : (
        [...grupos.entries()].map(([familia, lista]) => (
          <section key={familia} aria-labelledby={`familia-${familia}`} className="grid gap-4">
            <h2 id={`familia-${familia}`} className="font-ui-display text-ui-heading-lg text-ui-ink">
              {NOMBRE_FAMILIA[familia]}
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {lista.map((metadato) => (
                <li key={metadato.slug}>
                  <article className="grid h-full gap-2 rounded-ui-card bg-ui-surface-raised p-5 shadow-ui-1">
                    <h3 className="font-ui-display text-ui-heading-md text-ui-ink">
                      <Link
                        href={`/design/componentes/${metadato.slug}`}
                        className="text-ui-link no-underline hover:underline"
                      >
                        {metadato.nombre}
                      </Link>
                    </h3>
                    <p className="font-ui-text text-ui-text-sm text-ui-ink-muted">{metadato.descripcion}</p>
                  </article>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
