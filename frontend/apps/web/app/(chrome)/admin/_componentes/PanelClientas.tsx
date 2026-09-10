"use client";

// app/(chrome)/admin/_componentes/PanelClientas.tsx — la pestaña «Clientas» (`12-producto-completo.md
// §B3.6`): `GET /product/admin/clientas` sobre `Tabla`, con el buscador por nombre/correo y
// paginación del contrato §2. Bloque independiente: su carga, su vacío y su error no dependen de
// ninguna otra pestaña, y un fallo aquí no arrastra a las demás (regla del encargo).
import { useCallback, useEffect, useState, type JSX } from "react";
import { Badge } from "@invitaciones/ui/componentes/Badge/index.ts";
import { Field } from "@invitaciones/ui/componentes/Field/index.ts";
import { Input } from "@invitaciones/ui/componentes/Input/index.ts";
import { listarClientas } from "@/lib/admin/cliente";
import { formatearFechaCorta } from "@/lib/admin/formato";
import { textosAdmin } from "@/lib/admin/textos";
import type { ClientaAdmin, PaginaClientas } from "@/lib/admin/tipos";
import { SessionError } from "@/lib/errors";
import { Paginador } from "./Paginador.tsx";
import type { ColumnaTabla } from "./Tabla.tsx";
import { Tabla } from "./Tabla.tsx";
import { useValorConRetardo } from "./useValorConRetardo.ts";

export interface PanelClientasProps {
  readonly onSesionInvalida: (statusCode: 401 | 403) => void;
}

type EstadoClientas = "cargando" | "error" | "listo";
const TAMANO_PAGINA = 20;

export function PanelClientas({ onSesionInvalida }: PanelClientasProps): JSX.Element {
  const t = textosAdmin.clientas;
  const [buscarCrudo, setBuscarCrudo] = useState("");
  const buscar = useValorConRetardo(buscarCrudo);
  const [pagina, setPagina] = useState(0);
  const [estado, setEstado] = useState<EstadoClientas>("cargando");
  const [datos, setDatos] = useState<PaginaClientas | null>(null);

  // Un cambio de filtro vuelve siempre a la primera página: la página 4 del filtro anterior casi
  // nunca existe en el nuevo resultado.
  useEffect(() => {
    setPagina(0);
  }, [buscar]);

  const cargar = useCallback(() => {
    let cancelado = false;
    setEstado("cargando");
    listarClientas({ pagina, tamano: TAMANO_PAGINA, buscar: buscar || undefined })
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
  }, [pagina, buscar, onSesionInvalida]);

  useEffect(() => cargar(), [cargar]);

  const columnas: ColumnaTabla<ClientaAdmin>[] = [
    { clave: "nombre", encabezado: t.columnas.nombre },
    { clave: "correo", encabezado: t.columnas.correo },
    { clave: "rol", encabezado: t.columnas.rol, render: (fila) => t.roles[fila.rol] },
    {
      clave: "habilitada",
      encabezado: t.columnas.estado,
      render: (fila) => (
        <Badge tone={fila.habilitada ? "success" : "neutro"}>{fila.habilitada ? t.habilitada : t.deshabilitada}</Badge>
      ),
    },
    { clave: "invitaciones", encabezado: t.columnas.invitaciones, alinear: "fin" },
    { clave: "altaEn", encabezado: t.columnas.altaEn, render: (fila) => formatearFechaCorta(fila.altaEn) },
  ];

  return (
    <section aria-labelledby="admin-clientas-titulo" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="admin-clientas-titulo" className="display-sm text-ui-ink">
          {t.titulo}
        </h2>
        <Field label={t.filtros.buscar} className="w-full max-w-xs">
          <Input
            type="search"
            value={buscarCrudo}
            onChange={(evento) => setBuscarCrudo(evento.target.value)}
            placeholder={textosAdmin.comun.buscar}
          />
        </Field>
      </div>

      <Tabla<ClientaAdmin>
        titulo={t.titulo}
        columnas={columnas}
        filas={datos?.elementos ?? []}
        estado={estado}
        claveFila={(fila) => fila.id}
        etiquetaCargando={textosAdmin.comun.cargando}
        vacio={{
          ilustracion: "sin-invitaciones",
          titulo: textosAdmin.comun.sinResultados,
          texto: buscar ? t.vacio.conFiltro : t.vacio.sinFiltro,
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
