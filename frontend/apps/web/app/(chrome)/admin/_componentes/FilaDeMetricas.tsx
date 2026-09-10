// app/(chrome)/admin/_componentes/FilaDeMetricas.tsx — la fila de métricas del resumen de `/admin`
// (`12-producto-completo.md §B3.6`): cinco tarjetas con la etiqueta arriba (voz `label`) y la cifra
// grande abajo (voz `display`), y una banda de `Stripes` del sistema debajo de la fila, UNA sola vez
// (regla de composición `10 §1.4`: una forma protagonista por bloque).
//
// Contrato de `estado`: las ETIQUETAS de `metricas` son estáticas y se conocen de entrada (CLIENTAS,
// INVITACIONES…); solo el VALOR depende de la red. Por eso `metricas` se pasa siempre completo (el
// mismo largo en los tres estados) y `estado` decide si se enseña el valor o un `Skeleton` en su
// lugar — así la fila no cambia de tamaño al terminar de cargar. `estado === "error"` sustituye la
// fila entera por `BloqueConError` (el wireframe: el resumen no puede enseñar cifras inventadas ni
// parciales cuando la llamada falló).
//
// Presentacional puro: nada de datos por sí mismo, ningún texto de interfaz literal en el JSX (todo
// llega por props). Server Component: sin hooks propios (`Skeleton`, `Stripes`, `Card` y
// `BloqueConError` ya son server-safe o encapsulan su propia parte cliente).
import type { JSX } from "react";
import { Card } from "@invitaciones/ui/componentes/Card/index.ts";
import { Skeleton } from "@invitaciones/ui/componentes/Skeleton.tsx";
import { Stripes } from "@invitaciones/ui/shapes";
import { BloqueConError, type BloqueConErrorProps } from "./BloqueConError.tsx";
import { clases } from "./clases.ts";

export interface MetricaDeResumen {
  readonly etiqueta: string;
  readonly valor: string | number;
}

export type EstadoFilaDeMetricas = "cargando" | "error" | "listo";

export interface FilaDeMetricasProps {
  readonly metricas: readonly MetricaDeResumen[];
  readonly estado: EstadoFilaDeMetricas;
  /** Nombre accesible del `Skeleton` de cada cifra mientras `estado === "cargando"`. */
  readonly etiquetaCargando: string;
  /** Bloque de error del sistema, listo por si `estado === "error"` (`BloqueConError`). */
  readonly error: Omit<BloqueConErrorProps, "className">;
  readonly className?: string;
}

export function FilaDeMetricas({ metricas, estado, etiquetaCargando, error, className }: FilaDeMetricasProps): JSX.Element {
  if (estado === "error") {
    return <BloqueConError {...error} className={className} />;
  }

  return (
    <div className={clases("flex flex-col gap-5", className)}>
      {/* Cinco tarjetas en escritorio; envuelven en dos columnas a 390 px sin desbordar. */}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {metricas.map((metrica, indice) => (
          <Card key={`${indice}-${metrica.etiqueta}`} as="div" variant="plana" className="flex flex-col gap-1.5">
            <dt className="label-md text-ui-ink-muted">{metrica.etiqueta}</dt>
            <dd className="display-md text-ui-ink">
              {estado === "cargando" ? (
                <Skeleton variante="bloque" alto={30} ancho={64} etiqueta={etiquetaCargando} />
              ) : (
                metrica.valor
              )}
            </dd>
          </Card>
        ))}
      </dl>
      <Stripes tone="support-2-soft" angle={-24} gap={18} width={9} className="h-4 w-full sm:h-5" />
    </div>
  );
}
