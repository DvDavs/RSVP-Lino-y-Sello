"use client";

// app/(chrome)/admin/_componentes/Tabla.tsx — la tabla genérica de la consola de administración
// (`12-producto-completo.md §B3.6`: Invitaciones, Clientas, Pagos, Plantillas registradas). Tipada
// con genéricos (`Tabla<T>`): la pantalla decide QUÉ columnas y QUÉ filas, este componente solo sabe
// pintarlas en los cuatro estados del bloque.
//
// `<table>` real, con `<caption>` accesible y `<thead><th scope="col">` — nunca una rejilla de
// `div`s que no dice nada a un lector de pantalla. El desbordamiento horizontal vive SOLO dentro de
// la tabla, en su propio contenedor `overflow-x-auto` con `tabIndex={0}` (desplazable por teclado);
// la página nunca se desplaza en horizontal. Ese contenedor lleva `role="group"`: un `<div>` sin
// `role` tiene rol implícito "generic", que prohíbe nombrarlo con `aria-label` (ARIA en HTML) — axe
// lo marca `aria-prohibited-attr`, serio (`bitacora/5-E5-F.md §3`, mismo defecto que
// `packages/ui/src/componentes/Skeleton.tsx` ya documentó y arregló con `role="status"` en su propio
// contenedor). Ni "status" (no es una espera con progreso) ni "region" (cada `Tabla` vive dentro de
// un `<section aria-labelledby>` con el MISMO nombre accesible — probado, `region` duplicado choca
// con `landmark-unique`, axe otra vez): "group" nombra el contenedor sin crear un landmark nuevo.
// En móvil (< 640 px, breakpoint `sm` de Tailwind) la
// tabla se sustituye por tarjetas apiladas — una por fila, etiqueta y valor por columna — como pide
// el wireframe; ambas vistas conviven en el documento y `sm:`/`hidden` decide cuál se ve, mismo
// patrón que ya usa el resto del chrome (`components/editor/PublishDialog.tsx`, `ed:hidden`).
//
// `estado === "cargando"` pinta filas de `Skeleton` (nunca un texto «Cargando…» suelto);
// `estado === "vacio"` pinta el `EmptyState` del sistema; `estado === "error"` pinta
// `BloqueConError`. Con CERO filas y `estado === "listo"` (la pantalla se olvidó de poner
// `"vacio"`, o el filtro de un `Select`/`Input` externo dejó la lista en cero) se trata igual que
// `"vacio"` — nunca una tabla con cabecera y ninguna fila, que no dice nada.
//
// DESBORDE HORIZONTAL A ANCHOS INTERMEDIOS (5-E5-J, defecto 3). Entre 640 px (donde las tarjetas
// apiladas dejan paso a la tabla) y el ancho en que la tabla ya cabe entera, `min-w-max` deja
// columnas fuera de vista — en Invitaciones a 768 px la que se pierde es «Acciones», la del botón
// Deshabilitar/Habilitar, y NADA en pantalla decía que hubiera más tabla a la derecha
// (`bitacora/5-E5-I.md §3`). Lo que NO se hizo y por qué:
//   · subir el corte de tarjetas a 768 px NO vale: en tarjetas la acción destructiva se enseña
//     deshabilitada con su razón («se activa en pantalla ancha», `AccionDeFila.tsx`, regla del
//     wireframe). A 768 px sobra sitio para ejecutarla de verdad; cambiar un control usable por uno
//     deshabilitado es perder función, no ganarla.
//   · fijar («sticky») la última columna tampoco, HOY: `position: sticky` sobre `<th>`/`<td>` exige
//     cambiar la tabla a `border-separate` y mover los separadores de `<tr>` a cada celda, y
//     `Tabla<T>` es genérica — no sabe cuál de sus columnas es «la de acciones», haría falta una
//     prop nueva en `ColumnaTabla<T>`. Es la mejora de verdad para ese ancho y va propuesta al dueño
//     como `ADR-5-E5-08`, no decidida por una sesión de arreglo de defectos.
//   · quitar `min-w-max` por debajo de `lg` se PROBÓ y se midió (Chromium real, 768 px): el botón
//     de la fila pasa de sobresalir 154 px a 40 px —sigue sin caber— y a cambio los nombres de
//     clienta se parten en tres líneas en las cuatro tablas. Se descartó: paga toda la densidad de
//     la tabla por media solución.
// Lo que sí: una PISTA VISUAL de desborde, medida (no adivinada por breakpoint) — un velo en el
// borde derecho que aparece solo si el contenedor de verdad puede desplazarse más a la derecha y se
// apaga al llegar al final. Decorativo (`aria-hidden`), sin texto nuevo (los textos de esta pantalla
// viven en `lib/admin/textos.ts`, fuera del territorio de esta sesión) y sin tocar el contrato de
// accesibilidad: el contenedor sigue siendo el MISMO `role="group"` con `tabIndex={0}` y su
// `aria-label` (`bitacora/5-E5-H.md`), que es el camino de teclado y de lector de pantalla.
// Por eso este componente pasó a ser de CLIENTE: la medida (`scrollWidth` vs `clientWidth`) solo
// existe en un navegador. Los cinco paneles que lo usan ya son `"use client"`, así que no añade
// frontera nueva ni peso a la primera carga.
//
// Antes era Server Component; el resto sigue igual: sin estado de datos propio. `claveFila` (no está en el wireframe) es la única prop que
// este componente añade sobre el pedido literal — hace falta una clave de React estable por fila
// que no dependa del índice del array (evita que React reconcilie mal al filtrar/ordenar).
import { useCallback, useEffect, useRef, useState, type JSX, type ReactNode } from "react";
import { Card } from "@invitaciones/ui/componentes/Card/index.ts";
import { EmptyState, type EmptyStateAccion } from "@invitaciones/ui/componentes/EmptyState.tsx";
import { Skeleton } from "@invitaciones/ui/componentes/Skeleton.tsx";
import type { NombreIlustracion } from "@invitaciones/ui/ilustraciones/tipos.ts";
import { BloqueConError, type BloqueConErrorProps } from "./BloqueConError.tsx";
import { clases } from "./clases.ts";

export type AlineacionColumna = "inicio" | "centro" | "fin";

export interface ColumnaTabla<T> {
  /** Clave de la columna. Sin `render`, se usa como propiedad de `T` para leer el valor bruto. */
  readonly clave: string;
  readonly encabezado: string;
  readonly alinear?: AlineacionColumna;
  readonly render?: (fila: T) => ReactNode;
}

export type EstadoTabla = "cargando" | "error" | "vacio" | "listo";

export interface TablaProps<T> {
  /** Nombre accesible de la tabla (`<caption>`). Visible solo si `tituloVisible`. */
  readonly titulo: string;
  /** `true` cuando NINGÚN encabezado visible de la pantalla ya dice este título. Por defecto oculto
   * para lectores de pantalla únicamente (`sr-only`), asumiendo que la pantalla ya puso uno visible. */
  readonly tituloVisible?: boolean;
  readonly columnas: readonly ColumnaTabla<T>[];
  readonly filas: readonly T[];
  readonly estado: EstadoTabla;
  /** Clave de React estable por fila (no el índice del array). */
  readonly claveFila: (fila: T) => string | number;
  readonly vacio: {
    readonly ilustracion: NombreIlustracion;
    readonly titulo: string;
    readonly texto: string;
    readonly accion?: EmptyStateAccion;
  };
  readonly error: Omit<BloqueConErrorProps, "className">;
  /** Nombre accesible de los `Skeleton` mientras `estado === "cargando"`. */
  readonly etiquetaCargando: string;
  /** Cuántas filas de `Skeleton` pintar mientras carga. */
  readonly filasCargando?: number;
  readonly className?: string;
}

const ALINEACION: Record<AlineacionColumna, string> = {
  inicio: "text-left",
  centro: "text-center",
  fin: "text-right",
};

function celda<T>(fila: T, columna: ColumnaTabla<T>): ReactNode {
  if (columna.render) return columna.render(fila);
  const bruto = (fila as Record<string, unknown>)[columna.clave];
  return bruto === undefined || bruto === null || bruto === "" ? null : String(bruto);
}

export function Tabla<T,>({
  titulo,
  tituloVisible = false,
  columnas,
  filas,
  estado,
  claveFila,
  vacio,
  error,
  etiquetaCargando,
  filasCargando = 4,
  className,
}: TablaProps<T>): JSX.Element {
  // Cero filas con `estado="listo"` es el mismo vacío que `estado="vacio"` (comentario de cabecera).
  const estadoEfectivo: EstadoTabla = estado === "listo" && filas.length === 0 ? "vacio" : estado;

  // Pista de desborde (ver cabecera). Los hooks van ANTES de los retornos tempranos de abajo:
  // el orden de hooks de React no puede depender del estado del bloque.
  const contenedor = useRef<HTMLDivElement | null>(null);
  const [quedaTablaALaDerecha, setQuedaTablaALaDerecha] = useState(false);

  const medirDesborde = useCallback(() => {
    const nodo = contenedor.current;
    if (nodo === null) {
      setQuedaTablaALaDerecha(false);
      return;
    }
    // `+ 1` de holgura: con zoom o escalas fraccionarias `scrollWidth` puede superar a `clientWidth`
    // por un subpíxel sin que haya nada que desplazar.
    setQuedaTablaALaDerecha(nodo.scrollWidth - nodo.clientWidth - nodo.scrollLeft > 1);
  }, []);

  useEffect(() => {
    const nodo = contenedor.current;
    if (nodo === null) return;
    medirDesborde();
    nodo.addEventListener("scroll", medirDesborde, { passive: true });
    // `ResizeObserver` no existe en jsdom (ni en navegadores muy viejos): el `resize` de la ventana
    // cubre el caso principal —cambiar de ancho— cuando falta.
    const observador =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            medirDesborde();
          });
    if (observador !== null) {
      observador.observe(nodo);
      // La tabla en sí también cambia de ancho al filtrar, aunque el contenedor no se mueva.
      if (nodo.firstElementChild !== null) observador.observe(nodo.firstElementChild);
    } else {
      window.addEventListener("resize", medirDesborde);
    }
    return () => {
      nodo.removeEventListener("scroll", medirDesborde);
      if (observador !== null) observador.disconnect();
      else window.removeEventListener("resize", medirDesborde);
    };
    // `filas`/`columnas`/`estadoEfectivo` cambian el ancho del contenido: hay que volver a medir.
  }, [medirDesborde, columnas, filas, estadoEfectivo]);

  if (estadoEfectivo === "error") {
    return <BloqueConError {...error} className={className} />;
  }

  if (estadoEfectivo === "vacio") {
    return <EmptyState {...vacio} className={className} />;
  }

  const cargando = estadoEfectivo === "cargando";
  const indicesEsqueleto = Array.from({ length: filasCargando }, (_, i) => i);

  return (
    <div className={clases("flex flex-col gap-3", className)}>
      {/* Escritorio (≥ 640 px): tabla real, con su propio scroll horizontal. */}
      <div className="relative hidden sm:block">
        <div
          ref={contenedor}
          className="overflow-x-auto rounded-ui-card border border-ui-divider"
          tabIndex={0}
          role="group"
          aria-label={titulo}
        >
          <table className="w-full min-w-max border-collapse text-sm">
            <caption className={tituloVisible ? "heading-md px-4 py-3 text-left text-ui-ink" : "sr-only"}>{titulo}</caption>
            <thead>
              <tr className="border-b border-ui-divider bg-ui-surface-alt">
                {columnas.map((columna) => (
                  <th key={columna.clave} scope="col" className={clases("label-sm px-4 py-2.5 text-ui-ink-muted", ALINEACION[columna.alinear ?? "inicio"])}>
                    {columna.encabezado}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cargando
                ? indicesEsqueleto.map((indice) => (
                    <tr key={`esqueleto-${indice}`} className="border-b border-ui-divider last:border-0">
                      {columnas.map((columna) => (
                        <td key={columna.clave} className="px-4 py-3">
                          <Skeleton variante="bloque" alto={16} etiqueta={etiquetaCargando} />
                        </td>
                      ))}
                    </tr>
                  ))
                : filas.map((fila) => (
                    <tr key={claveFila(fila)} className="border-b border-ui-divider last:border-0">
                      {columnas.map((columna) => (
                        <td key={columna.clave} className={clases("px-4 py-3 text-ui-ink", ALINEACION[columna.alinear ?? "inicio"])}>
                          {celda(fila, columna)}
                        </td>
                      ))}
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Pista de desborde: velo en el borde derecho, SOLO mientras quede tabla por ver hacia
            allá (`quedaTablaALaDerecha`, medido). Decorativo y sin eventos: no tapa ningún
            control ni entra en el orden de tabulación. El degradado va del fondo que se ve bajo
            la tabla (`--ui-surface`) a transparente. */}
        {quedaTablaALaDerecha ? (
          <span
            aria-hidden="true"
            data-testid="tabla-desborde-derecha"
            className="pointer-events-none absolute inset-y-px right-px w-10 rounded-r-ui-card bg-linear-to-l from-ui-surface to-transparent"
          />
        ) : null}
      </div>

      {/* Móvil (< 640 px): tarjetas apiladas, una por fila, etiqueta y valor por columna. */}
      <div className="flex flex-col gap-3 sm:hidden">
        {cargando
          ? indicesEsqueleto.map((indice) => (
              <Card key={`esqueleto-movil-${indice}`} variant="plana">
                <Skeleton variante="texto" lineas={columnas.length} etiqueta={etiquetaCargando} />
              </Card>
            ))
          : filas.map((fila) => (
              <Card key={claveFila(fila)} variant="plana" className="flex flex-col gap-2">
                {columnas.map((columna) => (
                  <div key={columna.clave} className="flex items-baseline justify-between gap-3">
                    <span className="label-sm shrink-0 text-ui-ink-muted">{columna.encabezado}</span>
                    <span className="text-right text-sm text-ui-ink">{celda(fila, columna)}</span>
                  </div>
                ))}
              </Card>
            ))}
      </div>
    </div>
  );
}
