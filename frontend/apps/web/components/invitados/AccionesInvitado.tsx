"use client";

// components/invitados/AccionesInvitado.tsx — «Enlace» (Copiar/Ver) y «Compartir» (WhatsApp/Correo)
// de la fila de la tabla y de la tarjeta móvil. El enlace del invitado se pide EN EL MOMENTO de
// compartir (`GET …/guests/{guestId}/link`), nunca al cargar la lista (contrato §0.3): por eso el
// token no vive en ningún estado de la pantalla salvo el de este hook, y solo mientras la persona
// está usando estos botones.
import { useState } from "react";
import { Button, toast } from "@invitaciones/ui";
import { IconoChat, IconoCopiar, IconoCorreo, IconoVer } from "@invitaciones/icons";
import { ApiError, SessionError } from "@/lib/api-client";
import { getGuestLink, sendGuestEmail, type GuestItem, type GuestLink } from "@/lib/invitados/api";
import { textosInvitados as t } from "@/lib/invitados/textos";
import { es_MX } from "@/lib/i18n";
import { nombreVisible } from "./utilidades";

function mensajeDeError(error: unknown): string {
  if (error instanceof ApiError) return error.message || es_MX.errores.generico;
  if (error instanceof SessionError) return es_MX.errores.sesionInvalida;
  return es_MX.errores.generico;
}

/** Trae y cachea el enlace de UN invitado, solo cuando una acción lo necesita. */
function useEnlaceInvitado(invitationId: number, guestId: number) {
  const [enlace, setEnlace] = useState<GuestLink | null>(null);
  const [cargando, setCargando] = useState(false);

  async function asegurar(): Promise<GuestLink | null> {
    if (enlace) return enlace;
    setCargando(true);
    try {
      const traido = await getGuestLink(invitationId, guestId);
      setEnlace(traido);
      return traido;
    } catch (error) {
      toast({ variante: "error", descripcion: `${t.compartir.errorEnlace} ${mensajeDeError(error)}` });
      return null;
    } finally {
      setCargando(false);
    }
  }

  return { enlace, cargando, asegurar };
}

export interface AccionesInvitadoProps {
  readonly invitationId: number;
  readonly guest: GuestItem;
  /** `fila`: botones compactos de la tabla de escritorio. `apilado`: ancho completo, dentro del
   *  `Sheet` móvil (`11 §5`: objetivo de toque >= 44 px, una acción a la vez). */
  readonly disposicion?: "fila" | "apilado";
}

export function BotonesEnlace({ invitationId, guest, disposicion = "fila" }: AccionesInvitadoProps) {
  const { cargando, asegurar } = useEnlaceInvitado(invitationId, guest.id);
  const apilado = disposicion === "apilado";
  const tamano = apilado ? "lg" : "sm";
  const clase = apilado ? "w-full justify-start" : undefined;

  async function copiar(): Promise<void> {
    const traido = await asegurar();
    if (!traido) return;
    try {
      await navigator.clipboard.writeText(traido.url);
      toast({ variante: "exito", descripcion: t.compartir.enlaceCopiado });
    } catch {
      toast({ variante: "error", descripcion: t.compartir.errorEnlace });
    }
  }

  async function ver(): Promise<void> {
    const traido = await asegurar();
    if (!traido) return;
    window.open(traido.url, "_blank", "noreferrer");
  }

  return (
    <div className={apilado ? "grid gap-2" : "flex flex-wrap gap-2"}>
      <Button variant="terciario" size={tamano} className={clase} loading={cargando} onClick={() => void copiar()}>
        <IconoCopiar size={16} tone="mono" aria-hidden />
        {t.compartir.copiarEnlace}
      </Button>
      <Button variant="terciario" size={tamano} className={clase} loading={cargando} onClick={() => void ver()}>
        <IconoVer size={16} tone="mono" aria-hidden />
        {t.compartir.verEnlace}
      </Button>
    </div>
  );
}

export function BotonesCompartir({ invitationId, guest, disposicion = "fila" }: AccionesInvitadoProps) {
  const { cargando, asegurar } = useEnlaceInvitado(invitationId, guest.id);
  const [enviandoCorreo, setEnviandoCorreo] = useState(false);
  const apilado = disposicion === "apilado";
  const tamano = apilado ? "lg" : "sm";
  const clase = apilado ? "w-full justify-start" : undefined;

  async function porWhatsapp(): Promise<void> {
    if (!guest.phone) {
      toast({ variante: "info", descripcion: t.compartir.sinTelefono });
      return;
    }
    const traido = await asegurar();
    if (!traido) return; // `asegurar` ya avisó del fallo de red.
    // `whatsappUrl` puede NO venir en el JSON (`@JsonInclude(NON_NULL)` en `GuestPanelDtos.kt`).
    // Antes esto era un `return` mudo: la clienta pulsaba WhatsApp y no pasaba absolutamente nada.
    if (!traido.whatsappUrl) {
      toast({ variante: "info", descripcion: t.compartir.sinTelefono });
      return;
    }
    window.open(traido.whatsappUrl, "_blank", "noreferrer");
  }

  async function porCorreo(): Promise<void> {
    if (!guest.email) {
      toast({ variante: "info", descripcion: t.compartir.sinCorreo });
      return;
    }
    setEnviandoCorreo(true);
    try {
      await sendGuestEmail(invitationId, guest.id);
      toast({ variante: "exito", descripcion: t.compartir.correoEnviado(nombreVisible(guest.fullName)) });
    } catch (error) {
      toast({ variante: "error", descripcion: mensajeDeError(error) });
    } finally {
      setEnviandoCorreo(false);
    }
  }

  return (
    <div className={apilado ? "grid gap-2" : "flex flex-wrap gap-2"}>
      <Button variant="terciario" size={tamano} className={clase} loading={cargando} onClick={() => void porWhatsapp()}>
        <IconoChat size={16} tone="mono" aria-hidden />
        {t.compartir.botonWhatsapp}
      </Button>
      <Button variant="terciario" size={tamano} className={clase} loading={enviandoCorreo} onClick={() => void porCorreo()}>
        <IconoCorreo size={16} tone="mono" aria-hidden />
        {t.compartir.botonCorreo}
      </Button>
    </div>
  );
}
