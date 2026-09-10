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
// Server Component: sin hooks propios. `claveFila` (no está en el wireframe) es la única prop que
// este componente añade sobre el pedido literal — hace falta una clave de React estable por fila
// que no dependa del índice del array (evita que React reconcilie mal al filtrar/ordenar).
import type { JSX, ReactNode } from "react";
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
      <div
        className="hidden overflow-x-auto rounded-ui-card border border-ui-divider sm:block"
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
