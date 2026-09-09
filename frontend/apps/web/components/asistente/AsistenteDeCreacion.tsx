"use client";

// components/asistente/AsistenteDeCreacion.tsx — el asistente de creación de `/editor` (`11 §7`,
// fila «Asistente de creación»): cuatro pasos, un objetivo por pantalla y progreso visible.
//
//   1. ¿Qué vamos a celebrar?   → tipo de evento (preseleccionado desde `?tipo=` o desde el tipo
//                                 con el que la invitación quedó registrada al contratarla)
//   2. Elige el punto de partida → catálogo FILTRADO POR `eventKind` (cierra UX-N-02)
//   3. Los datos básicos         → nombres, fecha y lugar; todos opcionales
//   4. Listo                     → «Abrir mi invitación»
//
// El estado que importa vive en la URL (`?paso`, `?tipo`, `?inv`, `?plantilla`): así el botón
// «atrás» del navegador, un enlace compartido y una recarga a media faena llevan al mismo sitio, y
// los círculos ya hechos del progreso pueden ser enlaces de verdad.
//
// Lo que este asistente NO hace: crear invitaciones. En este producto una invitación nace de una
// compra (ADR-2-4-02) y ninguna de las rutas de `03-api.md` la crea; el asistente aplica la
// plantilla a una invitación que ya existe. Sin ninguna disponible, el paso 1 lo explica y lleva a
// los planes en vez de pintar un botón que no puede funcionar.
import type { EventKind } from "@invitaciones/schema";
import { Button, Select, WizardProgress, type PasoAsistente } from "@invitaciones/ui";
import { IconoAtras } from "@invitaciones/icons";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  SessionError,
  chooseTemplate,
  crearInvitacion,
  eliminarInvitacion,
  getAuthToken,
  getCatalog,
  getDocument,
  postOperations,
  setEvent,
} from "@/lib/api-client";
import type { CatalogItem } from "@/lib/api-types";
import { es_MX } from "@/lib/i18n";
import { traducirErrorAlta, traducirErrorBorrado } from "./crear-invitacion.ts";
import { MisInvitaciones } from "./MisInvitaciones.tsx";
import { PasoCrearInvitacion } from "./PasoCrearInvitacion.tsx";
import { PasoDatos } from "./PasoDatos.tsx";
import { PasoListo } from "./PasoListo.tsx";
import { PasoPlantilla } from "./PasoPlantilla.tsx";
import { PasoTipoEvento } from "./PasoTipoEvento.tsx";
import { SIN_FILTROS, conteoPorTipo, type FiltrosDePlantilla } from "./catalogo.ts";
import {
  camposDeDatosBasicos,
  esFechaIso,
  esHoraIso,
  operacionesDeDatos,
  valoresIniciales,
  type CampoDeDatos,
  type ValoresDeDatos,
} from "./datos-basicos.ts";
import { cargarInvitaciones, filaDe, invitacionObjetivo, sinPlantilla, type FilaInvitacion } from "./invitaciones.ts";
import { eventKindDeParametro, nombreDeTipo, slugDeTipo } from "./tipos-de-evento.ts";

const PASOS = ["evento", "plantilla", "datos", "listo"] as const;
export type PasoDelAsistente = (typeof PASOS)[number];

const ID_TITULO = "asistente-titulo";
const ID_MIS_INVITACIONES = "asistente-mis-invitaciones";
const ID_TITULO_CREAR = "asistente-crear-titulo";
const DESTINO_ACCESO = `/acceso?volver=${encodeURIComponent("/editor")}`;

function esPaso(valor: string | null): valor is PasoDelAsistente {
  return valor !== null && (PASOS as readonly string[]).includes(valor);
}

/**
 * Nombre de marca de la plantilla («XV Jardín»), no su `slug` («xv-jardin»). Si el catálogo todavía
 * no está cargado se devuelve el `slug`, que es mejor que un hueco.
 */
function nombreDePlantilla(slug: string | null, catalogo: readonly CatalogItem[] | null): string {
  if (slug === null) return "";
  return catalogo?.find((item) => item.slug === slug)?.name["es-MX"] ?? slug;
}

/** `clientBatchId` del lote del paso 3 (`^[A-Za-z0-9_-]{8,64}$`). */
function idDeLote(): string {
  return `asistente-${Date.now().toString(36)}`;
}

interface DocumentoEnCurso {
  readonly revision: number;
  readonly campos: readonly CampoDeDatos[];
}

export function AsistenteDeCreacion() {
  const router = useRouter();
  const parametros = useSearchParams();

  const paso: PasoDelAsistente = esPaso(parametros.get("paso")) ? (parametros.get("paso") as PasoDelAsistente) : "evento";
  // 3C-UX G-02, punto 3: la portada enlaza `/editor?tipo=xv-anos` (slug en español) y el asistente
  // solo aceptaba los ocho `EventKind` crudos, así que descartaba el parámetro SIEMPRE, viniera de
  // donde viniera. `eventKindDeParametro` acepta las dos formas.
  const tipoEnUrl = eventKindDeParametro(parametros.get("tipo"));
  const invEnUrl = Number(parametros.get("inv"));
  const plantillaEnUrl = parametros.get("plantilla");

  const [sesion, setSesion] = useState<"desconocida" | "sin" | "con">("desconocida");
  const [invitaciones, setInvitaciones] = useState<readonly FilaInvitacion[] | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [catalogoCompleto, setCatalogoCompleto] = useState<readonly CatalogItem[] | null>(null);
  const [catalogoDelTipo, setCatalogoDelTipo] = useState<readonly CatalogItem[] | null>(null);
  const [tipoElegido, setTipoElegido] = useState<EventKind | null>(tipoEnUrl);
  const [filtros, setFiltros] = useState<FiltrosDePlantilla>(SIN_FILTROS);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [errorEleccion, setErrorEleccion] = useState<string | null>(null);
  const [documento, setDocumento] = useState<DocumentoEnCurso | null>(null);
  const [valores, setValores] = useState<ValoresDeDatos>({});
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [errorFecha, setErrorFecha] = useState<string | null>(null);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // ── Alta desde el asistente (fase 5, E3; cierre de G-01) ───────────────────────────────────
  // Sin invitación disponible a la que aplicarle una plantilla, esto YA NO es un callejón sin
  // salida: `crearInvitacion` es el alta real, `POST /product/invitations` (§1 del contrato).
  const [fechaCrear, setFechaCrear] = useState("");
  const [horaCrear, setHoraCrear] = useState("");
  const [hashtagCrear, setHashtagCrear] = useState("");
  const [creando, setCreando] = useState(false);
  const [errorCrear, setErrorCrear] = useState<string | null>(null);
  // Borrado (§1 bis): la salida real del tope de 3 borradores (`409 PRD_DRAFT_LIMIT_REACHED`).
  const [borrandoId, setBorrandoId] = useState<number | null>(null);
  const [errorBorrado, setErrorBorrado] = useState<string | null>(null);

  const titulo = useRef<HTMLHeadingElement>(null);

  // ── Sesión ────────────────────────────────────────────────────────────────────────────────
  // `04 §7.1` paso 1: «401 → redirección a login». Sin token no hay catálogo ni invitaciones que
  // enseñar, así que el asistente no finge una pantalla que no se puede usar: lleva a `/acceso` con
  // el retorno puesto y deja mientras tanto un aviso con salida propia (por si la navegación tarda).
  useEffect(() => {
    if (getAuthToken() === null) {
      setSesion("sin");
      router.replace(DESTINO_ACCESO);
      return;
    }
    setSesion("con");
  }, [router]);

  // ── Invitaciones y catálogo completo (para el conteo por tipo del paso 1) ──────────────────
  useEffect(() => {
    if (sesion !== "con") return;
    let cancelado = false;
    void (async () => {
      try {
        const filas = await cargarInvitaciones();
        if (!cancelado) setInvitaciones(filas);
      } catch (error: unknown) {
        if (cancelado) return;
        if (error instanceof SessionError) {
          setSesion("sin");
          router.replace(DESTINO_ACCESO);
          return;
        }
        setInvitaciones([]);
        setErrorCarga(es_MX.editor.catalogo.errorInvitaciones);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [sesion, router]);

  const cargarCatalogoCompleto = useCallback(() => {
    setErrorCarga(null);
    getCatalog()
      .then((datos) => setCatalogoCompleto(datos.items))
      .catch((error: unknown) => {
        if (error instanceof SessionError) {
          setSesion("sin");
          router.replace(DESTINO_ACCESO);
          return;
        }
        setCatalogoCompleto([]);
        setErrorCarga(es_MX.editor.catalogo.errorCatalogo);
      });
  }, [router]);

  useEffect(() => {
    if (sesion !== "con") return;
    cargarCatalogoCompleto();
  }, [sesion, cargarCatalogoCompleto]);

  // ── Invitación objetivo y tipo preseleccionado ────────────────────────────────────────────
  const objetivo = useMemo(
    () =>
      invitaciones === null
        ? null
        : invitacionObjetivo(
            invitaciones,
            Number.isFinite(invEnUrl) && invEnUrl > 0 ? invEnUrl : null,
            // Con `?plantilla=` en la URL, la invitación ya la empezó ESTE asistente: sigue siendo
            // la suya aunque ya no esté «sin plantilla».
            plantillaEnUrl !== null,
            tipoEnUrl,
          ),
    [invitaciones, invEnUrl, plantillaEnUrl, tipoEnUrl],
  );
  const disponibles = useMemo(() => (invitaciones === null ? [] : sinPlantilla(invitaciones)), [invitaciones]);

  useEffect(() => {
    if (tipoElegido !== null || objetivo === null) return;
    setTipoElegido(objetivo.eventKind);
  }, [tipoElegido, objetivo]);

  // ── Catálogo del tipo elegido — AQUÍ se manda `eventKind` (cierre de UX-N-02) ──────────────
  const cargarCatalogoDelTipo = useCallback(
    (kind: EventKind) => {
      setCatalogoDelTipo(null);
      // El aviso de la elección NO se borra aquí: `TPL_TEMPLATE_VERSION_NOT_FOUND` recarga el
      // catálogo Y enseña el motivo (`04 §7.1` paso 2); borrarlo dejaría la lista cambiando sola,
      // sin decir por qué. Se limpia al cambiar de tipo y al volver a intentar elegir.
      getCatalog({ eventKind: kind })
        .then((datos) => setCatalogoDelTipo(datos.items))
        .catch((error: unknown) => {
          if (error instanceof SessionError) {
            setSesion("sin");
            router.replace(DESTINO_ACCESO);
            return;
          }
          setCatalogoDelTipo([]);
          setErrorCarga(es_MX.editor.catalogo.errorCatalogo);
        });
    },
    [router],
  );

  // El catálogo de un tipo se pide UNA vez por tipo. El centinela no es adorno: si la identidad de
  // `router` cambiara entre renders, `cargarCatalogoDelTipo` cambiaría con ella y este efecto se
  // repetiría sin fin, pidiendo el catálogo en bucle (medido en las pruebas de este componente con
  // una simulación de `useRouter` que devolvía un objeto nuevo por render).
  const tipoCargado = useRef<EventKind | null>(null);
  useEffect(() => {
    if (paso !== "plantilla" || tipoElegido === null) return;
    if (tipoCargado.current === tipoElegido) return;
    tipoCargado.current = tipoElegido;
    setErrorEleccion(null);
    cargarCatalogoDelTipo(tipoElegido);
  }, [paso, tipoElegido, cargarCatalogoDelTipo]);

  // ── Rehidratación de los pasos 3 y 4 tras una recarga ──────────────────────────────────────
  useEffect(() => {
    if (paso !== "datos" && paso !== "listo") return;
    if (documento !== null || !Number.isFinite(invEnUrl) || invEnUrl <= 0) return;
    let cancelado = false;
    void (async () => {
      try {
        const doc = await getDocument(invEnUrl);
        if (cancelado) return;
        const campos = camposDeDatosBasicos(doc.composed);
        setDocumento({ revision: doc.revision, campos });
        setValores(valoresIniciales(campos));
      } catch {
        // Sin documento no hay paso 3 que rellenar: se vuelve al principio del asistente.
        if (!cancelado) router.replace("/editor");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [paso, documento, invEnUrl, router]);

  // Fecha y hora de partida: las que ya tiene la invitación (`invitation.date`/`time`). Se copian
  // UNA vez, y nunca encima de lo que la clienta esté escribiendo.
  const fechaInicializada = useRef(false);
  useEffect(() => {
    if (fechaInicializada.current || objetivo === null) return;
    fechaInicializada.current = true;
    setFecha(objetivo.date ?? "");
    setHora(objetivo.time ?? "");
  }, [objetivo]);

  // ── Foco al título en cada CAMBIO de paso (`11 §7`: teclado y progreso visibles) ───────────
  // No en el primer render: al aterrizar en la pantalla el foco se queda donde el navegador lo
  // pone (el principio del documento), que es lo que espera quien acaba de llegar; robarlo solo
  // tiene sentido cuando la pantalla cambia bajo los pies.
  const pasoAnterior = useRef<PasoDelAsistente | null>(null);
  useEffect(() => {
    if (pasoAnterior.current !== null && pasoAnterior.current !== paso) titulo.current?.focus();
    pasoAnterior.current = paso;
  }, [paso]);

  function irA(siguiente: PasoDelAsistente, extra: Readonly<Record<string, string>> = {}): void {
    const query = new URLSearchParams();
    query.set("paso", siguiente);
    if (tipoElegido) query.set("tipo", slugDeTipo(tipoElegido));
    if (objetivo) query.set("inv", String(objetivo.id));
    if (plantillaEnUrl) query.set("plantilla", plantillaEnUrl);
    for (const [clave, valor] of Object.entries(extra)) query.set(clave, valor);
    router.push(`/editor?${query.toString()}`);
  }

  function elegirPlantilla(item: CatalogItem): void {
    if (objetivo === null) return;
    setOcupada(item.slug);
    setErrorEleccion(null);
    // `baseRevision` es obligatoria si el documento YA existe (`03 §3.2`): es el caso de quien
    // vuelve al paso 2 desde el 3 para cambiar de idea, incluso tras recargar la página (y
    // entonces la revisión no está en memoria: se pregunta).
    void revisionBase(objetivo.id, documento?.revision ?? null, plantillaEnUrl !== null)
      .then((base) =>
        chooseTemplate(objetivo.id, {
          templateSlug: item.slug,
          templateVersion: item.version,
          ...(base === null ? {} : { baseRevision: base }),
        }),
      )
      .then((respuesta) => {
        const campos = camposDeDatosBasicos(respuesta.composed);
        setDocumento({ revision: respuesta.revision, campos });
        setValores(valoresIniciales(campos));
        setFecha(objetivo.date ?? "");
        setHora(objetivo.time ?? "");
        setOcupada(null);
        irA("datos", { plantilla: item.slug });
      })
      .catch((error: unknown) => {
        const codigo = error instanceof ApiError ? error.code : undefined;
        if (codigo === "TPL_PLAN_TIER_INSUFFICIENT") {
          setErrorEleccion(es_MX.asistente.plantilla.errorPlanTier(item.name["es-MX"]));
        } else if (codigo === "TPL_TEMPLATE_VERSION_NOT_FOUND") {
          setErrorEleccion(es_MX.asistente.plantilla.errorNoDisponible);
          if (tipoElegido) cargarCatalogoDelTipo(tipoElegido); // §7.1 paso 2: «se recarga el catálogo»
          // (llamada directa, no por el efecto: el centinela de arriba ya tiene este tipo marcado)
        } else if (codigo === "TPL_MIGRATION_PLAN_MISSING") {
          setErrorEleccion(es_MX.asistente.plantilla.errorMigracion);
        } else if (error instanceof SessionError) {
          setSesion("sin");
          router.replace(DESTINO_ACCESO);
        } else if (error instanceof TypeError) {
          setErrorEleccion(es_MX.errores.sinRed);
        } else {
          setErrorEleccion(error instanceof Error ? error.message : es_MX.errores.generico);
        }
        setOcupada(null);
      });
  }

  async function guardarDatos(): Promise<void> {
    if (objetivo === null || documento === null) {
      irA("listo");
      return;
    }
    if (fecha !== "" && !esFechaIso(fecha)) {
      setErrorFecha(es_MX.asistente.datos.fechaInvalida);
      return;
    }
    setErrorFecha(null);
    setErrorGuardado(null);
    setGuardando(true);
    try {
      const operaciones = operacionesDeDatos(documento.campos, valores);
      if (operaciones.length > 0) {
        const respuesta = await postOperations(objetivo.id, {
          baseRevision: documento.revision,
          clientBatchId: idDeLote(),
          operations: [...operaciones],
        });
        setDocumento({ ...documento, revision: respuesta.revision });
      }
      if (fecha !== "" && (fecha !== (objetivo.date ?? "") || hora !== (objetivo.time ?? ""))) {
        await setEvent(objetivo.id, { date: fecha, ...(esHoraIso(hora) ? { time: hora } : {}) });
      }
      setGuardando(false);
      irA("listo");
    } catch (error: unknown) {
      setGuardando(false);
      if (error instanceof SessionError) {
        setSesion("sin");
        router.replace(DESTINO_ACCESO);
        return;
      }
      setErrorGuardado(
        error instanceof TypeError ? es_MX.asistente.datos.errorGuardarSinRed : es_MX.asistente.datos.errorGuardar,
      );
    }
  }

  /** El botón que lleva aquí solo hace `focus`: la sección ya está en pantalla, no hace falta scroll. */
  function irAlFormularioDeAlta(): void {
    document.getElementById(ID_TITULO_CREAR)?.focus();
  }

  /**
   * `POST /product/invitations` (contrato §1-§3). El botón que llama a esto se deshabilita
   * mientras `creando` es `true` — esa deshabilitación, y NO un reintento automático, es lo que
   * cumple «doble clic» (contrato §3: sin idempotencia por clave de cliente detrás de la ventana
   * de 60 s, así que dos envíos con datos distintos son dos invitaciones legítimas).
   */
  async function crearNuevaInvitacion(): Promise<void> {
    if (creando) return;
    if (tipoElegido === null) {
      setErrorCrear(es_MX.asistente.crear.errorFaltaTipo);
      return;
    }
    if (!esFechaIso(fechaCrear)) {
      setErrorCrear(es_MX.asistente.crear.errorFechaFalta);
      return;
    }
    if (!esHoraIso(horaCrear)) {
      setErrorCrear(es_MX.asistente.crear.errorHoraFalta);
      return;
    }
    setErrorCrear(null);
    setCreando(true);
    try {
      const creada = await crearInvitacion({
        eventKind: tipoElegido,
        eventDate: fechaCrear,
        eventTime: horaCrear,
        ...(hashtagCrear.trim() ? { hashtag: hashtagCrear.trim() } : {}),
      });
      // Misma forma que produce `cargarInvitaciones()`: se reusa `filaDe` en vez de armar la fila
      // a mano, así que el estado ("sin-plantilla") sale de la MISMA fuente que el resto de la
      // lista y no de una suposición local.
      const fila = await filaDe({
        id: creada.invitationId,
        status: "",
        event: nombreDeTipo(tipoElegido),
        plan: "",
        date: creada.eventDate,
        time: creada.eventTime,
      });
      setInvitaciones((previas) => [...(previas ?? []), fila]);
      setCreando(false);
      // ADR-5-E3-B3-01 (`decisiones.md`): la ruta de alta NO aplica plantilla (contrato §5); el
      // paso 2, con esta URL, es la llamada YA EXISTENTE a `:choose-template` — si esa segunda
      // llamada falla, la invitación recién creada queda como un borrador más en «Mis
      // invitaciones» (con estado real, nunca huérfana en silencio: `errorEleccion` del paso 2 ya
      // avisa y deja reintentar sobre la MISMA invitación).
      irA("plantilla", { inv: String(creada.invitationId) });
    } catch (error: unknown) {
      setCreando(false);
      if (error instanceof SessionError) {
        setSesion("sin");
        router.replace(DESTINO_ACCESO);
        return;
      }
      setErrorCrear(traducirErrorAlta(error).mensaje);
    }
  }

  /**
   * `DELETE /product/invitations/{id}` (contrato §1 bis, §4). Es la salida real del tope de 3
   * borradores: el `409 PRD_DRAFT_LIMIT_REACHED` dice «publica una o elimina la que no vayas a
   * usar», y ahora «eliminar» es un botón de verdad en cada fila de «Mis invitaciones».
   */
  async function borrarInvitacionDesdeLista(id: number): Promise<void> {
    if (borrandoId !== null) return; // §3, mismo criterio que el alta: un borrado a la vez
    setErrorBorrado(null);
    setBorrandoId(id);
    try {
      await eliminarInvitacion(id);
      setInvitaciones((previas) => (previas ?? []).filter((f) => f.id !== id));
    } catch (error: unknown) {
      if (error instanceof SessionError) {
        setSesion("sin");
        router.replace(DESTINO_ACCESO);
        return;
      }
      setErrorBorrado(traducirErrorBorrado(error));
    } finally {
      setBorrandoId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────────────────
  if (sesion === "desconocida") {
    return (
      <main className="mx-auto w-full max-w-ui-page px-6 py-10">
        <p role="status" className="text-md text-ui-ink-muted">
          {es_MX.asistente.cargando}
        </p>
      </main>
    );
  }

  if (sesion === "sin") {
    return (
      <main className="mx-auto flex w-full max-w-ui-page flex-col gap-4 px-6 py-10">
        <h1 className="display-sm text-ui-ink">{es_MX.asistente.sesion.titulo}</h1>
        <p className="text-md text-ui-ink-muted">{es_MX.asistente.sesion.texto}</p>
        <div>
          <Button asChild>
            <Link href={DESTINO_ACCESO}>{es_MX.comun.iniciarSesion}</Link>
          </Button>
        </div>
      </main>
    );
  }

  const pasosProgreso: readonly PasoAsistente[] = PASOS.map((id, indice) => {
    const actual = PASOS.indexOf(paso);
    return {
      id,
      etiqueta: es_MX.asistente.pasos[id],
      estado: indice < actual ? "hecho" : indice === actual ? "actual" : "pendiente",
      ...(indice < actual ? { href: hrefDePaso(id, tipoElegido, objetivo?.id ?? null, plantillaEnUrl) } : {}),
    };
  });

  const hayObjetivo = objetivo !== null;
  const cargandoInvitaciones = invitaciones === null;

  // 3C-UX G-02. Sin ninguna invitación a la que aplicarle una plantilla, el asistente no tiene nada
  // que preguntar: preguntarlo igual («¿Qué vamos a celebrar?» con la rejilla escondida y
  // «Continuar» inhabilitado para siempre) es el muro que encontró el recorrido. La pantalla deja
  // entonces de fingir que es el paso 1: dice en una frase por qué y enseña «Mis invitaciones»,
  // que es la salida real —cada una con su estado y, si está publicada, su enlace—.
  const sinSalidaDeAsistente = !cargandoInvitaciones && !hayObjetivo;
  const cuantasInvitaciones = invitaciones?.length ?? 0;

  const tituloDelPaso = sinSalidaDeAsistente
    ? cuantasInvitaciones === 0
      ? es_MX.asistente.sinInvitaciones.tituloDePagina
      : cuantasInvitaciones === 1
        ? es_MX.asistente.sinLibres.tituloUna
        : es_MX.asistente.sinLibres.titulo
    : {
        evento: es_MX.asistente.evento.titulo,
        plantilla: es_MX.asistente.plantilla.titulo,
        datos: es_MX.asistente.datos.titulo,
        listo: es_MX.asistente.listo.titulo,
      }[paso];

  const ayudaDelPaso = sinSalidaDeAsistente
    ? cuantasInvitaciones === 0
      ? "" // el estado vacío ya lleva su propio texto y su acción: repetirlo sería ruido
      : cuantasInvitaciones === 1
        ? es_MX.asistente.sinLibres.textoUna
        : es_MX.asistente.sinLibres.texto
    : {
        evento: es_MX.asistente.evento.ayuda,
        plantilla: tipoElegido ? es_MX.asistente.plantilla.ayuda(nombreDeTipo(tipoElegido)) : "",
        datos: es_MX.asistente.datos.ayuda,
        listo: "",
      }[paso];

  return (
    <main className="mx-auto flex w-full max-w-ui-page flex-col gap-8 px-6 pb-32 pt-8">
      {sinSalidaDeAsistente ? null : <WizardProgress pasos={pasosProgreso} className="max-w-md" />}

      <header className="flex flex-col gap-2">
        <h1 ref={titulo} tabIndex={-1} id={ID_TITULO} className="display-sm text-ui-ink outline-none">
          {tituloDelPaso}
        </h1>
        {ayudaDelPaso ? <p className="text-md text-ui-ink-muted">{ayudaDelPaso}</p> : null}
      </header>

      {errorCarga ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-ui-control bg-ui-danger-soft px-4 py-3 text-sm text-ui-on-danger-soft">
          <span>{errorCarga}</span>
          <Button variant="secundario" size="sm" onClick={cargarCatalogoCompleto}>
            {es_MX.comun.reintentar}
          </Button>
        </div>
      ) : null}

      {errorBorrado ? (
        <p role="alert" className="rounded-ui-control bg-ui-danger-soft px-4 py-3 text-sm text-ui-on-danger-soft">
          {errorBorrado}
        </p>
      ) : null}

      {sinSalidaDeAsistente ? (
        <>
          <MisInvitaciones
            invitaciones={invitaciones}
            idTitulo={ID_MIS_INVITACIONES}
            alEmpezar={cuantasInvitaciones === 0 ? irAlFormularioDeAlta : undefined}
            onBorrar={(id) => void borrarInvitacionDesdeLista(id)}
            borrandoId={borrandoId}
          />
          {/* Cierre de G-01: sin NINGUNA invitación, esto YA NO es un callejón sin salida — es la
              puerta al alta real (`POST /product/invitations`, contrato §1). Se limita a este caso
              (no al de «todas con plantilla», `e2e/asistente.spec.ts` de otra sesión ya prueba esa
              pantalla sin control alguno) — `MisInvitaciones` de arriba SÍ ofrece «Eliminar» en los
              dos casos: es la salida real del tope de 3 borradores (contrato §4) sin depender de
              que este formulario esté a la vista. */}
          {cuantasInvitaciones === 0 ? (
            <PasoCrearInvitacion
              idTitulo={ID_TITULO_CREAR}
              tipoElegido={tipoElegido}
              alSeleccionarTipo={setTipoElegido}
              conteo={conteoPorTipo(catalogoCompleto ?? [])}
              fecha={fechaCrear}
              hora={horaCrear}
              hashtag={hashtagCrear}
              alCambiarFecha={setFechaCrear}
              alCambiarHora={setHoraCrear}
              alCambiarHashtag={setHashtagCrear}
              enviando={creando}
              error={errorCrear}
              alEnviar={() => void crearNuevaInvitacion()}
            />
          ) : null}
        </>
      ) : null}

      {paso === "evento" && !sinSalidaDeAsistente ? (
        <div className="flex flex-col gap-8">
          {cargandoInvitaciones ? (
            <p role="status" className="text-md text-ui-ink-muted">
              {es_MX.asistente.cargando}
            </p>
          ) : null}

          {disponibles.length > 1 && objetivo ? (
            <div className="max-w-sm">
              <label htmlFor="asistente-invitacion" className="mb-1.5 block text-sm font-semibold text-ui-ink">
                {es_MX.asistente.evento.paraCual}
              </label>
              <Select
                id="asistente-invitacion"
                value={String(objetivo.id)}
                onValueChange={(valor) => router.replace(hrefDePaso("evento", tipoElegido, Number(valor), null))}
                opciones={disponibles.map((inv) => ({
                  value: String(inv.id),
                  label: `${inv.event} · ${es_MX.editor.catalogo.numero(inv.id)}`,
                }))}
              />
              <p className="mt-1.5 text-sm text-ui-ink-muted">{es_MX.asistente.evento.paraCualAyuda}</p>
            </div>
          ) : null}

          {hayObjetivo ? (
            <>
              <PasoTipoEvento
                seleccionado={tipoElegido}
                alSeleccionar={setTipoElegido}
                conteo={conteoPorTipo(catalogoCompleto ?? [])}
                tipoDeLaInvitacion={objetivo?.eventKind ?? null}
                idTitulo={ID_TITULO}
              />
              {tipoElegido && objetivo && tipoElegido !== objetivo.eventKind ? (
                <p role="status" className="max-w-prose rounded-ui-control bg-ui-info-soft px-4 py-3 text-sm text-ui-on-info-soft">
                  {es_MX.asistente.evento.distintoDelRegistrado(nombreDeTipo(objetivo.eventKind))}
                </p>
              ) : null}
            </>
          ) : null}

          {/* «Mis invitaciones» va DEBAJO de la rejilla (deuda anotada en `handoffs/3c-6-parcial.md`
              §3.5): a 390 px la lista empujaba el objetivo del paso —elegir el tipo— bajo el
              pliegue, así que la pantalla que pregunta enseñaba primero otra cosa. Sigue en el
              paso 1, que es donde la clienta comprueba a cuál se le va a aplicar la plantilla. */}
          {cargandoInvitaciones ? null : (
            <MisInvitaciones
              invitaciones={invitaciones}
              idTitulo={ID_MIS_INVITACIONES}
              onBorrar={(id) => void borrarInvitacionDesdeLista(id)}
              borrandoId={borrandoId}
            />
          )}
        </div>
      ) : null}

      {paso === "plantilla" && (cargandoInvitaciones || hayObjetivo) ? (
        <div className="flex flex-col gap-6">
          {errorEleccion ? (
            <p role="alert" className="max-w-prose rounded-ui-control bg-ui-danger-soft px-4 py-3 text-sm text-ui-on-danger-soft">
              {errorEleccion}
            </p>
          ) : null}
          <PasoPlantilla
            // Hasta saber a QUÉ invitación se le aplica, la rejilla sigue en esqueleto: un botón
            // que se puede pulsar y no hace nada es exactamente el defecto U-2 que la fase 3-B
            // corrigió, y volvería por la puerta de atrás si la lista tardara más que el catálogo.
            items={cargandoInvitaciones ? null : catalogoDelTipo}
            plan={objetivo?.nivel ?? 1}
            filtros={filtros}
            alCambiarFiltros={setFiltros}
            alElegir={elegirPlantilla}
            ocupada={ocupada}
            elegida={plantillaEnUrl}
            alElegirOtroTipo={() => irA("evento")}
          />
        </div>
      ) : null}

      {paso === "datos" ? (
        <PasoDatos
          campos={documento?.campos ?? []}
          valores={valores}
          alCambiarValor={(id, valor) => setValores((previos) => ({ ...previos, [id]: valor }))}
          fecha={fecha}
          hora={hora}
          alCambiarFecha={setFecha}
          alCambiarHora={setHora}
          errorFecha={errorFecha}
          errorGuardado={errorGuardado}
        />
      ) : null}

      {paso === "listo" && objetivo ? (
        <PasoListo
          invitationId={objetivo.id}
          nombreDelTipo={tipoElegido ? nombreDeTipo(tipoElegido) : nombreDeTipo(objetivo.eventKind)}
          // 3C-UX F-08: el paso 4 mostraba el `slug` de la URL («plantilla «xv-jardin»»), que a la
          // clienta le parece un nombre de archivo. El catálogo ya trae el nombre de marca.
          nombreDeLaPlantilla={nombreDePlantilla(plantillaEnUrl, catalogoDelTipo ?? catalogoCompleto)}
        />
      ) : null}

      {paso === "listo" || sinSalidaDeAsistente ? null : (
        <nav
          aria-label={es_MX.asistente.navegacion}
          className="fixed inset-x-0 bottom-0 z-10 border-t border-ui-divider bg-ui-surface px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          {/* `flex-wrap`: a 390 px la fila del paso 3 son TRES botones («Atrás», «Lo lleno después»,
              «Continuar») y sumados no caben en 342 px de contenido, así que la barra desbordaba a
              lo ancho y «Continuar» se salía de la pantalla — el mismo defecto que M-07 corrigió en
              el paso 1. Envolviendo, la barra crece hacia arriba y todo queda tocable. */}
          <div className="mx-auto flex w-full max-w-ui-page flex-wrap items-center justify-between gap-2">
            {paso === "evento" ? (
              <span />
            ) : (
              <Button variant="secundario" onClick={() => irA(PASOS[Math.max(0, PASOS.indexOf(paso) - 1)])}>
                <IconoAtras size={18} />
                {es_MX.asistente.atras}
              </Button>
            )}
            {paso === "evento" ? (
              <Button
                disabled={!hayObjetivo || tipoElegido === null}
                data-testid="asistente-continuar"
                onClick={() => irA("plantilla")}
              >
                {tipoElegido ? es_MX.asistente.continuarCon(nombreDeTipo(tipoElegido)) : es_MX.asistente.continuar}
              </Button>
            ) : null}
            {paso === "datos" ? (
              <span className="flex items-center gap-2">
                {/* 3C-UX G-03: tras un fallo de guardado el aviso prometía «Puedes continuar» y no
                    había ningún botón que continuara. Ahora salen los dos que promete el texto:
                    seguir sin guardar (los datos se escriben en el editor) o volver a intentarlo. */}
                <Button
                  variant="terciario"
                  onClick={() => irA("listo")}
                  data-testid={errorGuardado ? "asistente-seguir-sin-guardar" : "asistente-omitir"}
                >
                  {errorGuardado ? es_MX.asistente.datos.seguirSinGuardar : es_MX.asistente.datos.omitir}
                </Button>
                <Button
                  loading={guardando}
                  loadingText={es_MX.asistente.datos.guardando}
                  data-testid="asistente-continuar"
                  onClick={() => void guardarDatos()}
                >
                  {errorGuardado ? es_MX.asistente.datos.reintentar : es_MX.asistente.continuar}
                </Button>
              </span>
            ) : null}
          </div>
        </nav>
      )}
    </main>
  );
}

/**
 * Revisión sobre la que aplicar `:choose-template`. `null` cuando el documento todavía no existe
 * (primera creación, donde la ruta EXIGE que no se mande). Si el documento existe pero su revisión
 * no está en memoria —una recarga en mitad del asistente—, se pregunta al servidor.
 */
async function revisionBase(
  invitationId: number,
  enMemoria: number | null,
  yaHabiaPlantilla: boolean,
): Promise<number | null> {
  if (enMemoria !== null) return enMemoria;
  if (!yaHabiaPlantilla) return null;
  try {
    return (await getDocument(invitationId)).revision;
  } catch {
    // `404 TPL_DOCUMENT_NOT_STARTED`: el `?plantilla=` de la URL mentía; es una creación normal.
    return null;
  }
}

/** URL de un paso concreto, para los círculos ya hechos del progreso y para el selector. */
function hrefDePaso(
  paso: PasoDelAsistente,
  tipo: EventKind | null,
  invitationId: number | null,
  plantilla: string | null,
): string {
  const query = new URLSearchParams();
  query.set("paso", paso);
  if (tipo) query.set("tipo", slugDeTipo(tipo));
  if (invitationId) query.set("inv", String(invitationId));
  if (plantilla) query.set("plantilla", plantilla);
  return `/editor?${query.toString()}`;
}
