// components/sitio/BuscadorAyuda.tsx — el cuerpo de `/ayuda`: buscador + acordeón de dudas
// (`11 §7`, fila «Ayuda»), con `EmptyState` cuando la búsqueda no encuentra nada.
//
// Por qué el acordeón es `<details>/<summary>` y no un componente de Radix: `@invitaciones/ui` no
// tiene acordeón (no está en el inventario de `11 §5`) y crearlo es trabajo del paquete, con su
// ficha en `/design` y sus estados; mientras tanto, `<details>` da gratis el plegado, el teclado
// (Enter/Espacio), el estado expandido anunciado y la búsqueda del navegador dentro del contenido
// cerrado. NO es «un control nativo sin estilo»: el marcador propio del navegador se retira y el
// disparador lleva sus 44 px, su foco visible y el chevron del sistema. Queda anotado como deuda
// del paquete en el handoff.
"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@invitaciones/ui/componentes/EmptyState.tsx";
import { Field } from "@invitaciones/ui/componentes/Field/index.ts";
import { Input } from "@invitaciones/ui/componentes/Input/index.ts";
import { IconoChevronAbajo } from "@invitaciones/icons";
import { es_MX } from "@/lib/i18n";
import { DUDAS, filtrarDudas, type Duda } from "./dudas-ayuda.ts";

function FilaDuda({ duda }: { readonly duda: Duda }) {
  return (
    <details id={duda.id} className="group scroll-mt-24 border-b border-ui-divider">
      <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 rounded-ui-control py-4 [&::-webkit-details-marker]:hidden">
        <h2 className="heading-sm text-ui-ink">{duda.pregunta}</h2>
        <IconoChevronAbajo
          size={22}
          className="shrink-0 text-ui-link transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="prose pb-5 text-ui-ink">
        {duda.parrafos.map((parrafo) => (
          <p key={parrafo.slice(0, 32)}>{parrafo}</p>
        ))}
      </div>
    </details>
  );
}

/**
 * `/ayuda#planes` llegaba PLEGADO. El botón «Ver planes» del asistente
 * (`components/asistente/MisInvitaciones.tsx`) manda a ese ancla, y el navegador solo hace
 * desplazamiento: el `<details>` sigue cerrado, así que la clienta que venía preguntando por los
 * planes aterrizaba sobre un renglón con un chevron. Aquí se abre el que nombra el fragmento —y se
 * vuelve a hacer al cambiar el `hash`, para que un enlace interno al mismo destino también valga—.
 * Se manipula el `open` del elemento por referencia y no por `props`: el resto del acordeón sigue
 * siendo del navegador (teclado, `aria-expanded`, buscar en la página), que es la razón de usarlo.
 */
function useAbrirLaDelAncla(): void {
  useEffect(() => {
    function abrir(): void {
      const id = window.location.hash.slice(1);
      if (id.length === 0) return;
      if (!DUDAS.some((duda) => duda.id === id)) return;
      const elemento = document.getElementById(id);
      if (!(elemento instanceof HTMLDetailsElement)) return;
      elemento.open = true;
      // El navegador ya se desplazó al ancla ANTES de abrirla, así que la respuesta recién
      // desplegada puede quedar fuera de la pantalla; se recoloca. (`typeof` porque jsdom no
      // implementa `scrollIntoView` y este efecto también corre en las pruebas de unidad.)
      if (typeof elemento.scrollIntoView === "function") {
        elemento.scrollIntoView({ block: "start", behavior: "auto" });
      }
    }
    abrir();
    window.addEventListener("hashchange", abrir);
    return () => window.removeEventListener("hashchange", abrir);
  }, []);
}

export function BuscadorAyuda() {
  const [consulta, setConsulta] = useState("");
  const visibles = useMemo(() => filtrarDudas(DUDAS, consulta), [consulta]);
  useAbrirLaDelAncla();

  return (
    <>
      <div className="mt-8 max-w-md">
        <Field label={es_MX.ayuda.buscar} hint={es_MX.ayuda.buscarAyuda}>
          <Input
            type="search"
            value={consulta}
            autoComplete="off"
            onChange={(evento) => setConsulta(evento.target.value)}
          />
        </Field>
      </div>

      <p role="status" className="text-sm mt-3 text-ui-ink-muted">
        {es_MX.ayuda.resultados(visibles.length)}
      </p>

      {visibles.length === 0 ? (
        <EmptyState
          className="mt-8"
          ilustracion="sin-invitaciones"
          titulo={es_MX.ayuda.sinResultados.titulo}
          texto={es_MX.ayuda.sinResultados.texto}
          accion={{ etiqueta: es_MX.ayuda.sinResultados.accion, onSelect: () => setConsulta("") }}
        />
      ) : (
        <div className="mt-6 border-t border-ui-divider">
          {visibles.map((duda) => (
            <FilaDuda key={duda.id} duda={duda} />
          ))}
        </div>
      )}
    </>
  );
}
