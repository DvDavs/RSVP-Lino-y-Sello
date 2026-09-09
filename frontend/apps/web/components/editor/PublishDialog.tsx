"use client";

// components/editor/PublishDialog.tsx — publicar y COMPARTIR (04 §6.5, §7.1 pasos 10-12).
//
// `GET …/release/preflight` → diálogo con la lista de lo que falta → `POST …/release`.
// `422 TPL_PUBLISH_BLOCKED_*` vuelve al preflight con la lista ACTUALIZADA (el preflight pudo quedar
// obsoleto entre pasos). Despublicar, rotar el enlace y copiar el enlace viven en la vista de
// publicada, que desde 3C-UX-B se puede abrir SIEMPRE, no solo justo después de publicar.
//
// Fase 3-C (`11 §7`, fila «Publicar y compartir»): `Dialog` del sistema, lista de revisión con
// ICONOS DE ESTADO propios (`IconoError` para lo que bloquea, `IconoAviso` para lo que no) y un
// motivo visible junto al botón deshabilitado — `11 §5`: «deshabilitado … siempre una explicación
// cerca, nunca un control mudo». Cero emojis.
//
// LAS TRES CORRECCIONES DEL CIERRE (`bitacora/3c-ux.md §4`):
//   · G-04 · la revisión comparaba la fecha del evento solo contra el itinerario que la clienta
//     hubiera escrito, así que una invitación con el itinerario de EJEMPLO se publicaba con dos
//     fechas distintas y un «Todo listo para publicar» (`coherencia-fechas.ts`).
//   · G-05 · la revisión solo enseñaba lo que bloquea (obligatorio + de ejemplo). Todo lo opcional
//     —«Nombre de la mamá», el itinerario de muestra, una sección entera de ejemplo— se publicaba
//     sin que nadie lo hubiera visto (`contenido-de-ejemplo.ts`). Sigue sin bloquear (`03 §6`), pero
//     ya no se puede publicar sin haberlo leído: el botón NUNCA dice «Todo listo» si hay avisos.
//   · G-06 · el enlace público solo existía dentro del diálogo que acababa de publicar; al cerrarlo
//     desaparecía del producto entero. Ahora la barra lleva el estado «Publicada» y «Compartir»
//     siempre visibles, y el diálogo se abre en la vista de publicada.
//
// CIERRE E-10c (`bitacora/3c-ux-b.md`): «abrir-publicar» era un botón SUELTO al lado del `Dialog`,
// no su `trigger` — Radix solo devuelve el foco a `context.triggerRef` al cerrar con Escape, así que
// sin `Trigger` el foco caía al principio del documento. Ahora el botón ES el `trigger` del `Dialog`.
import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { ComposedDocument, TemplateManifest } from "@invitaciones/schema";
import { Badge, Button, Dialog, DialogClose, toast } from "@invitaciones/ui";
import { IconoAviso, IconoCompartir, IconoCopiar, IconoError, IconoExterno, IconoVer } from "@invitaciones/icons";
import { getPreflight, publishRelease, rotatePublicToken, unpublishRelease } from "@/lib/api-client.ts";
import { enlacePublico } from "@/lib/enlace-publico.ts";
import { ApiError } from "@/lib/errors.ts";
import { es_MX } from "@/lib/i18n.ts";
import { useTemplateManifest } from "@/lib/manifest.ts";
import { useEditorStore } from "@/lib/store.ts";
import { correccionesParaUsarLaFechaDelEvento, fechasDiscrepantes } from "./coherencia-fechas.ts";
import { cuantosEjemplos, ejemplosVisibles, muestraDe, type SeccionConEjemplos } from "./contenido-de-ejemplo.ts";
import type { PreflightBlocker, PreflightResponse, PublishResponse } from "@/lib/api-types.ts";

type Vista = "cerrado" | "revision" | "publicado";
type Estado = "cargando-preflight" | "listo" | "publicando" | "error-preflight" | "error-publicar" | "aplicando";
type AccionEnlace = "idle" | "despublicando" | "despublicada" | "rotando" | "error";
/** U-5: ¿ya respondió la invalidación del enlace público? Hasta entonces no se afirma nada. */
type Invalidacion = "pendiente" | "hecha" | "fallida";

/** Cuántos bloques de ejemplo se enseñan por sección antes de resumir con «y N más». */
const EJEMPLOS_VISIBLES_POR_SECCION = 4;

/**
 * U-5 · pide a la propia aplicación que purgue la caché ISR de `/i/{publicToken}` y **espera la
 * respuesta**. Devuelve `true` solo si la invalidación se confirmó. Nunca lanza: un fallo aquí no
 * puede tumbar la pantalla de éxito de una publicación que sí ocurrió — se dice y ya.
 */
async function invalidarEnlacePublico(publicToken: string, motivo: "published" | "unpublished" | "token-rotated"): Promise<boolean> {
  try {
    const r = await fetch("/api/revalidate/tras-publicar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicToken, motivo }),
      cache: "no-store",
    });
    if (!r.ok) return false;
    return ((await r.json()) as { revalidated?: boolean }).revalidated === true;
  } catch {
    return false;
  }
}

const CODIGOS_BLOQUEO_CONOCIDOS = new Set([
  "TPL_PUBLISH_BLOCKED_MISSING_REQUIRED",
  "TPL_PUBLISH_BLOCKED_DEFAULT_CONTENT",
  "TPL_PUBLISH_BLOCKED_INVALID_VALUES",
  // ADR-5-0B-01 (sesión E4, `handoffs/5-4-contrato-pagos.md` §2.6): la puerta de publicación por
  // plan pagado vive en el backend (`ReleaseService`) y llega aquí como un bloqueo más.
  "TPL_PLAN_UNPAID",
]);

/**
 * G-06 · el estado de publicación, visible en la barra del editor sin abrir nada. Se exporta aparte
 * porque en el teléfono vive en otra fila de la cabecera (a 390 px no caben la insignia y los dos
 * botones junto al nombre de la invitación). No es interactiva: duplicarla no duplica ningún diálogo.
 */
export function InsigniaDePublicacion({ className }: { className?: string }): React.JSX.Element | null {
  const activeRelease = useEditorStore((s) => s.activeRelease);
  const revision = useEditorStore((s) => s.revision);
  const revisionPublicada = useEditorStore((s) => s.revisionPublicada);
  if (!activeRelease) return null;
  const conCambios = activeRelease.stale || (revisionPublicada !== null && revision > revisionPublicada);
  return (
    <span
      className={className}
      data-testid="estado-publicacion"
      data-con-cambios={conCambios ? "si" : "no"}
    >
      <Badge tone={conCambios ? "warning" : "success"}>
        {conCambios ? es_MX.editor.publicar.estadoConCambios : es_MX.editor.publicar.estadoPublicada}
        {/* La insignia dice dos palabras; el lector de pantalla oye la frase entera. */}
        <span className="sr-only">
          {" · "}
          {conCambios ? es_MX.editor.publicar.etiquetaEstadoConCambios : es_MX.editor.publicar.etiquetaEstadoPublicada}
        </span>
      </Badge>
    </span>
  );
}

export function PublishDialog({ invitationId, manifest: manifestExterno }: { invitationId: number; manifest?: TemplateManifest | null }) {
  const [vista, setVista] = useState<Vista>("cerrado");
  const [estado, setEstado] = useState<Estado>("listo");
  const [preflight, setPreflight] = useState<PreflightResponse | null>(null);
  const [resultado, setResultado] = useState<PublishResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [accionEnlace, setAccionEnlace] = useState<AccionEnlace>("idle");
  const [invalidacion, setInvalidacion] = useState<Invalidacion>("pendiente");
  const puedePublicar = useEditorStore((s) => s.loadState === "ready");
  // U-4 · la comprobación de coherencia entre la fecha del evento y la del itinerario se hace sobre
  // el documento compuesto que el editor ya tiene, con el manifiesto de la versión activa.
  const composed = useEditorStore((s) => s.composed);
  const activeRelease = useEditorStore((s) => s.activeRelease);
  const publicTokenStore = useEditorStore((s) => s.publicToken);
  const publicUrlStore = useEditorStore((s) => s.publicUrl);
  const revision = useEditorStore((s) => s.revision);
  const revisionPublicada = useEditorStore((s) => s.revisionPublicada);
  // El manifiesto puede venir de fuera (la página ya lo tiene cargado) o pedirse aquí: en ambos
  // casos es el MISMO caché de `lib/manifest.ts`, así que no hay dos lecturas de la misma ruta.
  const { manifest: manifestDelHook } = useTemplateManifest(invitationId);
  const manifest = manifestExterno === undefined ? manifestDelHook : manifestExterno;
  const discrepancia = fechasDiscrepantes(manifest, composed);

  const bloqueados = new Set((preflight?.blockers ?? []).flatMap((b) => b.blockIds ?? []));
  const ejemplos = ejemplosVisibles(composed, manifest, bloqueados);
  const totalEjemplos = cuantosEjemplos(ejemplos);

  // `!= null` a propósito: el backend omite el campo cuando no hay release, así que aquí puede
  // llegar `undefined` además de `null`.
  const publicada = activeRelease != null && accionEnlace !== "despublicada";
  const conCambiosSinPublicar =
    activeRelease != null && (activeRelease.stale || (revisionPublicada !== null && revision > revisionPublicada));

  /** El enlace que se comparte (U-6): con el origen público del sitio, nunca el `localhost` del servidor. */
  const tokenActual = resultado?.publicToken ?? publicTokenStore;
  const enlace = tokenActual ? enlacePublico(tokenActual, resultado?.publicUrl ?? publicUrlStore) : "";
  const publicadaEl = resultado?.publishedAt ?? activeRelease?.publishedAt ?? null;

  async function abrirRevision(): Promise<void> {
    setVista("revision");
    setEstado("cargando-preflight");
    setError(null);
    try {
      const r = await getPreflight(invitationId);
      setPreflight(r);
      setEstado("listo");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : es_MX.errores.generico);
      setEstado("error-preflight");
    }
  }

  function abrirCompartir(): void {
    setError(null);
    setAccionEnlace("idle");
    // Lo que ya está publicado se ve en internet desde hace rato: no hay invalidación que esperar.
    setInvalidacion(resultado ? invalidacion : "hecha");
    setVista("publicado");
  }

  async function confirmar(): Promise<void> {
    setEstado("publicando");
    setError(null);
    setInvalidacion("pendiente");
    try {
      const r = await publishRelease(invitationId, { baseRevision: useEditorStore.getState().revision });
      setResultado(r);
      setVista("publicado");
      setEstado("listo");
      useEditorStore.getState().setActiveRelease(
        {
          releaseId: r.releaseId,
          publishedAt: r.publishedAt,
          contentHash: r.contentHash,
          documentRevision: r.documentRevision,
          stale: false,
          staleReason: [],
        },
        r.documentRevision,
        r.publicToken,
      );
      // U-5 · NO se afirma «ya se puede ver en internet» hasta que la invalidación responde. Si
      // falla, se dice la verdad («puede tardar unos minutos»), que era justo lo que no se decía.
      const ok = await invalidarEnlacePublico(r.publicToken, "published");
      setInvalidacion(ok ? "hecha" : "fallida");
    } catch (e: unknown) {
      if (e instanceof ApiError && CODIGOS_BLOQUEO_CONOCIDOS.has(e.code)) {
        // El preflight quedó obsoleto (04 §7.1 paso 11): se vuelve al paso 10 con la lista actualizada.
        try {
          const r2 = await getPreflight(invitationId);
          setPreflight(r2);
          setEstado("listo");
          setError("Tu invitación cambió desde la última revisión. Aquí está la lista actualizada.");
          return;
        } catch {
          // sigue al mensaje genérico de abajo
        }
      }
      // U-9 · un fallo de red decía «Failed to fetch», en inglés, a diez centímetros del impecable
      // «Sin conexión — tus cambios se guardarán cuando vuelva». Mismo tono, mismo idioma.
      setError(e instanceof TypeError ? es_MX.errores.sinRed : e instanceof Error ? e.message : es_MX.editor.publicar.errorPublicar);
      setEstado("error-publicar");
    }
  }

  function irAlBloque(hallazgo: PreflightBlocker): void {
    const composedActual = useEditorStore.getState().composed;
    const clave = hallazgo.sectionKeys?.[0] ?? (hallazgo.blockIds?.[0] ? seccionDelBloque(composedActual, hallazgo.blockIds[0]) : null);
    if (!clave) return;
    irASeccion(clave, hallazgo.blockIds?.[0]);
  }

  function irASeccion(clave: string, blockId?: string): void {
    useEditorStore.getState().select({ sectionKey: clave, blockId: blockId ?? clave });
    useEditorStore.getState().openPanel("block");
    useEditorStore.getState().scrollToSection(clave);
    setVista("cerrado");
  }

  /**
   * G-04 · «Usar la fecha del evento en el itinerario»: desplaza TODOS los momentos los mismos días
   * para que el primero caiga el día del evento, conservando horas y duraciones. Solo se ofrece
   * cuando el itinerario es de la clienta: un ítem que solo vive en los defaults no es direccionable
   * (`coherencia-fechas.ts`, `sePuedeAplicar`).
   */
  async function usarLaFechaDelEvento(): Promise<void> {
    if (!discrepancia) return;
    const correcciones = correccionesParaUsarLaFechaDelEvento(discrepancia);
    if (correcciones.length === 0) return;
    setEstado("aplicando");
    const st = useEditorStore.getState();
    for (const c of correcciones) st.setItemBlock(c.groupId, c.itemId, c.blockId, c.value);
    st.flushNow();
    toast({ variante: "exito", descripcion: es_MX.editor.publicar.fechasAplicadas });
    await abrirRevision();
  }

  function ocultarSeccion(seccion: SeccionConEjemplos): void {
    useEditorStore.getState().setSectionVisible(seccion.sectionKey, false);
    toast({ variante: "exito", descripcion: es_MX.editor.publicar.seccionOcultada(seccion.titulo) });
  }

  async function copiarEnlace(): Promise<void> {
    if (!enlace) return;
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      toast({ variante: "exito", descripcion: es_MX.editor.publicar.enlaceCopiadoToast });
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      useEditorStore.getState().pushWarning({ nivel: "warning", texto: es_MX.editor.publicar.enlaceNoCopiado });
    }
  }

  async function despublicar(): Promise<void> {
    setAccionEnlace("despublicando");
    try {
      await unpublishRelease(invitationId);
      // Misma razón que al publicar (U-5): sin purgar la etiqueta, el enlace sigue sirviendo la
      // invitación durante otros cinco minutos después de haberla retirado.
      if (tokenActual) await invalidarEnlacePublico(tokenActual, "unpublished");
      setAccionEnlace("despublicada");
      useEditorStore.getState().setActiveRelease(null, null);
    } catch (e: unknown) {
      setAccionEnlace("error");
      useEditorStore
        .getState()
        .pushWarning({ nivel: "error", texto: e instanceof Error ? e.message : es_MX.editor.publicar.noPudimosDespublicar });
    }
  }

  async function rotarEnlace(): Promise<void> {
    setAccionEnlace("rotando");
    try {
      const anterior = tokenActual;
      const r = await rotatePublicToken(invitationId);
      setResultado((prev) => (prev ? { ...prev, publicToken: r.publicToken, publicUrl: r.publicUrl } : prev));
      useEditorStore.getState().setActiveRelease(useEditorStore.getState().activeRelease, undefined, r.publicToken);
      // El token VIEJO tiene que dejar de servir de la caché: si no, quien tenga el enlace anterior
      // sigue viendo la invitación cinco minutos después de haberlo invalidado.
      if (anterior) await invalidarEnlacePublico(anterior, "token-rotated");
      setAccionEnlace("idle");
    } catch (e: unknown) {
      setAccionEnlace("error");
      useEditorStore
        .getState()
        .pushWarning({ nivel: "error", texto: e instanceof Error ? e.message : es_MX.editor.publicar.noPudimosRotar });
    }
  }

  const hayBloqueos = (preflight?.blockers.length ?? 0) > 0;
  const cuantosAvisos = (preflight?.warnings.length ?? 0) + (discrepancia ? 1 : 0) + totalEjemplos;
  const enPublicado = vista === "publicado";
  const enRevision = vista === "revision";

  return (
    <>
      {/* La barra: estado, «Compartir» y el botón que abre la revisión. `11 §5`. */}
      <InsigniaDePublicacion className="hidden shrink-0 ed:inline-flex" />
      {publicada ? (
        <Button size="sm" variant="secundario" onClick={abrirCompartir} data-testid="abrir-compartir">
          <IconoCompartir size={18} tone="mono" />
          {es_MX.editor.publicar.compartir}
        </Button>
      ) : null}

      <Dialog
        open={vista !== "cerrado"}
        onOpenChange={(abierto) => {
          if (!abierto) setVista("cerrado");
        }}
        // E-10c (`handoffs/3c-b2-f2.md`): el retorno de foco de `Dialog` al cerrar con Escape lo hace
        // RADIX, y solo sabe a dónde devolverlo si el botón que lo abre es el `trigger` de verdad
        // (`@radix-ui/react-dialog`, `DialogContentModal.onCloseAutoFocus` → `context.triggerRef`).
        // Antes este botón era un hermano suelto del `Dialog` con su propio `onClick`: sin `Trigger`,
        // `triggerRef.current` quedaba `null` y el foco, al cerrar, caía al principio del documento.
        trigger={
          <Button size="sm" disabled={!puedePublicar} onClick={() => void abrirRevision()} data-testid="abrir-publicar">
            {publicada ? (
              <>
                <span className="ed:hidden">{es_MX.editor.publicar.volverAPublicarCorto}</span>
                <span className="hidden ed:inline">{es_MX.editor.publicar.volverAPublicar}</span>
              </>
            ) : (
              es_MX.editor.publicar.abrir
            )}
          </Button>
        }
        busy={estado === "publicando"}
        title={enPublicado ? es_MX.editor.publicar.exitoTitulo : es_MX.editor.publicar.titulo}
        description={enPublicado ? es_MX.editor.publicar.descripcionExito : es_MX.editor.publicar.antesDePublicar}
        className="max-w-[34rem]"
        footer={
          enRevision && estado !== "cargando-preflight" && estado !== "error-preflight" ? (
            <>
              <DialogClose asChild>
                <Button variant="terciario" disabled={estado === "publicando"}>
                  {es_MX.editor.publicar.cancelar}
                </Button>
              </DialogClose>
              <Button
                data-testid="confirmar-publicar"
                loading={estado === "publicando"}
                loadingText={es_MX.editor.publicar.publicando}
                disabled={hayBloqueos || estado === "aplicando"}
                onClick={() => void confirmar()}
              >
                {cuantosAvisos > 0 && !hayBloqueos ? es_MX.editor.publicar.publicarDeTodosModos : es_MX.editor.publicar.confirmar}
              </Button>
            </>
          ) : undefined
        }
      >
        {/*
         * 3C-UX-B, e2e real: con el aviso de fechas (G-04) y la lista de contenido de ejemplo (G-05)
         * a la vez, el contenido supera la altura del `Dialog` (que no se limita ni se desplaza,
         * `packages/ui/.../Dialog.tsx`) y el botón «Publicar» queda fuera del viewport, inalcanzable
         * incluso con scroll — no era un problema del test, era el diálogo real en una invitación con
         * bastante contenido de ejemplo. Mismo patrón que `ConflictDialog.tsx`: el contenido se
         * desplaza dentro de un alto acotado; la cabecera y el pie del `Dialog` quedan fijos.
         */}
        <div data-testid="publish-dialog" className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-0.5">
          {enRevision && estado === "cargando-preflight" ? (
            <p role="status" className="text-md text-ui-ink-muted">
              {es_MX.editor.publicar.cargandoRevision}
            </p>
          ) : null}

          {enRevision && estado === "error-preflight" ? (
            <div role="alert" className="flex flex-col gap-3">
              <p className="text-md text-ui-danger-text">{error ?? es_MX.editor.publicar.errorRevision}</p>
              <Button onClick={() => void abrirRevision()} className="self-start">
                {es_MX.comun.reintentar}
              </Button>
            </div>
          ) : null}

          {enRevision && estado !== "cargando-preflight" && estado !== "error-preflight" && preflight ? (
            <>
              {/* G-06 · quien vuelve a publicar tiene que saber que ya lo estaba. */}
              {publicada ? (
                <p className="text-xs text-ui-ink-muted">
                  {conCambiosSinPublicar ? es_MX.editor.publicar.yaEstaPublicada : es_MX.editor.publicar.alDiaConLoPublicado}
                </p>
              ) : null}

              {error ? (
                <p role="status" className="text-xs text-ui-ink-muted">
                  {error}
                </p>
              ) : null}

              {preflight.blockers.length === 0 && cuantosAvisos === 0 ? (
                <p className="flex items-center gap-2 text-md text-ui-ink">{es_MX.editor.publicar.sinPendientes}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {/* G-04 · dos fechas distintas en la misma invitación. Aviso (no bloquea: hay bodas
                      de dos días), con la corrección de un toque cuando el itinerario es suyo. */}
                  {discrepancia ? (
                    <Hallazgo
                      testId="aviso-fechas"
                      bloquea={false}
                      texto={
                        discrepancia.soloEjemplo
                          ? es_MX.editor.publicar.avisoFechasDeEjemplo(discrepancia.textoEvento, discrepancia.momentos[0]!.texto)
                          : es_MX.editor.publicar.avisoFechasDistintas(discrepancia.textoEvento, discrepancia.momentos[0]!.texto)
                      }
                      acciones={[
                        ...(discrepancia.sePuedeAplicar
                          ? [
                              {
                                texto: estado === "aplicando" ? es_MX.editor.publicar.aplicandoFechas : es_MX.editor.publicar.usarLaFechaDelEvento,
                                onAccion: () => void usarLaFechaDelEvento(),
                                testId: "usar-fecha-evento",
                                principal: true,
                              },
                            ]
                          : []),
                        { texto: es_MX.editor.publicar.revisarFechas, onAccion: () => irASeccion(discrepancia.sectionKey) },
                      ]}
                    />
                  ) : null}
                  {preflight.blockers.map((b, i) =>
                    // ADR-5-0B-01 · «Falta el plan» no es un bloque de contenido: no hay sección a
                    // la que saltar, y el sitio que lo resuelve es la pantalla del plan, no el
                    // lienzo. Mismo aspecto que cualquier otro bloqueo (`Hallazgo`), pero su acción
                    // es un enlace del sistema, no un salto de sección.
                    b.code === "TPL_PLAN_UNPAID" ? (
                      <Hallazgo key={`b-${i}`} bloquea texto={textoHallazgo(b, composed)} acciones={[]}>
                        <Button asChild variant="terciario" size="sm" data-testid="publicar-ir-al-plan">
                          <Link href={`/editor/${invitationId}/plan`}>{es_MX.panel.plan.elegirPlan}</Link>
                        </Button>
                      </Hallazgo>
                    ) : (
                      <Hallazgo
                        key={`b-${i}`}
                        bloquea
                        texto={textoHallazgo(b, composed)}
                        acciones={[{ texto: es_MX.editor.publicar.completar, onAccion: () => irAlBloque(b) }]}
                      />
                    ),
                  )}
                  {preflight.warnings.map((w, i) => (
                    <Hallazgo
                      key={`w-${i}`}
                      bloquea={false}
                      texto={textoHallazgo(w, composed)}
                      acciones={[{ texto: es_MX.editor.publicar.editar, onAccion: () => irAlBloque(w) }]}
                    />
                  ))}
                </ul>
              )}

              {/* G-05 · TODO lo que sigue siendo de ejemplo y la invitada va a leer, por sección. */}
              {ejemplos.length > 0 ? (
                <section className="flex flex-col gap-2" data-testid="lista-ejemplos">
                  <h3 className="label-sm text-ui-ink-muted">{es_MX.editor.publicar.tituloEjemplos}</h3>
                  <ul className="flex flex-col gap-2">
                    {ejemplos.map((seccion) => (
                      <li key={seccion.sectionKey} className="rounded-ui-control bg-ui-warning-soft p-2.5" data-testid={`ejemplo-${seccion.sectionKey}`}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <span className="flex min-w-0 flex-1 items-start gap-2 text-sm font-semibold text-ui-on-warning-soft">
                            <IconoAviso size={18} tone="mono" className="mt-px shrink-0" />
                            {seccion.titulo}
                          </span>
                          {seccion.seccionEntera && seccion.sePuedeOcultar ? (
                            <Button
                              variant="terciario"
                              size="sm"
                              className="shrink-0"
                              data-testid={`ocultar-seccion-${seccion.sectionKey}`}
                              onClick={() => ocultarSeccion(seccion)}
                            >
                              {es_MX.editor.publicar.ocultarSeccion}
                            </Button>
                          ) : null}
                        </div>
                        {seccion.seccionEntera ? (
                          <p className="mt-1 pl-6 text-xs text-ui-on-warning-soft">{es_MX.editor.publicar.seccionEnteraDeEjemplo}</p>
                        ) : null}
                        <ul className="mt-1.5 flex flex-col gap-1 pl-6">
                          {seccion.bloques.slice(0, EJEMPLOS_VISIBLES_POR_SECCION).map((bloque) => (
                            <li key={bloque.blockId} className="flex flex-wrap items-center justify-between gap-2">
                              <span className="min-w-0 flex-1 text-sm text-ui-on-warning-soft">
                                {bloque.cantidad === undefined
                                  ? es_MX.editor.publicar.ejemploDeBloque(bloque.etiqueta, bloque.muestra)
                                  : es_MX.editor.publicar.ejemploDeGrupo(bloque.etiqueta, bloque.muestra, bloque.cantidad)}
                              </span>
                              <Button
                                variant="terciario"
                                size="sm"
                                className="shrink-0"
                                onClick={() => irASeccion(seccion.sectionKey, bloque.blockId)}
                              >
                                {es_MX.editor.publicar.editar}
                              </Button>
                            </li>
                          ))}
                          {seccion.bloques.length > EJEMPLOS_VISIBLES_POR_SECCION ? (
                            <li className="text-xs text-ui-on-warning-soft">
                              {es_MX.editor.publicar.yMasEjemplos(seccion.bloques.length - EJEMPLOS_VISIBLES_POR_SECCION)}
                            </li>
                          ) : null}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {/* `11 §5`: un control deshabilitado lleva SIEMPRE su explicación al lado; y el que NO
                  está deshabilitado tampoco puede transmitir «todo listo» si hay avisos. */}
              {hayBloqueos ? (
                <p className="text-xs text-ui-ink-muted">{es_MX.editor.publicar.noSePuedePublicar}</p>
              ) : cuantosAvisos > 0 ? (
                <p className="text-xs text-ui-ink-muted" data-testid="resumen-avisos">
                  {es_MX.editor.publicar.hayAvisos(cuantosAvisos)}
                </p>
              ) : null}

              {estado === "error-publicar" ? (
                <p role="alert" className="flex items-center gap-1.5 text-sm font-semibold text-ui-danger-text">
                  <IconoError size={16} tone="mono" className="shrink-0" />
                  {error ?? es_MX.editor.publicar.errorPublicar}
                </p>
              ) : null}
            </>
          ) : null}

          {enPublicado ? (
            <div className="flex flex-col gap-4">
              {/* U-5 · el estado se dice con exactitud: mientras la invalidación no ha respondido
                  no se promete que ya se vea, y si falló se dice que puede tardar. */}
              <p
                role="status"
                aria-live="polite"
                data-testid="estado-publicado"
                data-invalidacion={invalidacion}
                className="text-md text-ui-ink"
              >
                {invalidacion === "pendiente"
                  ? es_MX.editor.publicar.actualizandoEnlace
                  : invalidacion === "hecha"
                    ? es_MX.editor.publicar.yaSeVe
                    : es_MX.editor.publicar.tardaUnosMinutos}
              </p>

              <div className="flex flex-col gap-2 rounded-ui-card bg-ui-surface-alt p-3">
                <span className="label-sm text-ui-ink-muted">{es_MX.editor.publicar.tuEnlace}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-ui-ink" data-testid="enlace-publicado">
                    {enlace}
                  </span>
                  <Button size="sm" variant="secundario" onClick={() => void copiarEnlace()} data-testid="copiar-enlace">
                    <IconoCopiar size={18} tone="mono" />
                    {copiado ? es_MX.editor.publicar.enlaceCopiado : es_MX.editor.publicar.copiarEnlace}
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild variant="secundario" size="sm">
                  <a href={enlace} target="_blank" rel="noreferrer">
                    <IconoVer size={18} tone="mono" />
                    {es_MX.editor.publicar.verComoInvitado}
                    <IconoExterno size={14} tone="mono" />
                  </a>
                </Button>
                <Button asChild variant="terciario" size="sm">
                  <a href={`https://wa.me/?text=${encodeURIComponent(enlace)}`} target="_blank" rel="noreferrer">
                    <IconoCompartir size={18} tone="mono" />
                    {es_MX.editor.publicar.compartirWhatsapp}
                    <IconoExterno size={14} tone="mono" />
                  </a>
                </Button>
              </div>

              {publicadaEl ? (
                <p className="text-xs text-ui-ink-muted">{es_MX.editor.publicar.publicadaEl(formatearFecha(publicadaEl))}</p>
              ) : null}

              {/* G-06 · «Volver a publicar» donde hace falta: dentro de la vista de publicada, cuando
                  hay cambios que la invitada todavía no ve (el backend marca `stale` al cambiar la
                  fecha del evento, `contratos.md §12.3`). */}
              {conCambiosSinPublicar && accionEnlace !== "despublicada" ? (
                <div className="flex flex-wrap items-center gap-2 rounded-ui-control bg-ui-warning-soft p-2.5">
                  <span className="min-w-0 flex-1 text-sm text-ui-on-warning-soft">{es_MX.editor.publicar.yaEstaPublicada}</span>
                  <Button size="sm" variant="secundario" data-testid="volver-a-publicar" onClick={() => void abrirRevision()}>
                    {es_MX.editor.publicar.volverAPublicar}
                  </Button>
                </div>
              ) : null}

              <div className="flex flex-col gap-2 border-t border-ui-divider pt-3.5">
                {accionEnlace === "despublicada" ? (
                  <p role="status" className="text-sm text-ui-ink">
                    {es_MX.editor.publicar.despublicada}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="terciario"
                      size="sm"
                      className="text-ui-danger-text hover:bg-ui-danger-soft"
                      disabled={accionEnlace === "despublicando" || accionEnlace === "rotando"}
                      loading={accionEnlace === "despublicando"}
                      loadingText={es_MX.editor.publicar.despublicando}
                      onClick={() => {
                        if (window.confirm(es_MX.editor.publicar.confirmarDespublicar)) void despublicar();
                      }}
                    >
                      {es_MX.editor.publicar.despublicar}
                    </Button>
                    <Button
                      variant="terciario"
                      size="sm"
                      disabled={accionEnlace === "despublicando" || accionEnlace === "rotando"}
                      loading={accionEnlace === "rotando"}
                      loadingText={es_MX.editor.publicar.rotando}
                      onClick={() => {
                        if (window.confirm(es_MX.editor.publicar.confirmarRotar)) void rotarEnlace();
                      }}
                    >
                      {es_MX.editor.publicar.rotarEnlace}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}

/**
 * Una línea de la lista de revisión (`04 §6.5`): icono de estado PROPIO —`error` para lo que
 * bloquea, `aviso` para lo que no—, la frase es-MX y sus acciones. Nunca un glifo tipográfico.
 */
function Hallazgo({
  texto,
  acciones,
  bloquea,
  testId,
  children,
}: {
  texto: string;
  acciones: Array<{ texto: string; onAccion: () => void; testId?: string; principal?: boolean }>;
  bloquea: boolean;
  testId?: string;
  /** Acción que no es un `onAccion` local (p. ej. un enlace del sistema a otra pantalla). */
  children?: ReactNode;
}) {
  const Icono = bloquea ? IconoError : IconoAviso;
  return (
    <li
      data-testid={testId}
      className={`flex flex-wrap items-start justify-between gap-2 rounded-ui-control p-2.5 ${
        bloquea ? "bg-ui-danger-soft" : "bg-ui-warning-soft"
      }`}
    >
      <span className={`flex min-w-0 flex-1 items-start gap-2 text-sm ${bloquea ? "text-ui-on-danger-soft" : "text-ui-on-warning-soft"}`}>
        <Icono size={18} tone="mono" className="mt-px shrink-0" />
        {texto}
      </span>
      <span className="flex shrink-0 flex-wrap gap-1">
        {acciones.map((accion) => (
          <Button
            key={accion.texto}
            variant={accion.principal ? "secundario" : "terciario"}
            size="sm"
            onClick={accion.onAccion}
            data-testid={accion.testId}
          >
            {accion.texto}
          </Button>
        ))}
        {children}
      </span>
    </li>
  );
}

/**
 * M-08 (`bitacora/3c-ux.md §4`) · «"Sigue con el texto de ejemplo" no dice qué campo ni de qué
 * sección». El preflight manda códigos y `blockId`s; el compuesto sabe cómo se llaman esas cosas en
 * castellano y qué dicen ahora mismo, así que la frase se completa aquí: «Sigue con el texto de
 * ejemplo: Portada — Título: «Ana & Luis»». Se enseñan hasta tres; el resto se cuenta.
 */
function textoHallazgo(h: PreflightBlocker, composed: ComposedDocument | null): string {
  const nombreCodigo = es_MX.editor.publicar.bloqueo as Record<string, string>;
  const base = nombreCodigo[h.code] ?? (h.code === "TPL_SECTION_EMPTY" ? es_MX.editor.publicar.avisoSeccionVacia : h.code);
  const nombres = [
    ...(h.blockIds ?? []).map((id) => ubicacionDeBloque(composed, id)),
    ...(h.sectionKeys ?? []).map((k) => tituloDeSeccion(composed, k)),
  ].filter((x): x is string => x !== null);
  if (nombres.length === 0) {
    const n = (h.blockIds?.length ?? 0) + (h.sectionKeys?.length ?? 0);
    return n > 1 ? `${base} (${n} elementos)` : base;
  }
  const enseñados = nombres.slice(0, 3).join(" · ");
  return nombres.length > 3 ? `${base}: ${enseñados} ${es_MX.editor.publicar.yMasEjemplos(nombres.length - 3)}` : `${base}: ${enseñados}`;
}

/** `Portada — Título: «Ana & Luis»`, con lo que el bloque dice AHORA cuando es texto. */
function ubicacionDeBloque(composed: ComposedDocument | null, blockId: string): string | null {
  if (!composed) return null;
  for (const seccion of composed.sections) {
    for (const bloque of seccion.blocks) {
      if (bloque.id !== blockId) continue;
      const muestra = "items" in bloque ? "" : muestraDe(bloque.value);
      return muestra ? `${seccion.title} — ${bloque.label}: «${muestra}»` : `${seccion.title} — ${bloque.label}`;
    }
  }
  return null;
}

function tituloDeSeccion(composed: ComposedDocument | null, sectionKey: string): string | null {
  return composed?.sections.find((s) => s.key === sectionKey)?.title ?? null;
}

function seccionDelBloque(composed: ComposedDocument | null, blockId: string): string | null {
  if (!composed) return null;
  for (const seccion of composed.sections) {
    if (seccion.blocks.some((b) => b.id === blockId)) return seccion.key;
  }
  return null;
}

function formatearFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}
