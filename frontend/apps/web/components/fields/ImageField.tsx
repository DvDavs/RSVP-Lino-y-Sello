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
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import "react-image-crop/dist/ReactCrop.css";
import type { Crop, PercentCrop } from "react-image-crop";
import type { ImageSpec, ImageValue } from "@/lib/block-types.ts";
import { uploadAsset } from "@/lib/api-client.ts";
import { ApiError } from "@/lib/errors.ts";
import { cargarImagenDesdeArchivo, proporcionParaAspect, recortarAWebp, recorteCentradoConProporcion, textoFocal, RECORTE_COMPLETO } from "@/lib/crop.ts";
import { Progress } from "@/components/ui/progress.tsx";
import { CLASES_CONTROL, FieldShell, describedByPara } from "./FieldShell.tsx";

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

type Fase = "reposo" | "recortando" | "subiendo";

export function ImageField({ id, invitationId, spec, esDecorativo, value, esContenidoDeEjemplo, onCommit }: ImageFieldProps) {
  const [fase, setFase] = useState<Fase>("reposo");
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewOptimista, setPreviewOptimista] = useState<string | null>(null);
  const [archivoOriginal, setArchivoOriginal] = useState<{ imagen: HTMLImageElement; url: string } | null>(null);
  const [crop, setCrop] = useState<Crop>({ unit: "%", ...RECORTE_COMPLETO });
  const inputArchivoRef = useRef<HTMLInputElement | null>(null);
  const proporcion = proporcionParaAspect(spec.constraints.aspect);

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
    void cargarImagenDesdeArchivo(archivo).then(({ imagen, url }) => {
      setArchivoOriginal({ imagen, url });
      setCrop({
        unit: "%",
        ...(proporcion ? recorteCentradoConProporcion(proporcion, imagen.naturalWidth, imagen.naturalHeight) : RECORTE_COMPLETO),
      });
      setFase("recortando");
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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void confirmarRecorte()}
              disabled={fase !== "recortando"}
              className="h-10 rounded-ui-pill bg-ui-accent px-4 text-ui-aux font-semibold text-ui-accent-ink"
            >
              Usar esta foto
            </button>
            <button
              type="button"
              onClick={() => {
                URL.revokeObjectURL(archivoOriginal.url);
                setArchivoOriginal(null);
                setFase("reposo");
              }}
              className="h-10 rounded-ui-pill border border-ui-border-field px-4 text-ui-aux font-semibold text-ui-ink"
            >
              Cancelar
            </button>
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
      error={error ?? undefined}
    >
      <div id={id} aria-describedby={describedBy} className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          {previewOptimista || value?.url ? (
            <img src={previewOptimista ?? value?.url} alt="" className="size-20 shrink-0 rounded-ui-media object-cover" />
          ) : (
            <div className="flex size-20 shrink-0 items-center justify-center rounded-ui-media bg-ui-bg-alt text-ui-eyebrow text-ui-ink-muted">
              Sin foto
            </div>
          )}
          <button
            type="button"
            onClick={() => inputArchivoRef.current?.click()}
            className="h-9 rounded-ui-pill border border-ui-border-field px-3.5 text-ui-aux font-semibold text-ui-ink hover:bg-ui-bg-alt"
          >
            {value ? "Cambiar foto" : "Elegir foto"}
          </button>
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

        {fase === "subiendo" ? <Progress value={progreso} label="Subiendo foto" /> : null}

        {!esDecorativo ? (
          <div>
            <label htmlFor={`${id}-alt`} className="text-ui-eyebrow font-semibold text-ui-ink">
              Texto alternativo
            </label>
            <p className="mb-1 text-ui-eyebrow text-ui-ink-muted">
              Describe la foto para quien no puede verla, p. ej. «Ana y Luis abrazados frente al mar».
            </p>
            <input
              id={`${id}-alt`}
              type="text"
              className={CLASES_CONTROL}
              aria-invalid={Boolean(formState.errors.alt) || undefined}
              {...register("alt", { onChange: () => void alCambiarAlt() })}
            />
            {formState.errors.alt ? (
              <p role="alert" className="mt-1 text-ui-eyebrow text-ui-danger">
                {formState.errors.alt.message}
              </p>
            ) : null}
          </div>
        ) : null}

        {value ? (
          <div className="flex flex-col gap-2">
            <span className="text-ui-eyebrow font-semibold text-ui-ink">Punto focal</span>
            <p className="text-ui-eyebrow text-ui-ink-muted">
              Qué parte de la foto se conserva siempre visible, aunque el marco cambie de forma.
            </p>
            <label className="flex items-center gap-2 text-ui-eyebrow text-ui-ink-muted">
              Horizontal
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(value.focal.x * 100)}
                aria-valuetext={textoFocal(value.focal.x, value.focal.y)}
                onChange={(e) => alMoverFocal("x", Number(e.target.value) / 100)}
                className="flex-1"
              />
            </label>
            <label className="flex items-center gap-2 text-ui-eyebrow text-ui-ink-muted">
              Vertical
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(value.focal.y * 100)}
                aria-valuetext={textoFocal(value.focal.x, value.focal.y)}
                onChange={(e) => alMoverFocal("y", Number(e.target.value) / 100)}
                className="flex-1"
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
