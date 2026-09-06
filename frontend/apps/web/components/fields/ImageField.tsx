"use client";

// components/fields/ImageField.tsx — campo del tipo de bloque `image` (04 §13): elegir archivo,
// validar tipo/tamaño ANTES de subir, recortar con proporción fija (`react-image-crop@11.1.2`, único
// dentro del panel — nunca en `/i/[publicToken]`, §16), subir con cuerpo binario crudo y fijar el
// punto focal. El recorte es DESTRUCTIVO por decisión ya tomada (§13.3): no se guarda el rectángulo.
//
// `assetId` NO viaja en `ComposedDocument` (`contratos.md §3`: la URL ya llega resuelta en
// `ResolvedValue`). Por eso este campo recibe el `assetId` CRUDO por separado (de
// `document.content[blockId]`, lo arma `BlockForm`/`GroupItemFields`) además del `url` ya resuelto
// para la miniatura — nunca lo inventa ni lo deriva de la URL.
import { zodResolver } from "@hookform/resolvers/zod";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import "react-image-crop/dist/ReactCrop.css";
import type { Crop, PercentCrop } from "react-image-crop";
import type { ImageSpec, ImageValue } from "@/lib/block-types.ts";
import { uploadAsset } from "@/lib/api-client.ts";
import { ApiError } from "@/lib/errors.ts";
import { cargarImagenDesdeArchivo, proporcionParaAspect, recortarAWebp, recorteCentradoConProporcion, textoFocal, RECORTE_COMPLETO } from "@/lib/crop.ts";
import { Button, Input, ProgressRing } from "@invitaciones/ui";
import { IconoError, IconoRecortar, IconoSubir } from "@invitaciones/icons";
import { es_MX } from "@/lib/i18n.ts";
import { FieldShell, describedByPara, idsAyudaError } from "./FieldShell.tsx";

const ReactCrop = dynamic(() => import("react-image-crop").then((m) => m.default), { ssr: false });

const TIPOS_ACEPTADOS = ["image/webp", "image/png", "image/jpeg"] as const;

export interface ImageFieldValue {
  assetId: string;
  url: string;
  alt: string;
  focal: { x: number; y: number };
}

export interface ImageFieldProps {
  id: string;
  invitationId: number;
  spec: ImageSpec;
  /** `role === "decorative"` viene del rol del bloque (`esquema/blocks.ts` `BlockRole`), no del spec. */
  esDecorativo?: boolean;
  value: ImageFieldValue | null;
  esContenidoDeEjemplo?: boolean;
  onCommit: (value: ImageValue) => void;
}

// `preparando` es NUEVO (U-7): leer y decodificar un JPG de 27 MB del móvil tarda, y hasta ahora
// durante ese rato no se veía absolutamente nada — «no pasa nada visible» era literal.
type Fase = "reposo" | "preparando" | "recortando" | "subiendo";

export function ImageField({ id, invitationId, spec, esDecorativo, value, esContenidoDeEjemplo, onCommit }: ImageFieldProps) {
  const [fase, setFase] = useState<Fase>("reposo");
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewOptimista, setPreviewOptimista] = useState<string | null>(null);
  const [archivoOriginal, setArchivoOriginal] = useState<{ imagen: HTMLImageElement; url: string } | null>(null);
  const [crop, setCrop] = useState<Crop>({ unit: "%", ...RECORTE_COMPLETO });
  const inputArchivoRef = useRef<HTMLInputElement | null>(null);
  const errorRef = useRef<HTMLParagraphElement | null>(null);
  const proporcion = proporcionParaAspect(spec.constraints.aspect);
  const mbMaximos = Math.round(spec.constraints.maxBytes / (1024 * 1024));

  /**
   * U-7 — «la foto demasiado grande falla en silencio». El mensaje existía y era bueno, pero se
   * pintaba al FINAL del `FieldShell` (por debajo del texto alternativo y de los dos deslizadores
   * del punto focal): medido en `y=928` con la ventana en 900, **28 px por debajo del borde
   * visible** y lejos del botón que falló. La clienta no vio nada y volvió a intentarlo con el mismo
   * archivo. Ahora el mensaje se pinta pegado al control y el panel se desplaza hasta él.
   *
   * `focus()` además de `scrollIntoView()`: si el panel ya lo tenía a la vista no habría
   * desplazamiento, y quien usa lector de pantalla necesita que el foco llegue al mensaje (el
   * `role="alert"` lo anuncia, el foco lo deja donde se puede releer). No roba el foco si no hay
   * error.
   */
  useEffect(() => {
    if (!error) return;
    const nodo = errorRef.current;
    if (!nodo) return;
    // `scrollIntoView` no existe en todos los entornos (jsdom, algunos navegadores incrustados):
    // si falta, el foco por sí solo ya lleva la vista al mensaje.
    nodo.scrollIntoView?.({ block: "center", behavior: "smooth" });
    nodo.focus({ preventScroll: true });
  }, [error]);

  const { register, formState, trigger, getValues } = useForm({
    resolver: zodResolver(
      z.object({
        alt: esDecorativo
          ? z.string().max(200).optional()
          : z.string().min(1, "Describe la foto para quien no puede verla.").max(200, "Como máximo 200 caracteres."),
      }),
    ),
    defaultValues: { alt: value?.alt ?? "" },
    mode: "onChange",
  });

  function alElegirArchivo(archivo: File): void {
    setError(null);
    if (!(TIPOS_ACEPTADOS as readonly string[]).includes(archivo.type)) {
      setError("Formato no admitido. Usa una foto JPG, PNG o WebP.");
      return;
    }
    if (archivo.size > spec.constraints.maxBytes) {
      const mb = (spec.constraints.maxBytes / (1024 * 1024)).toFixed(0);
      setError(`Esta foto pesa más de ${mb} MB. Elige otra o recórtala antes de subirla.`);
      return;
    }
    setFase("preparando");
    setProgreso(5);
    void cargarImagenDesdeArchivo(archivo)
      .then(({ imagen, url }) => {
        setArchivoOriginal({ imagen, url });
        setCrop({
          unit: "%",
          ...(proporcion ? recorteCentradoConProporcion(proporcion, imagen.naturalWidth, imagen.naturalHeight) : RECORTE_COMPLETO),
        });
        setFase("recortando");
      })
      .catch(() => {
        // Un archivo que el navegador no puede decodificar (renombrado, corrupto) tampoco puede
        // fallar en silencio.
        setFase("reposo");
        setError("No pudimos abrir esa foto. Prueba con otra en JPG, PNG o WebP.");
      });
  }

  async function confirmarRecorte(): Promise<void> {
    if (!archivoOriginal) return;
    setFase("subiendo");
    setError(null);
    setProgreso(10);
    try {
      const blob = await recortarAWebp(archivoOriginal.imagen, crop as PercentCrop);
      setProgreso(50);
      setPreviewOptimista(URL.createObjectURL(blob));
      const subida = await uploadAsset(invitationId, { data: blob, contentType: "image/webp", bytes: blob.size, filename: "foto.webp" });
      setProgreso(100);
      const altActual = getValues("alt") ?? "";
      onCommit({ kind: "image", assetId: subida.assetId, alt: esDecorativo ? "" : altActual, focal: value?.focal ?? { x: 0.5, y: 0.5 } });
      URL.revokeObjectURL(archivoOriginal.url);
      setArchivoOriginal(null);
      setFase("reposo");
    } catch (e: unknown) {
      setFase("reposo");
      setError(mensajeDeErrorDeAsset(e));
    }
  }

  async function alCambiarAlt(): Promise<void> {
    const ok = await trigger("alt");
    if (!ok || !value) return;
    onCommit({ kind: "image", assetId: value.assetId, alt: getValues("alt") ?? "", focal: value.focal });
  }

  function alMoverFocal(eje: "x" | "y", nuevo: number): void {
    if (!value) return;
    onCommit({ kind: "image", assetId: value.assetId, alt: value.alt, focal: { ...value.focal, [eje]: nuevo } });
  }

  const describedBy = describedByPara(id, { help: spec.help?.["es-MX"], error: error ?? undefined });

  if (fase === "recortando" && archivoOriginal) {
    return (
      <FieldShell id={id} label={spec.label["es-MX"]} required={spec.required}>
        <div className="flex flex-col gap-3">
          <ReactCrop crop={crop} onChange={(_px, percent) => setCrop(percent)} aspect={proporcion} ruleOfThirds>
            <img src={archivoOriginal.url} alt="" className="max-h-96 w-auto" />
          </ReactCrop>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void confirmarRecorte()} disabled={fase !== "recortando"}>
              <IconoRecortar size={18} tone="mono" />
              {es_MX.editor.fotos.usarEstaFoto}
            </Button>
            <Button
              variant="terciario"
              size="sm"
              onClick={() => {
                URL.revokeObjectURL(archivoOriginal.url);
                setArchivoOriginal(null);
                setFase("reposo");
              }}
            >
              {es_MX.comun.cancelar}
            </Button>
          </div>
        </div>
      </FieldShell>
    );
  }

  return (
    <FieldShell
      id={id}
      label={spec.label["es-MX"]}
      help={spec.help?.["es-MX"]}
      required={spec.required}
      esContenidoDeEjemplo={esContenidoDeEjemplo}
      // El error NO se delega al pie del `FieldShell` (ahí es donde quedaba fuera de pantalla,
      // U-7): se pinta abajo, pegado al botón que falló, con el mismo `id` para que
      // `aria-describedby` siga apuntando al nodo correcto.
    >
      <div id={id} aria-describedby={describedBy} className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          {previewOptimista || value?.url ? (
            <img src={previewOptimista ?? value?.url} alt="" className="size-20 shrink-0 rounded-ui-media object-cover" />
          ) : (
            <div className="flex size-20 shrink-0 items-center justify-center rounded-ui-media bg-ui-surface-alt text-xs text-ui-ink-muted">
              {es_MX.editor.fotos.sinFoto}
            </div>
          )}
          <Button variant="secundario" size="sm" onClick={() => inputArchivoRef.current?.click()}>
            <IconoSubir size={18} tone="mono" />
            {value ? es_MX.editor.fotos.cambiarFoto : es_MX.editor.fotos.elegirFoto}
          </Button>
          <input
            ref={inputArchivoRef}
            type="file"
            accept={TIPOS_ACEPTADOS.join(",")}
            className="sr-only"
            aria-label={`Elegir archivo para ${spec.label["es-MX"]}`}
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) alElegirArchivo(archivo);
              e.target.value = "";
            }}
          />
        </div>

        {/* U-7 · el mismo pie que la galería ya tenía en su zona de soltar y que a «Cambiar foto» le
            faltaba: la asimetría explicaba la sorpresa (la galería avisa ANTES del límite; esta no
            decía nada de formatos ni de peso). */}
        <p className="text-xs text-ui-ink-muted">{es_MX.editor.foto.limites(mbMaximos)}</p>

        {/* U-7 · el error, pegado al control que falló. */}
        {error ? (
          <p
            id={idsAyudaError(id).errorId}
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="flex items-start gap-1.5 rounded-ui-control bg-ui-danger-soft p-2.5 text-xs font-semibold text-ui-on-danger-soft"
          >
            <IconoError size={16} tone="mono" className="mt-px shrink-0" />
            {error}
          </p>
        ) : null}

        {fase === "subiendo" || fase === "preparando" ? (
          <div className="flex items-center gap-3">
            <ProgressRing
              value={progreso}
              size={56}
              label={fase === "preparando" ? es_MX.editor.fotos.preparando : es_MX.editor.foto.subiendo}
            />
            <span className="text-sm text-ui-ink-muted">
              {fase === "preparando" ? es_MX.editor.fotos.preparando : es_MX.editor.foto.subiendo}
            </span>
          </div>
        ) : null}

        {!esDecorativo ? (
          <div>
            <label htmlFor={`${id}-alt`} className="text-sm font-semibold text-ui-ink">
              {es_MX.editor.fotos.textoAlternativo}
            </label>
            <p className="mb-1 text-xs text-ui-ink-muted">{es_MX.editor.fotos.ayudaTextoAlternativo}</p>
            <Input
              id={`${id}-alt`}
              type="text"
              aria-invalid={Boolean(formState.errors.alt) || undefined}
              {...register("alt", { onChange: () => void alCambiarAlt() })}
            />
            {formState.errors.alt ? (
              <p role="alert" className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-ui-danger-text">
                <IconoError size={16} tone="mono" className="shrink-0" />
                {formState.errors.alt.message}
              </p>
            ) : null}
          </div>
        ) : null}

        {value ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-ui-ink">{es_MX.editor.fotos.puntoFocal}</span>
            <p className="text-xs text-ui-ink-muted">{es_MX.editor.fotos.ayudaPuntoFocal}</p>
            <label className="flex items-center gap-2 text-xs text-ui-ink-muted">
              {es_MX.editor.fotos.horizontal}
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(value.focal.x * 100)}
                aria-valuetext={textoFocal(value.focal.x, value.focal.y)}
                onChange={(e) => alMoverFocal("x", Number(e.target.value) / 100)}
                className="h-11 flex-1 accent-ui-primary"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-ui-ink-muted">
              {es_MX.editor.fotos.vertical}
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(value.focal.y * 100)}
                aria-valuetext={textoFocal(value.focal.x, value.focal.y)}
                onChange={(e) => alMoverFocal("y", Number(e.target.value) / 100)}
                className="h-11 flex-1 accent-ui-primary"
              />
            </label>
          </div>
        ) : null}
      </div>
    </FieldShell>
  );
}

export function mensajeDeErrorDeAsset(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "TPL_ASSET_TOO_LARGE":
        return "Esta foto pesa más de lo permitido. Elige otra o recórtala antes de subirla.";
      case "TPL_ASSET_TYPE_UNSUPPORTED":
        return "Formato no admitido. Usa una foto JPG, PNG o WebP.";
      case "TPL_ASSET_QUOTA_EXCEEDED":
        return "Has alcanzado el límite de fotos de esta invitación.";
      case "TPL_ASSET_STORAGE_UNAVAILABLE":
        return "No pudimos guardar la foto en este momento. Inténtalo de nuevo en unos minutos.";
      default:
        return error.message;
    }
  }
  return error instanceof Error ? error.message : "No pudimos subir la foto.";
}
