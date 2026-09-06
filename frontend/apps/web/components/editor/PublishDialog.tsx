"use client";

// components/editor/PublishDialog.tsx — publicar (04 §6.5, §7.1 pasos 10-12): `GET …/release/preflight`
// → diálogo con la lista de lo que falta → `POST …/release`. `422 TPL_PUBLISH_BLOCKED_*` vuelve al
// preflight con la lista ACTUALIZADA (el preflight pudo quedar obsoleto entre pasos). Despublicar,
// rotar el enlace y copiar el enlace viven en la pantalla de éxito, con sus estados de carga y error.
//
// Fase 3-C (`11 §7`, fila «Publicar y compartir»): `Dialog` del sistema, lista de revisión con
// ICONOS DE ESTADO propios (`IconoError` para lo que bloquea, `IconoAviso` para lo que no) y un
// motivo visible junto al botón deshabilitado — `11 §5`: «deshabilitado … siempre una explicación
// cerca, nunca un control mudo». Al copiar el enlace sale además un `Toast` («Enlace copiado. Ya
// puedes pegarlo en WhatsApp.»); el texto del botón sigue cambiando, así que el aviso nunca es el
// único portador. Cero emojis: la palomita de `publicar.yaSeVe` se retiró de `lib/i18n.ts`.
import { useState } from "react";
import type { ComposedDocument } from "@invitaciones/schema";
import { Button, Dialog, DialogClose, toast } from "@invitaciones/ui";
import { IconoAviso, IconoCompartir, IconoCopiar, IconoError, IconoExterno, IconoVer } from "@invitaciones/icons";
import { getPreflight, publishRelease, rotatePublicToken, unpublishRelease } from "@/lib/api-client.ts";
import { enlacePublico } from "@/lib/enlace-publico.ts";
import { ApiError } from "@/lib/errors.ts";
import { es_MX } from "@/lib/i18n.ts";
import { useTemplateManifest } from "@/lib/manifest.ts";
import { useEditorStore } from "@/lib/store.ts";
import { fechasDiscrepantes } from "./coherencia-fechas.ts";
import type { PreflightBlocker, PreflightResponse, PublishResponse } from "@/lib/api-types.ts";

type Estado = "cerrado" | "cargando-preflight" | "listo" | "publicando" | "publicado" | "error-preflight" | "error-publicar";
type AccionEnlace = "idle" | "despublicando" | "despublicada" | "rotando" | "error";
/** U-5: ¿ya respondió la invalidación del enlace público? Hasta entonces no se afirma nada. */
type Invalidacion = "pendiente" | "hecha" | "fallida";

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
]);

export function PublishDialog({ invitationId }: { invitationId: number }) {
  const [estado, setEstado] = useState<Estado>("cerrado");
  const [preflight, setPreflight] = useState<PreflightResponse | null>(null);
  const [resultado, setResultado] = useState<PublishResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [accionEnlace, setAccionEnlace] = useState<AccionEnlace>("idle");
  const [invalidacion, setInvalidacion] = useState<Invalidacion>("pendiente");
  const puedePublicar = useEditorStore((s) => s.loadState === "ready");
  // U-4 · la comprobación de coherencia entre la fecha de la portada y la del itinerario se hace
  // sobre el documento compuesto que el editor ya tiene, con el manifiesto de la versión activa.
  const composed = useEditorStore((s) => s.composed);
  const { manifest } = useTemplateManifest(invitationId);
  const discrepancia = fechasDiscrepantes(manifest, composed);

  /** El enlace que se comparte (U-6): con el origen público del sitio, nunca el `localhost` del servidor. */
  const enlace = resultado ? enlacePublico(resultado.publicToken, resultado.publicUrl) : "";

  async function abrir(): Promise<void> {
    setEstado("cargando-preflight");
    setError(null);
    setResultado(null);
    try {
      const r = await getPreflight(invitationId);
      setPreflight(r);
      setEstado("listo");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : es_MX.errores.generico);
      setEstado("error-preflight");
    }
  }

  async function confirmar(): Promise<void> {
    setEstado("publicando");
    setError(null);
    setInvalidacion("pendiente");
    try {
      const r = await publishRelease(invitationId, { baseRevision: useEditorStore.getState().revision });
      setResultado(r);
      setEstado("publicado");
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
    irASeccion(clave);
  }

  function irASeccion(clave: string): void {
    useEditorStore.getState().select({ sectionKey: clave, blockId: clave });
    useEditorStore.getState().openPanel("block");
    useEditorStore.getState().scrollToSection(clave);
    setEstado("cerrado");
  }

  async function copiarEnlace(): Promise<void> {
    if (!resultado) return;
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
      if (resultado) await invalidarEnlacePublico(resultado.publicToken, "unpublished");
      setAccionEnlace("despublicada");
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
      const anterior = resultado?.publicToken;
      const r = await rotatePublicToken(invitationId);
      setResultado((prev) => (prev ? { ...prev, publicToken: r.publicToken, publicUrl: r.publicUrl } : prev));
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
  const publicado = estado === "publicado" && resultado !== null;

  return (
    <Dialog
      open={estado !== "cerrado"}
      onOpenChange={(abierto) => {
        if (!abierto) setEstado("cerrado");
        else void abrir();
      }}
      busy={estado === "publicando"}
      title={publicado ? es_MX.editor.publicar.exitoTitulo : es_MX.editor.publicar.titulo}
      description={publicado ? es_MX.editor.publicar.descripcionExito : es_MX.editor.publicar.antesDePublicar}
      className="max-w-[34rem]"
      trigger={
        <Button size="sm" disabled={!puedePublicar} data-testid="abrir-publicar">
          {es_MX.editor.publicar.abrir}
        </Button>
      }
      footer={
        estado === "listo" || estado === "publicando" || estado === "error-publicar" ? (
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
              disabled={hayBloqueos}
              onClick={() => void confirmar()}
            >
              {es_MX.editor.publicar.confirmar}
            </Button>
          </>
        ) : undefined
      }
    >
      <div data-testid="publish-dialog" className="flex flex-col gap-4">
        {estado === "cargando-preflight" ? (
          <p role="status" className="text-md text-ui-ink-muted">
            {es_MX.editor.publicar.cargandoRevision}
          </p>
        ) : null}

        {estado === "error-preflight" ? (
          <div role="alert" className="flex flex-col gap-3">
            <p className="text-md text-ui-danger-text">{error ?? es_MX.editor.publicar.errorRevision}</p>
            <Button onClick={() => void abrir()} className="self-start">
              {es_MX.comun.reintentar}
            </Button>
          </div>
        ) : null}

        {(estado === "listo" || estado === "publicando" || estado === "error-publicar") && preflight ? (
          <>
            {error ? (
              <p role="status" className="text-xs text-ui-ink-muted">
                {error}
              </p>
            ) : null}

            {preflight.blockers.length === 0 && preflight.warnings.length === 0 && !discrepancia ? (
              <p className="flex items-center gap-2 text-md text-ui-ink">{es_MX.editor.publicar.sinPendientes}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {/* U-4 · dos fechas distintas en la misma invitación. Aviso (no bloquea: hay bodas
                    de dos días), con su «Revisar» que lleva al itinerario. */}
                {discrepancia ? (
                  <Hallazgo
                    testId="aviso-fechas"
                    bloquea={false}
                    texto={es_MX.editor.publicar.avisoFechasDistintas(discrepancia.textoPortada, discrepancia.textoItinerario)}
                    accion={es_MX.editor.publicar.revisarFechas}
                    onAccion={() => irASeccion(discrepancia.sectionKey)}
                  />
                ) : null}
                {preflight.blockers.map((b, i) => (
                  <Hallazgo
                    key={`b-${i}`}
                    bloquea
                    texto={textoHallazgo(b)}
                    accion={es_MX.editor.publicar.completar}
                    onAccion={() => irAlBloque(b)}
                  />
                ))}
                {preflight.warnings.map((w, i) => (
                  <Hallazgo
                    key={`w-${i}`}
                    bloquea={false}
                    texto={textoHallazgo(w)}
                    accion={es_MX.editor.publicar.editar}
                    onAccion={() => irAlBloque(w)}
                  />
                ))}
              </ul>
            )}

            {/* `11 §5`: un control deshabilitado lleva SIEMPRE su explicación al lado. */}
            {hayBloqueos ? (
              <p className="text-xs text-ui-ink-muted">{es_MX.editor.publicar.noSePuedePublicar}</p>
            ) : null}

            {estado === "error-publicar" ? (
              <p role="alert" className="flex items-center gap-1.5 text-sm font-semibold text-ui-danger-text">
                <IconoError size={16} tone="mono" className="shrink-0" />
                {error ?? es_MX.editor.publicar.errorPublicar}
              </p>
            ) : null}
          </>
        ) : null}

        {publicado && resultado ? (
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

            <p className="text-xs text-ui-ink-muted">{es_MX.editor.publicar.publicadaEl(formatearFecha(resultado.publishedAt))}</p>

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
  );
}

/**
 * Una línea de la lista de revisión (`04 §6.5`): icono de estado PROPIO —`error` para lo que
 * bloquea, `aviso` para lo que no—, la frase es-MX y su acción. Nunca un glifo tipográfico.
 */
function Hallazgo({
  texto,
  accion,
  onAccion,
  bloquea,
  testId,
}: {
  texto: string;
  accion: string;
  onAccion: () => void;
  bloquea: boolean;
  testId?: string;
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
      <Button variant="terciario" size="sm" onClick={onAccion} className="shrink-0">
        {accion}
      </Button>
    </li>
  );
}

function textoHallazgo(h: PreflightBlocker): string {
  const nombreCodigo = es_MX.editor.publicar.bloqueo as Record<string, string>;
  const base = nombreCodigo[h.code] ?? (h.code === "TPL_SECTION_EMPTY" ? es_MX.editor.publicar.avisoSeccionVacia : h.code);
  const n = (h.blockIds?.length ?? 0) + (h.sectionKeys?.length ?? 0);
  return n > 1 ? `${base} (${n} elementos)` : base;
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
