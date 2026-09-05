"use client";

// components/fields/AudioField.tsx — campo del tipo de bloque `audio` (música de fondo). Sin recorte
// (no aplica a audio) ni `alt` (`AudioValue` solo lleva `assetId`, `esquema/blocks.ts`).
import { useRef, useState } from "react";
import type { AudioSpec, AudioValue } from "@/lib/block-types.ts";
import { uploadAsset } from "@/lib/api-client.ts";
import { Progress } from "@/components/ui/progress.tsx";
import { FieldShell, describedByPara } from "./FieldShell.tsx";
import { mensajeDeErrorDeAsset } from "./ImageField.tsx";

const TIPO_ACEPTADO = "audio/mpeg";

export interface AudioFieldProps {
  id: string;
  invitationId: number;
  spec: AudioSpec;
  value: { url: string } | null;
  esContenidoDeEjemplo?: boolean;
  onCommit: (value: AudioValue) => void;
}

export function AudioField({ id, invitationId, spec, value, esContenidoDeEjemplo, onCommit }: AudioFieldProps) {
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const describedBy = describedByPara(id, { help: spec.help?.["es-MX"], error: error ?? undefined });

  async function alElegirArchivo(archivo: File): Promise<void> {
    setError(null);
    if (archivo.type !== TIPO_ACEPTADO) {
      setError("Formato no admitido. Usa un archivo MP3.");
      return;
    }
    if (archivo.size > spec.constraints.maxBytes) {
      const mb = (spec.constraints.maxBytes / (1024 * 1024)).toFixed(0);
      setError(`Este audio pesa más de ${mb} MB.`);
      return;
    }
    setSubiendo(true);
    setProgreso(20);
    try {
      const subida = await uploadAsset(invitationId, { data: archivo, contentType: TIPO_ACEPTADO, bytes: archivo.size, filename: archivo.name });
      setProgreso(100);
      onCommit({ kind: "audio", assetId: subida.assetId });
    } catch (e: unknown) {
      setError(mensajeDeErrorDeAsset(e));
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <FieldShell id={id} label={spec.label["es-MX"]} help={spec.help?.["es-MX"]} required={spec.required} esContenidoDeEjemplo={esContenidoDeEjemplo} error={error ?? undefined}>
      <div id={id} aria-describedby={describedBy} className="flex flex-col gap-2.5">
        {value ? (
          <audio controls src={value.url} className="h-10 w-full" />
        ) : (
          <p className="text-ui-body text-ui-ink-muted">Sin música de fondo.</p>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="h-9 self-start rounded-ui-pill border border-ui-border-field px-3.5 text-ui-aux font-semibold text-ui-ink hover:bg-ui-bg-alt"
        >
          {value ? "Cambiar audio" : "Elegir audio"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="audio/mpeg"
          className="sr-only"
          aria-label={`Elegir archivo para ${spec.label["es-MX"]}`}
          onChange={(e) => {
            const archivo = e.target.files?.[0];
            if (archivo) void alElegirArchivo(archivo);
            e.target.value = "";
          }}
        />
        {subiendo ? <Progress value={progreso} label="Subiendo audio" /> : null}
      </div>
    </FieldShell>
  );
}
