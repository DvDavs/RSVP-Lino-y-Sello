"use client";

// components/invitados/PegarLista.tsx — el panel de pegado de lista del wireframe §B3.2: primero
// `:preview` (nunca escribe), enseña listos/con-problema y el error POR RENGLÓN con su sugerencia, y
// solo entonces ofrece `:import`. Nunca un «formato inválido» a secas (contrato §1).
import { useState } from "react";
import { Button, Sheet, Textarea, toast } from "@invitaciones/ui";
import { IconoAviso } from "@invitaciones/icons";
import { ApiError, SessionError } from "@/lib/api-client";
import {
  importGuestsPaste,
  previewGuestsPaste,
  type GuestImportResponse,
  type GuestItem,
  type GuestPreviewResponse,
} from "@/lib/invitados/api";
import { textosInvitados as t } from "@/lib/invitados/textos";
import { es_MX } from "@/lib/i18n";

function mensajeDeError(error: unknown): string {
  if (error instanceof ApiError) return error.message || es_MX.errores.generico;
  if (error instanceof SessionError) return es_MX.errores.sesionInvalida;
  return es_MX.errores.generico;
}

export interface PegarListaProps {
  readonly invitationId: number;
  readonly onImportados: (creados: readonly GuestItem[]) => void;
}

export function PegarLista({ invitationId, onImportados }: PegarListaProps) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [vista, setVista] = useState<GuestPreviewResponse | null>(null);
  const [revisando, setRevisando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  function reiniciar(): void {
    setTexto("");
    setVista(null);
    setErrorLocal(null);
  }

  async function revisar(): Promise<void> {
    if (texto.trim().length === 0) {
      setErrorLocal(t.pegarLista.listaVacia);
      return;
    }
    setErrorLocal(null);
    setRevisando(true);
    try {
      const resultado = await previewGuestsPaste(invitationId, texto);
      setVista(resultado);
    } catch (error) {
      toast({ variante: "error", descripcion: mensajeDeError(error) });
    } finally {
      setRevisando(false);
    }
  }

  async function importar(): Promise<void> {
    setImportando(true);
    try {
      const resultado: GuestImportResponse = await importGuestsPaste(invitationId, texto);
      toast({ variante: "exito", descripcion: t.pegarLista.importados(resultado.ready.length) });
      onImportados(resultado.ready);
      setAbierto(false);
      reiniciar();
    } catch (error) {
      toast({ variante: "error", descripcion: mensajeDeError(error) });
    } finally {
      setImportando(false);
    }
  }

  return (
    <Sheet
      open={abierto}
      onOpenChange={(nuevo) => {
        setAbierto(nuevo);
        if (!nuevo) reiniciar();
      }}
      trigger={<Button variant="secundario">{t.pegarLista.tituloBoton}</Button>}
      title={t.pegarLista.titulo}
      description={t.pegarLista.descripcion}
      busy={revisando || importando}
      footer={
        vista ? (
          <>
            <Button variant="secundario" onClick={() => setVista(null)} disabled={importando}>
              {t.pegarLista.volver}
            </Button>
            <Button
              disabled={vista.ready.length === 0}
              loading={importando}
              loadingText={t.pegarLista.agregando}
              onClick={() => void importar()}
            >
              {t.pegarLista.agregarListos(vista.ready.length)}
            </Button>
          </>
        ) : (
          <Button loading={revisando} loadingText={t.pegarLista.revisando} onClick={() => void revisar()}>
            {t.pegarLista.revisar}
          </Button>
        )
      }
    >
      {vista ? (
        <div className="grid gap-4">
          <p className="label-md text-ui-ink">{t.pegarLista.vistaPrevia(vista.ready.length, vista.problems.length)}</p>
          {vista.problems.length > 0 ? (
            <ul className="grid gap-2">
              {vista.problems.map((problema) => (
                <li key={`${problema.line}-${problema.raw}`} className="flex items-start gap-2 rounded-ui-control bg-ui-danger-soft p-3 text-sm text-ui-on-danger-soft">
                  <IconoAviso size={18} tone="mono" className="mt-0.5 shrink-0" aria-hidden />
                  <span>
                    <strong>{t.pegarLista.renglon(problema.line)}</strong> {problema.message} {problema.hint}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-2">
          <Textarea
            value={texto}
            onChange={(evento) => {
              setTexto(evento.target.value);
              if (errorLocal) setErrorLocal(null);
            }}
            placeholder={t.pegarLista.placeholder}
            rows={8}
            invalido={Boolean(errorLocal)}
            aria-invalid={Boolean(errorLocal) || undefined}
            aria-describedby={errorLocal ? "pegar-lista-error" : undefined}
          />
          {errorLocal ? (
            <p id="pegar-lista-error" role="alert" className="text-[12.5px] font-semibold text-ui-danger-text">
              {errorLocal}
            </p>
          ) : null}
        </div>
      )}
    </Sheet>
  );
}
