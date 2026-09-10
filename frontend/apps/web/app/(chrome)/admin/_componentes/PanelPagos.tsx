"use client";

// app/(chrome)/admin/_componentes/PanelPagos.tsx — la pestaña «Pagos» (`12-producto-completo.md
// §B3.6`): `GET /product/admin/pagos` sobre `Tabla`, con filtro de estado y paginación (contrato
// §5). Bloque independiente de los demás.
//
// `origen` (contrato §5): hoy siempre `"invitaciones"` porque E4 no ha aterrizado su fuente de pagos
// propia (`lib/admin/README.md`). La vista se pinta igual (misma `Tabla`, mismas columnas); la única
// diferencia es una nota informativa (`textosAdmin.pagos.fuenteDatos`) que desaparece sola el día
// que el backend responda `origen: "pagos"` — no hay ninguna rama de UI distinta por origen.
import { useCallback, useEffect, useState, type JSX } from "react";
import { Field } from "@invitaciones/ui/componentes/Field/index.ts";
import { Select, type OpcionSelect } from "@invitaciones/ui/componentes/Select/index.ts";
import { listarPagos } from "@/lib/admin/cliente";
import { GUION_LARGO, etiquetaEstadoPago, formatearFechaCorta, formatearImporte } from "@/lib/admin/formato";
import { textosAdmin } from "@/lib/admin/textos";
import type { EstadoPago, PagoAdmin, PaginaPagos } from "@/lib/admin/tipos";
import { SessionError } from "@/lib/errors";
import { EtiquetaDeEstado } from "./EtiquetaDeEstado.tsx";
import { Paginador } from "./Paginador.tsx";
import type { ColumnaTabla } from "./Tabla.tsx";
import { Tabla } from "./Tabla.tsx";

export interface PanelPagosProps {
  readonly onSesionInvalida: (statusCode: 401 | 403) => void;
}

type EstadoCarga = "cargando" | "error" | "listo";
const TAMANO_PAGINA = 20;
const TODOS = "todos";

export function PanelPagos({ onSesionInvalida }: PanelPagosProps): JSX.Element {
  const t = textosAdmin.pagos;
  const [filtroEstado, setFiltroEstado] = useState<EstadoPago | typeof TODOS>(TODOS);
  const [pagina, setPagina] = useState(0);
  const [estado, setEstado] = useState<EstadoCarga>("cargando");
  const [datos, setDatos] = useState<PaginaPagos | null>(null);

  useEffect(() => {
    setPagina(0);
  }, [filtroEstado]);

  const cargar = useCallback(() => {
    let cancelado = false;
    setEstado("cargando");
    listarPagos({ pagina, tamano: TAMANO_PAGINA, estado: filtroEstado === TODOS ? undefined : filtroEstado })
      .then((resultado) => {
        if (cancelado) return;
        setDatos(resultado);
        setEstado("listo");
      })
      .catch((error: unknown) => {
        if (cancelado) return;
        if (error instanceof SessionError) {
          onSesionInvalida(error.statusCode);
          return;
        }
        setEstado("error");
      });
    return () => {
      cancelado = true;
    };
  }, [pagina, filtroEstado, onSesionInvalida]);

  useEffect(() => cargar(), [cargar]);

  const opcionesEstado: OpcionSelect[] = [
    { value: TODOS, label: t.filtros.estadoTodos },
    { value: "pagado", label: t.estados.pagado },
    { value: "pendiente", label: t.estados.pendiente },
    { value: "devuelto", label: t.estados.devuelto },
  ];

  const columnas: ColumnaTabla<PagoAdmin>[] = [
    { clave: "clienta", encabezado: t.columnas.clienta },
    { clave: "invitacionId", encabezado: t.columnas.invitacion },
    { clave: "plan", encabezado: t.columnas.plan, render: (fila) => fila.plan ?? GUION_LARGO },
    { clave: "importe", encabezado: t.columnas.importe, alinear: "fin", render: (fila) => formatearImporte(fila.importe, fila.moneda) },
    {
      clave: "estado",
      encabezado: t.columnas.estado,
      render: (fila) => <EtiquetaDeEstado familia="pago" estado={fila.estado} texto={etiquetaEstadoPago(fila.estado)} />,
    },
    { clave: "fecha", encabezado: t.columnas.fecha, render: (fila) => formatearFechaCorta(fila.fecha) },
  ];

  return (
    <section aria-labelledby="admin-pagos-titulo" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="admin-pagos-titulo" className="display-sm text-ui-ink">
          {t.titulo}
        </h2>
        <Field label={t.filtros.estado} className="w-40">
          <Select opciones={opcionesEstado} value={filtroEstado} onValueChange={(valor) => setFiltroEstado(valor as EstadoPago | typeof TODOS)} />
        </Field>
      </div>

      {datos?.origen === "invitaciones" ? <p className="text-sm text-ui-ink-muted">{t.fuenteDatos}</p> : null}

      <Tabla<PagoAdmin>
        titulo={t.titulo}
        columnas={columnas}
        filas={datos?.elementos ?? []}
        estado={estado}
        claveFila={(fila) => fila.id}
        etiquetaCargando={textosAdmin.comun.cargando}
        vacio={{
          ilustracion: "sin-invitaciones",
          titulo: textosAdmin.comun.sinResultados,
          texto: filtroEstado !== TODOS ? t.vacio.conFiltro : t.vacio.sinFiltro,
        }}
        error={{
          titulo: t.error.titulo,
          cuerpo: t.error.cuerpo,
          etiquetaReintentar: t.error.accion,
          onReintentar: cargar,
        }}
      />

      {estado === "listo" && datos ? (
        <Paginador pagina={datos.pagina} tamano={datos.tamano} total={datos.total} onCambiar={setPagina} />
      ) : null}
    </section>
  );
}
