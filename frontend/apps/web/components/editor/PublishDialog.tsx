"use client";

// components/editor/PublishDialog.tsx — publicar (04 §6.5, §7.1 pasos 10-12): `GET …/release/preflight`
// → diálogo con la lista de lo que falta → `POST …/release`. `422 TPL_PUBLISH_BLOCKED_*` vuelve al
// preflight con la lista ACTUALIZADA (el preflight pudo quedar obsoleto entre pasos). Despublicar,
// rotar el enlace y copiar el enlace viven en la pantalla de éxito, con sus estados de carga y error.
import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import type { ComposedDocument } from "@invitaciones/schema";
import { Button } from "@/components/ui/button.tsx";
import { getPreflight, publishRelease, rotatePublicToken, unpublishRelease } from "@/lib/api-client.ts";
import { ApiError } from "@/lib/errors.ts";
import { es_MX } from "@/lib/i18n.ts";
import { useEditorStore } from "@/lib/store.ts";
import type { PreflightBlocker, PreflightResponse, PublishResponse } from "@/lib/api-types.ts";

type Estado = "cerrado" | "cargando-preflight" | "listo" | "publicando" | "publicado" | "error-preflight" | "error-publicar";
type AccionEnlace = "idle" | "despublicando" | "despublicada" | "rotando" | "error";

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
  const puedePublicar = useEditorStore((s) => s.loadState === "ready");

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
    try {
      const r = await publishRelease(invitationId, { baseRevision: useEditorStore.getState().revision });
      setResultado(r);
      setEstado("publicado");
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
      setError(e instanceof Error ? e.message : es_MX.editor.publicar.errorPublicar);
      setEstado("error-publicar");
    }
  }

  function irAlBloque(hallazgo: PreflightBlocker): void {
    const composed = useEditorStore.getState().composed;
    const clave = hallazgo.sectionKeys?.[0] ?? (hallazgo.blockIds?.[0] ? seccionDelBloque(composed, hallazgo.blockIds[0]) : null);
    if (!clave) return;
    useEditorStore.getState().select({ sectionKey: clave, blockId: clave });
    useEditorStore.getState().openPanel("block");
    useEditorStore.getState().scrollToSection(clave);
    setEstado("cerrado");
  }

  async function copiarEnlace(): Promise<void> {
    if (!resultado) return;
    try {
      await navigator.clipboard.writeText(resultado.publicUrl);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      useEditorStore.getState().pushWarning({ nivel: "warning", texto: "No pudimos copiar el enlace. Selecciónalo y cópialo a mano." });
    }
  }

  async function despublicar(): Promise<void> {
    setAccionEnlace("despublicando");
    try {
      await unpublishRelease(invitationId);
      setAccionEnlace("despublicada");
    } catch (e: unknown) {
      setAccionEnlace("error");
      useEditorStore.getState().pushWarning({ nivel: "error", texto: e instanceof Error ? e.message : "No pudimos despublicar tu invitación." });
    }
  }

  async function rotarEnlace(): Promise<void> {
    setAccionEnlace("rotando");
    try {
      const r = await rotatePublicToken(invitationId);
      setResultado((prev) => (prev ? { ...prev, publicToken: r.publicToken, publicUrl: r.publicUrl } : prev));
      setAccionEnlace("idle");
    } catch (e: unknown) {
      setAccionEnlace("error");
      useEditorStore.getState().pushWarning({ nivel: "error", texto: e instanceof Error ? e.message : "No pudimos generar un enlace nuevo." });
    }
  }

  return (
    <Dialog.Root
      open={estado !== "cerrado"}
      onOpenChange={(abierto) => {
        if (!abierto) setEstado("cerrado");
        else void abrir();
      }}
    >
      <Dialog.Trigger asChild>
        <Button size="sm" disabled={!puedePublicar} data-testid="abrir-publicar">
          {es_MX.editor.publicar.abrir}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          data-testid="publish-dialog"
          className="fixed left-1/2 top-1/2 z-50 w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-ui-card bg-ui-surface p-6 shadow-ui-2"
          onEscapeKeyDown={(e) => {
            if (estado === "publicando") e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (estado === "publicando") e.preventDefault();
          }}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <Dialog.Title className="font-ui-display text-ui-card font-semibold text-ui-ink-heading">
              {estado === "publicado" ? es_MX.editor.publicar.exitoTitulo : es_MX.editor.publicar.titulo}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Cerrar"
              disabled={estado === "publicando"}
              className="rounded-ui-control px-2 py-1 text-ui-ink-muted hover:bg-ui-bg-alt disabled:opacity-40"
            >
              ✕
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            {estado === "publicado" ? "Tu invitación ya está en línea." : "Revisamos tu invitación antes de publicarla."}
          </Dialog.Description>

          {estado === "cargando-preflight" ? (
            <p role="status" className="text-ui-body text-ui-ink-muted">
              {es_MX.editor.publicar.cargandoRevision}
            </p>
          ) : null}

          {estado === "error-preflight" ? (
            <div role="alert" className="flex flex-col gap-3">
              <p className="text-ui-body text-ui-danger">{error ?? es_MX.editor.publicar.errorRevision}</p>
              <Button onClick={() => void abrir()} className="self-start">
                {es_MX.comun.reintentar}
              </Button>
            </div>
          ) : null}

          {(estado === "listo" || estado === "publicando" || estado === "error-publicar") && preflight ? (
            <div className="flex flex-col gap-4">
              {error ? (
                <p role="status" className="text-ui-eyebrow text-ui-ink-muted">
                  {error}
                </p>
              ) : (
                <p className="text-ui-body text-ui-ink">{es_MX.editor.publicar.antesDePublicar}</p>
              )}
              {preflight.blockers.length === 0 && preflight.warnings.length === 0 ? (
                <p className="text-ui-body text-ui-ink">{es_MX.editor.publicar.sinPendientes}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {preflight.blockers.map((b, i) => (
                    <li key={`b-${i}`} className="flex items-start justify-between gap-3 rounded-ui-control bg-red-50 p-2.5">
                      <span className="flex items-start gap-2 text-ui-aux text-ui-ink">
                        <span aria-hidden="true" className="text-ui-danger">
                          ✗
                        </span>
                        {textoHallazgo(b)}
                      </span>
                      <button
                        type="button"
                        onClick={() => irAlBloque(b)}
                        className="shrink-0 whitespace-nowrap text-ui-aux font-semibold text-ui-accent underline"
                      >
                        {es_MX.editor.publicar.completar}
                      </button>
                    </li>
                  ))}
                  {preflight.warnings.map((w, i) => (
                    <li key={`w-${i}`} className="flex items-start justify-between gap-3 rounded-ui-control bg-ui-bg-alt p-2.5">
                      <span className="flex items-start gap-2 text-ui-aux text-ui-ink">
                        <span aria-hidden="true" className="text-ui-warning">
                          ⚠
                        </span>
                        {textoHallazgo(w)}
                      </span>
                      <button
                        type="button"
                        onClick={() => irAlBloque(w)}
                        className="shrink-0 whitespace-nowrap text-ui-aux font-semibold text-ui-accent underline"
                      >
                        {es_MX.editor.publicar.editar}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {estado === "error-publicar" ? (
                <p role="alert" className="text-ui-aux text-ui-danger">
                  {error ?? es_MX.editor.publicar.errorPublicar}
                </p>
              ) : null}

              <div className="mt-1 flex justify-end gap-2 border-t border-ui-border pt-4">
                <Dialog.Close asChild>
                  <Button variant="secondary" disabled={estado === "publicando"}>
                    {es_MX.editor.publicar.cancelar}
                  </Button>
                </Dialog.Close>
                <Button
                  data-testid="confirmar-publicar"
                  busy={estado === "publicando"}
                  disabled={preflight.blockers.length > 0 || estado === "publicando"}
                  onClick={() => void confirmar()}
                >
                  {estado === "publicando" ? es_MX.editor.publicar.publicando : es_MX.editor.publicar.confirmar}
                </Button>
              </div>
            </div>
          ) : null}

          {estado === "publicado" && resultado ? (
            <div className="flex flex-col gap-4">
              <p className="text-ui-body text-ui-ink">✅ Tu invitación ya se puede ver en internet.</p>
              <div className="flex items-center gap-2 rounded-ui-control border border-ui-border-field bg-ui-bg-alt p-2.5">
                <span className="flex-1 truncate text-ui-aux text-ui-ink" data-testid="enlace-publicado">
                  {resultado.publicUrl}
                </span>
                <Button size="sm" variant="secondary" onClick={() => void copiarEnlace()} data-testid="copiar-enlace">
                  {copiado ? es_MX.editor.publicar.enlaceCopiado : es_MX.editor.publicar.copiarEnlace}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={resultado.publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center rounded-ui-pill px-4 text-ui-aux font-semibold text-ui-accent shadow-[inset_0_0_0_1px_var(--color-ui-accent-hover)] hover:bg-ui-accent-soft"
                >
                  {es_MX.editor.publicar.verComoInvitado} ↗
                </a>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(resultado.publicUrl)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center rounded-ui-pill px-4 text-ui-aux font-semibold text-ui-accent hover:text-ui-accent-link"
                >
                  {es_MX.editor.publicar.compartirWhatsapp} ↗
                </a>
              </div>
              <p className="text-ui-eyebrow text-ui-ink-muted">{es_MX.editor.publicar.publicadaEl(formatearFecha(resultado.publishedAt))}</p>

              <div className="flex flex-col gap-2 border-t border-ui-border pt-3.5">
                {accionEnlace === "despublicada" ? (
                  <p role="status" className="text-ui-aux text-ui-ink">
                    {es_MX.editor.publicar.despublicada}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={accionEnlace === "despublicando" || accionEnlace === "rotando"}
                      aria-busy={accionEnlace === "despublicando" || undefined}
                      onClick={() => {
                        if (window.confirm(es_MX.editor.publicar.confirmarDespublicar)) void despublicar();
                      }}
                      className="text-ui-eyebrow font-semibold text-ui-danger underline disabled:opacity-50"
                    >
                      {accionEnlace === "despublicando" ? es_MX.editor.publicar.despublicando : es_MX.editor.publicar.despublicar}
                    </button>
                    <button
                      type="button"
                      disabled={accionEnlace === "despublicando" || accionEnlace === "rotando"}
                      aria-busy={accionEnlace === "rotando" || undefined}
                      onClick={() => {
                        if (window.confirm(es_MX.editor.publicar.confirmarRotar)) void rotarEnlace();
                      }}
                      className="text-ui-eyebrow font-semibold text-ui-ink-muted underline disabled:opacity-50"
                    >
                      {accionEnlace === "rotando" ? es_MX.editor.publicar.rotando : es_MX.editor.publicar.rotarEnlace}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
