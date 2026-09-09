"use client";

// components/invitados/PantallaInvitados.tsx — orquestador de `/editor/[invitationId]/invitados`
// (wireframe §B3.2): contadores en vivo, búsqueda y filtro contra el backend (la lista está
// paginada, nunca se filtra en cliente), tabla de escritorio / tarjetas de móvil, alta, pegado de
// lista, edición y borrado, exportación. Los tres estados de `ui-pantalla` §7: vacío, carga y error.
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, EmptyState, Field, Input, Select, Skeleton, Toaster, toast } from "@invitaciones/ui";
import { IconoAviso, IconoDescargar } from "@invitaciones/icons";
import { ApiError, SessionError } from "@/lib/api-client";
import {
  exportGuestsCsv,
  getGuestsSummary,
  listGuests,
  type GuestItem,
  type GuestStatus,
  type GuestSummary,
} from "@/lib/invitados/api";
import { textosInvitados as t } from "@/lib/invitados/textos";
import { es_MX } from "@/lib/i18n";
import { Contadores } from "./Contadores";
import { FormularioInvitado } from "./FormularioInvitado";
import { PegarLista } from "./PegarLista";
import { EsqueletoTablaInvitados, TablaInvitados } from "./TablaInvitados";
import { EsqueletoTarjetasInvitados, TarjetasInvitados } from "./TarjetasInvitados";

const TAMANO_PAGINA = 25;
const RETRASO_BUSQUEDA_MS = 300;
/** Alto real del `Input` de búsqueda y del `Select`/`Button` de la fila de filtros (`packages/ui`).
 *  El esqueleto reserva EXACTAMENTE ese hueco para que nada salte al terminar la carga. */
const ALTO_CAMPO_FILTRO = 46;
const ALTO_CONTROL_FILTRO = 44;

type EstadoCarga = "cargando" | "listo" | "error";
type FiltroEstado = GuestStatus | "TODOS";

function mensajeDeError(error: unknown): string {
  if (error instanceof ApiError) return error.message || es_MX.errores.generico;
  if (error instanceof SessionError) return es_MX.errores.sesionInvalida;
  return es_MX.errores.generico;
}

export function PantallaInvitados({ invitationId }: { readonly invitationId: number }) {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<FiltroEstado>("TODOS");
  const [resumen, setResumen] = useState<GuestSummary | null>(null);
  const [invitados, setInvitados] = useState<GuestItem[]>([]);
  const [pagina, setPagina] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [estado, setEstado] = useState<EstadoCarga>("cargando");
  const [errorMensaje, setErrorMensaje] = useState<string | null>(null);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [exportando, setExportando] = useState(false);
  const primerLoteHecho = useRef(false);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  // Número de la última búsqueda pedida. El rebote de 300 ms no evita que dos peticiones convivan:
  // basta con que la de «Ro» tarde más que la de «Rocío» para que la lista termine enseñando los
  // resultados de «Ro» bajo el texto «Rocío». Se atiende SOLO a la última pedida; las que llegan
  // tarde se descartan sin tocar la pantalla.
  const ultimaPeticion = useRef(0);

  const cargarPrimeraPagina = useCallback(async (): Promise<void> => {
    const miPeticion = ultimaPeticion.current + 1;
    ultimaPeticion.current = miPeticion;
    if (!primerLoteHecho.current) setEstado("cargando");
    setErrorMensaje(null);
    try {
      const [resumenNuevo, listaNueva] = await Promise.all([
        getGuestsSummary(invitationId),
        listGuests(invitationId, {
          search: busqueda.trim() || undefined,
          status: filtro === "TODOS" ? undefined : filtro,
          page: 0,
          size: TAMANO_PAGINA,
        }),
      ]);
      if (miPeticion !== ultimaPeticion.current) return;
      primerLoteHecho.current = true;
      setResumen(resumenNuevo);
      setInvitados([...listaNueva.content]);
      setPagina(0);
      setTotalPaginas(listaNueva.totalPages);
      setEstado("listo");
    } catch (error) {
      // Un fallo de una búsqueda ya superada tampoco puede pintar de rojo la pantalla de la búsqueda
      // que sí está en curso.
      if (miPeticion !== ultimaPeticion.current) return;
      setErrorMensaje(mensajeDeError(error));
      setEstado("error");
    }
  }, [invitationId, busqueda, filtro]);

  useEffect(() => {
    const manija = setTimeout(() => void cargarPrimeraPagina(), RETRASO_BUSQUEDA_MS);
    return () => clearTimeout(manija);
  }, [cargarPrimeraPagina]);

  const actualizarResumen = useCallback(async (): Promise<void> => {
    try {
      setResumen(await getGuestsSummary(invitationId));
    } catch {
      // Los contadores se refrescan en el próximo ciclo de carga; un fallo aquí no debe interrumpir
      // lo que la clienta está haciendo (agregar, editar, importar).
    }
  }, [invitationId]);

  async function cargarMas(): Promise<void> {
    const siguiente = pagina + 1;
    if (siguiente >= totalPaginas) return;
    setCargandoMas(true);
    try {
      const listaNueva = await listGuests(invitationId, {
        search: busqueda.trim() || undefined,
        status: filtro === "TODOS" ? undefined : filtro,
        page: siguiente,
        size: TAMANO_PAGINA,
      });
      setInvitados((anteriores) => [...anteriores, ...listaNueva.content]);
      setPagina(siguiente);
    } catch (error) {
      toast({ variante: "error", descripcion: mensajeDeError(error) });
    } finally {
      setCargandoMas(false);
    }
  }

  function alGuardarInvitado(guest: GuestItem): void {
    setInvitados((anteriores) => {
      const existe = anteriores.some((g) => g.id === guest.id);
      return existe ? anteriores.map((g) => (g.id === guest.id ? guest : g)) : [guest, ...anteriores];
    });
    void actualizarResumen();
  }

  function alEliminarInvitado(guestId: number): void {
    setInvitados((anteriores) => anteriores.filter((g) => g.id !== guestId));
    void actualizarResumen();
    // El diálogo de borrado se abre DESDE la fila que se acaba de borrar, así que su disparador
    // desaparece con ella y Radix no tiene a dónde devolver el foco: se cae a `<body>` y quien navega
    // con teclado o lector de pantalla se queda sin contexto. Se lleva al título de la pantalla, que
    // siempre existe. En `setTimeout` porque el `onCloseAutoFocus` de Radix corre al desmontar el
    // contenido, después de este manejador.
    setTimeout(() => tituloRef.current?.focus(), 0);
  }

  function alImportarInvitados(creados: readonly GuestItem[]): void {
    if (creados.length === 0) return;
    setInvitados((anteriores) => [...creados, ...anteriores]);
    void actualizarResumen();
  }

  async function exportar(): Promise<void> {
    setExportando(true);
    try {
      const archivo = await exportGuestsCsv(invitationId);
      const url = URL.createObjectURL(archivo.blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = archivo.filename;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ variante: "error", descripcion: mensajeDeError(error) });
    } finally {
      setExportando(false);
    }
  }

  const opcionesFiltro = [
    { value: "TODOS", label: t.filtros.estadoTodos },
    { value: "CONFIRMED", label: t.filtros.estadoConfirmados },
    { value: "PENDING", label: t.filtros.estadoPendientes },
    { value: "DECLINED", label: t.filtros.estadoNoAsisten },
  ];

  return (
    <main className="mx-auto w-full max-w-ui-page px-5 py-10 sm:px-8">
      <Toaster />
      {/* `tabIndex={-1}`: no entra en el orden de tabulación, pero puede recibir el foco por
          programa cuando el elemento enfocado desaparece (ver `alEliminarInvitado`). */}
      <h1 ref={tituloRef} tabIndex={-1} className="display-md text-ui-ink outline-none">
        {t.titulo}
      </h1>
      <p className="mt-2 text-md text-ui-ink-muted">{t.subtitulo}</p>

      {estado === "cargando" ? (
        <div className="mt-8 grid gap-6">
          <Skeleton variante="bloque" alto={104} etiqueta={t.cargando} />
          {/* La fila de búsqueda, filtro y acciones también ocupa sitio. Sin su hueco, al terminar
              la carga aparecía de golpe y empujaba la tabla hacia abajo: justo el salto de
              maquetación que `ui-pantalla` §7 prohíbe. Mismo contenedor y mismas medidas que la fila
              real (`sm:w-64` / `sm:w-44` / los tres botones), y sin etiqueta propia: el estado de
              carga ya lo anuncia el bloque de contadores de arriba, una vez. */}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Skeleton variante="bloque" alto={ALTO_CAMPO_FILTRO} className="w-full sm:w-64" etiqueta="" />
              <Skeleton variante="bloque" alto={ALTO_CONTROL_FILTRO} className="w-full sm:w-44" etiqueta="" />
            </div>
            <Skeleton variante="bloque" alto={ALTO_CONTROL_FILTRO} className="w-full sm:w-80" etiqueta="" />
          </div>
          <EsqueletoTablaInvitados />
          <EsqueletoTarjetasInvitados />
        </div>
      ) : null}

      {estado === "error" && !resumen ? (
        <div role="alert" className="mt-8 flex flex-col items-start gap-3 rounded-ui-card bg-ui-danger-soft p-6 text-ui-on-danger-soft">
          <p className="flex items-center gap-2 text-md font-semibold">
            <IconoAviso size={20} tone="mono" aria-hidden />
            {t.error.titulo}
          </p>
          <p className="text-sm">{errorMensaje ?? t.error.texto}</p>
          <Button variant="secundario" onClick={() => void cargarPrimeraPagina()}>
            {t.reintentar}
          </Button>
        </div>
      ) : null}

      {resumen ? (
        <div className="mt-8 grid gap-6">
          <Contadores resumen={resumen} />

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Field label={t.filtros.buscarEtiqueta} className="w-full sm:w-64">
                <Input
                  value={busqueda}
                  onChange={(evento) => setBusqueda(evento.target.value)}
                  placeholder={t.filtros.buscarPlaceholder}
                  type="search"
                />
              </Field>
              <Select
                value={filtro}
                onValueChange={(valor) => setFiltro(valor as FiltroEstado)}
                opciones={opcionesFiltro}
                aria-label={t.filtros.estadoEtiqueta}
                className="w-full sm:w-44"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <FormularioInvitado
                invitationId={invitationId}
                rules={resumen.rules}
                onGuardado={alGuardarInvitado}
                trigger={<Button variant="primario">{t.acciones.agregarInvitado}</Button>}
              />
              <PegarLista invitationId={invitationId} onImportados={alImportarInvitados} />
              <Button variant="terciario" loading={exportando} loadingText={t.acciones.exportando} onClick={() => void exportar()}>
                <IconoDescargar size={18} tone="mono" aria-hidden />
                {t.acciones.exportar}
              </Button>
            </div>
          </div>

          {estado === "error" ? (
            <div role="alert" className="flex flex-col items-start gap-3 rounded-ui-card bg-ui-danger-soft p-4 text-ui-on-danger-soft">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <IconoAviso size={18} tone="mono" aria-hidden />
                {errorMensaje ?? t.error.texto}
              </p>
              <Button variant="secundario" size="sm" onClick={() => void cargarPrimeraPagina()}>
                {t.reintentar}
              </Button>
            </div>
          ) : null}

          {invitados.length === 0 ? (
            <div className="rounded-ui-card bg-ui-surface-raised p-10 shadow-ui-1">
              <EmptyState ilustracion="sin-invitaciones" titulo={t.vacio.titulo} texto={t.vacio.texto} />
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <FormularioInvitado
                  invitationId={invitationId}
                  rules={resumen.rules}
                  onGuardado={alGuardarInvitado}
                  trigger={<Button variant="primario">{t.acciones.agregarInvitado}</Button>}
                />
                <PegarLista invitationId={invitationId} onImportados={alImportarInvitados} />
              </div>
            </div>
          ) : (
            <>
              <TablaInvitados
                invitationId={invitationId}
                rules={resumen.rules}
                invitados={invitados}
                onCambiado={alGuardarInvitado}
                onEliminado={alEliminarInvitado}
              />
              <TarjetasInvitados
                invitationId={invitationId}
                rules={resumen.rules}
                invitados={invitados}
                onCambiado={alGuardarInvitado}
                onEliminado={alEliminarInvitado}
              />
              {pagina + 1 < totalPaginas ? (
                <Button variant="secundario" className="justify-self-center" loading={cargandoMas} onClick={() => void cargarMas()}>
                  {t.acciones.verMas}
                </Button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </main>
  );
}
