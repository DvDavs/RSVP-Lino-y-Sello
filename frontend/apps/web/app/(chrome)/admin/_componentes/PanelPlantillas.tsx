"use client";

// app/(chrome)/admin/_componentes/PanelPlantillas.tsx — la pestaña «Plantillas» (`12-producto-completo
// .md §B3.6`): `GET /product/admin/plantillas` sobre `Tabla`, SOLO LECTURA (el alta es con el kit de
// autor de la fase 4, nunca desde aquí — regla dura del encargo, README de la carpeta). Sin
// paginación: `ListaPlantillas` (contrato §7) trae `{ total, elementos }`, no `pagina`/`tamano` — la
// vista pinta el total que el backend decida devolver, funcione con las 2 plantillas de hoy o las 15
// que llegan con el merge de la fase 4, sin ningún número codificado.
import { useCallback, useEffect, useState, type JSX } from "react";
import { Badge } from "@invitaciones/ui/componentes/Badge/index.ts";
import { listarPlantillas } from "@/lib/admin/cliente";
import { GUION_LARGO, formatearFechaCorta } from "@/lib/admin/formato";
import { textosAdmin } from "@/lib/admin/textos";
import type { PlantillaAdmin } from "@/lib/admin/tipos";
import { SessionError } from "@/lib/errors";
import type { ColumnaTabla } from "./Tabla.tsx";
import { Tabla } from "./Tabla.tsx";

export interface PanelPlantillasProps {
  readonly onSesionInvalida: (statusCode: 401 | 403) => void;
}

type EstadoCarga = "cargando" | "error" | "listo";

export function PanelPlantillas({ onSesionInvalida }: PanelPlantillasProps): JSX.Element {
  const t = textosAdmin.plantillas;
  const [estado, setEstado] = useState<EstadoCarga>("cargando");
  const [filas, setFilas] = useState<PlantillaAdmin[]>([]);

  const cargar = useCallback(() => {
    let cancelado = false;
    setEstado("cargando");
    listarPlantillas()
      .then((resultado) => {
        if (cancelado) return;
        setFilas(resultado.elementos);
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
  }, [onSesionInvalida]);

  useEffect(() => cargar(), [cargar]);

  const columnas: ColumnaTabla<PlantillaAdmin>[] = [
    { clave: "slug", encabezado: t.columnas.slug },
    { clave: "version", encabezado: t.columnas.version },
    {
      clave: "estado",
      encabezado: t.columnas.estado,
      render: (fila) => <Badge tone={fila.estado === "published" ? "success" : "neutro"}>{t.estados[fila.estado]}</Badge>,
    },
    {
      clave: "tiposDeEvento",
      encabezado: t.columnas.tiposDeEvento,
      render: (fila) => (fila.tiposDeEvento.length > 0 ? fila.tiposDeEvento.join(", ") : GUION_LARGO),
    },
    { clave: "registradaEn", encabezado: t.columnas.registradaEn, render: (fila) => formatearFechaCorta(fila.registradaEn) },
    { clave: "invitaciones", encabezado: t.columnas.invitaciones, alinear: "fin" },
  ];

  return (
    <section aria-labelledby="admin-plantillas-titulo" className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <h2 id="admin-plantillas-titulo" className="display-sm text-ui-ink">
          {t.titulo}
        </h2>
        <p className="text-sm text-ui-ink-muted">{t.subtitulo}</p>
      </div>

      <Tabla<PlantillaAdmin>
        titulo={t.titulo}
        columnas={columnas}
        filas={filas}
        estado={estado}
        claveFila={(fila) => `${fila.slug}@${fila.version}`}
        etiquetaCargando={textosAdmin.comun.cargando}
        vacio={{
          ilustracion: "sin-invitaciones",
          titulo: textosAdmin.comun.sinResultados,
          texto: t.vacio,
        }}
        error={{
          titulo: t.error.titulo,
          cuerpo: t.error.cuerpo,
          etiquetaReintentar: t.error.accion,
          onReintentar: cargar,
        }}
      />
    </section>
  );
}
