"use client";

// components/invitados/FormularioInvitado.tsx — alta y edición (ui-formulario: react-hook-form +
// Zod, envío con botón). Los cupos de niños/jóvenes SOLO se ofrecen si `rules` de `GET …/summary`
// los permite: ofrecer un campo que el backend va a rechazar (`422 GUEST_QUOTA_EXCEEDED`) es una
// trampa. El borrado vive AQUÍ, como una segunda pantalla del mismo diálogo (nunca un tercer botón
// suelto en la tabla/tarjeta que el wireframe §B3.2 no dibuja).
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactNode } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { z } from "zod";
import { Button, Dialog, Field, Input, toast } from "@invitaciones/ui";
import { ApiError, SessionError } from "@/lib/api-client";
import { createGuest, deleteGuest, updateGuest, type EventRules, type GuestItem, type GuestUpsertInput } from "@/lib/invitados/api";
import { textosInvitados as t } from "@/lib/invitados/textos";
import { es_MX } from "@/lib/i18n";
import { nombreVisible } from "./utilidades";

// Los campos numéricos se quedan como `string` en el esquema (lo que un `<input>` de verdad manda):
// `z.coerce.number()` cambia el tipo de ENTRADA a `unknown` y choca con `useForm<Valores>` (RHF
// necesita que la entrada y la salida del resolver sean el mismo tipo). Se valida el patrón aquí y
// se convierte a número a mano en `alValido`, ya validado.
const NUMERO_ENTERO = /^\d+$/;
function numeroOVacio(valor: string): boolean {
  return valor.trim() === "" || NUMERO_ENTERO.test(valor.trim());
}

const esquema = z.object({
  fullName: z.string().trim().min(1, t.formulario.faltaNombre),
  email: z.union([z.literal(""), z.string().trim().email(t.formulario.correoInvalido)]),
  phone: z.string().trim(),
  tableNumber: z.string().refine(numeroOVacio, t.formulario.numeroInvalido),
  adults: z.string().refine(numeroOVacio, t.formulario.numeroInvalido),
  children: z.string().refine(numeroOVacio, t.formulario.numeroInvalido),
  young: z.string().refine(numeroOVacio, t.formulario.numeroInvalido),
});

type Valores = z.infer<typeof esquema>;

function aEntero(valor: string): number {
  const limpio = valor.trim();
  return limpio === "" ? 0 : Number.parseInt(limpio, 10);
}

const ORDEN_CAMPOS = ["fullName", "email", "phone", "tableNumber", "adults", "children", "young"] as const;

function mensajeDeError(error: unknown): string {
  if (error instanceof ApiError) return error.message || es_MX.errores.generico;
  if (error instanceof SessionError) return es_MX.errores.sesionInvalida;
  return es_MX.errores.generico;
}

function valoresIniciales(guest?: GuestItem): Valores {
  return {
    fullName: guest?.fullName ?? "",
    email: guest?.email ?? "",
    phone: guest?.phone ?? "",
    tableNumber: guest?.tableNumber != null ? String(guest.tableNumber) : "",
    adults: String(guest?.adults ?? 1),
    children: String(guest?.children ?? 0),
    young: String(guest?.young ?? 0),
  };
}

export interface FormularioInvitadoProps {
  readonly invitationId: number;
  readonly rules: EventRules;
  /** Presente = edición; ausente = alta. */
  readonly guest?: GuestItem;
  readonly trigger: ReactNode;
  readonly onGuardado: (guest: GuestItem) => void;
  readonly onEliminado?: (guestId: number) => void;
}

export function FormularioInvitado({ invitationId, rules, guest, trigger, onGuardado, onEliminado }: FormularioInvitadoProps) {
  const [abierto, setAbierto] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const esEdicion = Boolean(guest);

  const { register, handleSubmit, formState, setFocus, reset } = useForm<Valores>({
    resolver: zodResolver(esquema),
    mode: "onChange",
    defaultValues: valoresIniciales(guest),
  });

  function alAbrirCambiar(nuevoAbierto: boolean): void {
    setAbierto(nuevoAbierto);
    if (nuevoAbierto) {
      reset(valoresIniciales(guest));
      setConfirmandoBorrado(false);
    }
  }

  function alInvalido(errores: FieldErrors<Valores>): void {
    const primero = ORDEN_CAMPOS.find((campo) => errores[campo]);
    if (primero) setFocus(primero);
  }

  async function alValido(valores: Valores): Promise<void> {
    const cuerpo: GuestUpsertInput = {
      fullName: valores.fullName.trim(),
      email: valores.email ? valores.email.trim() : undefined,
      phone: valores.phone.trim() ? valores.phone.trim() : undefined,
      tableNumber: valores.tableNumber.trim() === "" ? undefined : aEntero(valores.tableNumber),
      adults: aEntero(valores.adults),
      children: rules.childrenAllowed ? aEntero(valores.children) : undefined,
      young: rules.youngAllowed ? aEntero(valores.young) : undefined,
    };
    try {
      const guardado = guest ? await updateGuest(invitationId, guest.id, cuerpo) : await createGuest(invitationId, cuerpo);
      toast({ variante: "exito", descripcion: guest ? t.formulario.invitadoActualizado : t.formulario.invitadoCreado });
      onGuardado(guardado);
      setAbierto(false);
    } catch (error) {
      toast({ variante: "error", descripcion: mensajeDeError(error) });
    }
  }

  async function alConfirmarBorrado(): Promise<void> {
    if (!guest) return;
    setEliminando(true);
    try {
      await deleteGuest(invitationId, guest.id);
      toast({ variante: "exito", descripcion: t.formulario.invitadoEliminado });
      onEliminado?.(guest.id);
      setAbierto(false);
    } catch (error) {
      toast({ variante: "error", descripcion: mensajeDeError(error) });
    } finally {
      setEliminando(false);
    }
  }

  const nombreActual = guest ? nombreVisible(guest.fullName) : "";

  return (
    <Dialog
      open={abierto}
      onOpenChange={alAbrirCambiar}
      trigger={trigger}
      title={
        confirmandoBorrado
          ? t.formulario.confirmarBorradoTitulo(nombreActual)
          : esEdicion
            ? t.formulario.tituloEdicion
            : t.formulario.tituloAlta
      }
      description={confirmandoBorrado ? t.formulario.confirmarBorradoTexto : esEdicion ? t.formulario.descripcionEdicion : t.formulario.descripcionAlta}
      busy={formState.isSubmitting || eliminando}
      footer={
        confirmandoBorrado ? (
          <>
            <Button variant="secundario" onClick={() => setConfirmandoBorrado(false)} disabled={eliminando}>
              {es_MX.comun.cancelar}
            </Button>
            <Button variant="peligro" loading={eliminando} loadingText={t.formulario.eliminando} onClick={() => void alConfirmarBorrado()}>
              {t.formulario.eliminarInvitado}
            </Button>
          </>
        ) : (
          <>
            {esEdicion ? (
              <Button variant="peligro" className="mr-auto" onClick={() => setConfirmandoBorrado(true)} disabled={formState.isSubmitting}>
                {t.formulario.eliminarInvitado}
              </Button>
            ) : null}
            <Button type="submit" form="formulario-invitado" loading={formState.isSubmitting} loadingText={t.formulario.guardando}>
              {esEdicion ? t.formulario.guardarCambios : t.formulario.guardar}
            </Button>
          </>
        )
      }
    >
      {confirmandoBorrado ? null : (
        <form id="formulario-invitado" className="grid gap-4" onSubmit={handleSubmit(alValido, alInvalido)}>
          <Field label={t.formulario.nombre} required error={formState.errors.fullName?.message}>
            <Input {...register("fullName")} autoComplete="name" />
          </Field>
          <Field label={t.formulario.correo} error={formState.errors.email?.message}>
            <Input {...register("email")} type="email" autoComplete="email" />
          </Field>
          <Field label={t.formulario.telefono} error={formState.errors.phone?.message}>
            <Input {...register("phone")} type="tel" autoComplete="tel" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.formulario.mesa} error={formState.errors.tableNumber?.message}>
              <Input {...register("tableNumber")} type="number" min={1} inputMode="numeric" />
            </Field>
            <Field label={t.formulario.adultos} error={formState.errors.adults?.message}>
              <Input {...register("adults")} type="number" min={0} inputMode="numeric" />
            </Field>
          </div>
          {rules.childrenAllowed || rules.youngAllowed ? (
            <div className="grid grid-cols-2 gap-3">
              {rules.childrenAllowed ? (
                <Field label={t.formulario.ninos} error={formState.errors.children?.message}>
                  <Input {...register("children")} type="number" min={0} inputMode="numeric" />
                </Field>
              ) : null}
              {rules.youngAllowed ? (
                <Field label={t.formulario.jovenes} error={formState.errors.young?.message}>
                  <Input {...register("young")} type="number" min={0} inputMode="numeric" />
                </Field>
              ) : null}
            </div>
          ) : null}
        </form>
      )}
    </Dialog>
  );
}
