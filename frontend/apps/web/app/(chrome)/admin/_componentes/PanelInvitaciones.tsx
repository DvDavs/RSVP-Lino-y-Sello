"use client";

// app/(chrome)/admin/_componentes/PanelInvitaciones.tsx — la pestaña «Invitaciones»
// (`12-producto-completo.md §B3.6`): `GET /product/admin/invitaciones` sobre `Tabla`, con buscador,
// filtro de estado y de pago (los tres soportados por el contrato §3, `InvitacionesQuery`) y
// paginación. Bloque independiente de los demás (carga/vacío/error propios).
//
// El filtro «Plan» (wireframe + `textosAdmin.invitaciones.filtros.plan`) NO tiene parámetro de
// servidor en el contrato (`InvitacionesQuery` no trae `plan`, solo `pago`): se resuelve en cliente,
// filtrando la página ya cargada por el nombre de plan (`GET /product/admin/planes`, endpoint que
// solo existe para alimentar esta lista de opciones — no hay pestaña «Planes» en el wireframe).
// Documentado como decisión de ensamblado en `ADR-5-E5-04`. Si `listarPlanes()` falla, el filtro de
// plan simplemente no aparece (degradación silenciosa de una comodidad, no de un dato: la tabla de
// invitaciones sigue funcionando entera sin él).
//
// Alternar estado (`PUT /admin/invitations/{id}/toggle-status`, ruta heredada) no devuelve el nuevo
// estado (`lib/admin/README.md`): tras confirmar, se vuelve a pedir `listarInvitaciones` para
// refrescar la columna Estado, nunca se aplica un cambio "optimista" que podría no reflejar lo que
// el backend decidió de verdad (jerarquía, `hierarchyValidationService`).
import { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import { Button } from "@invitaciones/ui/componentes/Button/index.ts";
import { Field } from "@invitaciones/ui/componentes/Field/index.ts";
import { Input } from "@invitaciones/ui/componentes/Input/index.ts";
import { Select, type OpcionSelect } from "@invitaciones/ui/componentes/Select/index.ts";
import { alternarEstadoInvitacion, listarInvitaciones, listarPlanes } from "@/lib/admin/cliente";
import { GUION_LARGO, etiquetaEstadoInvitacion, etiquetaEstadoPago, formatearFechaEvento } from "@/lib/admin/formato";
import { textosAdmin } from "@/lib/admin/textos";
import type { EstadoInvitacion, FiltroPagoInvitacion, InvitacionAdmin, PaginaInvitaciones, PlanAdmin } from "@/lib/admin/tipos";
import { SessionError } from "@/lib/errors";
import { enlacePublico } from "@/lib/enlace-publico";
import { AccionDeFila } from "./AccionDeFila.tsx";
import { BloqueConError } from "./BloqueConError.tsx";
import { EtiquetaDeEstado } from "./EtiquetaDeEstado.tsx";
import { Paginador } from "./Paginador.tsx";
import type { ColumnaTabla } from "./Tabla.tsx";
import { Tabla } from "./Tabla.tsx";
import { useValorConRetardo } from "./useValorConRetardo.ts";

export interface PanelInvitacionesProps {
  readonly onSesionInvalida: (statusCode: 401 | 403) => void;
}

type EstadoCarga = "cargando" | "error" | "listo";
const TAMANO_PAGINA = 20;
const TODOS = "todos";

export function PanelInvitaciones({ onSesionInvalida }: PanelInvitacionesProps): JSX.Element {
  const t = textosAdmin.invitaciones;
  const [buscarCrudo, setBuscarCrudo] = useState("");
  const buscar = useValorConRetardo(buscarCrudo);
  const [filtroEstado, setFiltroEstado] = useState<EstadoInvitacion | typeof TODOS>(TODOS);
  const [filtroPago, setFiltroPago] = useState<FiltroPagoInvitacion | typeof TODOS>(TODOS);
  const [filtroPlan, setFiltroPlan] = useState<string>(TODOS);
  const [pagina, setPagina] = useState(0);

  const [estado, setEstado] = useState<EstadoCarga>("cargando");
  const [datos, setDatos] = useState<PaginaInvitaciones | null>(null);
  const [planes, setPlanes] = useState<PlanAdmin[]>([]);

  const [filaAlternando, setFilaAlternando] = useState<number | null>(null);
  const [filaConError, setFilaConError] = useState<number | null>(null);

  useEffect(() => {
    setPagina(0);
  }, [buscar, filtroEstado, filtroPago, filtroPlan]);

  const cargar = useCallback(() => {
    let cancelado = false;
    setEstado("cargando");
    listarInvitaciones({
      pagina,
      tamano: TAMANO_PAGINA,
      buscar: buscar || undefined,
      estado: filtroEstado === TODOS ? undefined : filtroEstado,
      pago: filtroPago === TODOS ? undefined : filtroPago,
    })
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
  }, [pagina, buscar, filtroEstado, filtroPago, onSesionInvalida]);

  useEffect(() => cargar(), [cargar]);

  // Planes: solo alimenta el filtro «Plan» (comentario de cabecera). Falla en silencio: sin
  // planes, el selector no aparece, pero la tabla de invitaciones sigue completa.
  useEffect(() => {
    let cancelado = false;
    listarPlanes()
      .then((resultado) => {
        if (!cancelado) setPlanes(resultado.elementos);
      })
      .catch(() => {
        // Degradación silenciosa a propósito: ver comentario de cabecera.
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const filas = useMemo(() => {
    const elementos = datos?.elementos ?? [];
    if (filtroPlan === TODOS) return elementos;
    return elementos.filter((fila) => fila.plan === filtroPlan);
  }, [datos, filtroPlan]);

  // Devuelve una promesa que SIEMPRE resuelve (nunca rechaza): `AccionDeFila` hace
  // `await onConfirmar()` y solo cierra su diálogo cuando esta promesa termina — si rechazara, el
  // diálogo se quedaría abierto sin decir por qué. El error se cuenta aparte, con `filaConError`.
  function alternar(fila: InvitacionAdmin): Promise<void> {
    setFilaAlternando(fila.id);
    setFilaConError(null);
    return alternarEstadoInvitacion(fila.id)
      .then(() => {
        setFilaAlternando(null);
        cargar();
      })
      .catch((error: unknown) => {
        setFilaAlternando(null);
        if (error instanceof SessionError) {
          onSesionInvalida(error.statusCode);
          return;
        }
        setFilaConError(fila.id);
      });
  }

  const opcionesEstado: OpcionSelect[] = [
    { value: TODOS, label: t.filtros.estadoTodos },
    { value: "publicada", label: t.estados.publicada },
    { value: "en-edicion", label: t.estados.enEdicion },
    { value: "deshabilitada", label: t.estados.deshabilitada },
  ];
  const opcionesPago: OpcionSelect[] = [
    { value: TODOS, label: t.filtros.pagoTodos },
    { value: "pagada", label: t.pago.pagada },
    { value: "pendiente", label: t.pago.pendiente },
  ];
  const opcionesPlan: OpcionSelect[] = [
    { value: TODOS, label: t.filtros.planTodos },
    ...planes.map((plan) => ({ value: plan.nombre, label: plan.nombre })),
  ];

  const columnas: ColumnaTabla<InvitacionAdmin>[] = [
    {
      clave: "evento",
      encabezado: t.columnas.evento,
      render: (fila) => (
        <div className="flex flex-col">
          <span>{fila.evento || GUION_LARGO}</span>
          <span className="text-xs text-ui-ink-muted">{formatearFechaEvento(fila.fecha, fila.hora)}</span>
        </div>
      ),
    },
    { clave: "clienta", encabezado: t.columnas.clienta },
    { clave: "plan", encabezado: t.columnas.plan, render: (fila) => fila.plan ?? GUION_LARGO },
    {
      clave: "pagada",
      encabezado: t.columnas.pago,
      render: (fila) => (
        <EtiquetaDeEstado
          familia="pago"
          estado={fila.pagada ? "pagado" : "pendiente"}
          texto={etiquetaEstadoPago(fila.pagada ? "pagado" : "pendiente")}
        />
      ),
    },
    {
      clave: "estado",
      encabezado: t.columnas.estado,
      render: (fila) => <EtiquetaDeEstado familia="invitacion" estado={fila.estado} texto={etiquetaEstadoInvitacion(fila.estado)} />,
    },
    {
      clave: "enlacePublico",
      encabezado: t.columnas.enlace,
      render: (fila) =>
        fila.enlacePublico ? (
          <a
            href={enlacePublico(fila.enlacePublico)}
            target="_blank"
            rel="noreferrer"
            className="rounded-ui-control text-sm font-semibold text-ui-link hover:underline"
          >
            {textosAdmin.comun.abrir}
          </a>
        ) : (
          GUION_LARGO
        ),
    },
    {
      clave: "acciones",
      encabezado: t.columnas.acciones,
      alinear: "fin",
      render: (fila) =>
        fila.estado === "deshabilitada" ? (
          <Button
            variant="secundario"
            size="sm"
            loading={filaAlternando === fila.id}
            loadingText={t.confirmacionHabilitar.confirmando}
            onClick={() => alternar(fila)}
          >
            {t.acciones.habilitar}
          </Button>
        ) : (
          <AccionDeFila
            etiqueta={t.acciones.deshabilitar}
            tituloConfirmacion={t.confirmacionDeshabilitar.titulo}
            descripcionConfirmacion={t.confirmacionDeshabilitar.descripcion}
            etiquetaConfirmar={t.acciones.deshabilitar}
            etiquetaCancelar={textosAdmin.comun.cancelar}
            etiquetaConfirmando={t.confirmacionDeshabilitar.confirmando}
            onConfirmar={() => alternar(fila)}
            razonAnchoInsuficiente={t.acciones.deshabilitarDeshabilitadoMovil}
          />
        ),
    },
  ];

  const hayFiltro = buscar !== "" || filtroEstado !== TODOS || filtroPago !== TODOS || filtroPlan !== TODOS;

  return (
    <section aria-labelledby="admin-invitaciones-titulo" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="admin-invitaciones-titulo" className="display-sm text-ui-ink">
          {t.titulo}
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t.filtros.buscar} className="w-full max-w-[16rem]">
            <Input type="search" value={buscarCrudo} onChange={(evento) => setBuscarCrudo(evento.target.value)} />
          </Field>
          <Field label={t.filtros.estado} className="w-36">
            <Select
              opciones={opcionesEstado}
              value={filtroEstado}
              onValueChange={(valor) => setFiltroEstado(valor as EstadoInvitacion | typeof TODOS)}
            />
          </Field>
          {planes.length > 0 ? (
            <Field label={t.filtros.plan} className="w-36">
              <Select opciones={opcionesPlan} value={filtroPlan} onValueChange={setFiltroPlan} />
            </Field>
          ) : null}
          <Field label={t.filtros.pago} className="w-36">
            <Select
              opciones={opcionesPago}
              value={filtroPago}
              onValueChange={(valor) => setFiltroPago(valor as FiltroPagoInvitacion | typeof TODOS)}
            />
          </Field>
        </div>
      </div>

      {filaConError !== null ? (
        <BloqueConError
          titulo={t.alternarError.titulo}
          cuerpo={t.alternarError.cuerpo}
          etiquetaReintentar={t.alternarError.accion}
          onReintentar={() => {
            const fila = filas.find((f) => f.id === filaConError);
            if (fila) alternar(fila);
          }}
        />
      ) : null}

      <Tabla<InvitacionAdmin>
        titulo={t.titulo}
        columnas={columnas}
        filas={filas}
        estado={estado}
        claveFila={(fila) => fila.id}
        etiquetaCargando={textosAdmin.comun.cargando}
        vacio={{
          ilustracion: "sin-invitaciones",
          titulo: textosAdmin.comun.sinResultados,
          texto: hayFiltro ? t.vacio.conFiltro : t.vacio.sinFiltro,
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
