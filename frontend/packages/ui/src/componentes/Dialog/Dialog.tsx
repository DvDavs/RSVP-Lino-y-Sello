// packages/ui/src/componentes/Dialog/Dialog.tsx — diálogo modal (`11 §5` fila «Dialog / Sheet»).
// Base Radix (`@radix-ui/react-dialog`): foco atrapado y devuelto al disparador, `role="dialog"`
// `aria-modal="true"` y `aria-labelledby`/`aria-describedby` los fija Radix a partir de `Title` y
// `Description`; por eso este componente exige `title` y `description` como props OBLIGATORIAS
// (nunca opcionales: un diálogo sin nombre o sin descripción accesible es un rechazo automático de
// revisión). Si el texto no debe verse, `descriptionHidden` lo manda a solo-lectores de pantalla sin
// dejar de cumplir `aria-describedby`.
"use client";

import type { JSX, ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { IconoCerrar } from "@invitaciones/icons";
import { twMerge } from "tailwind-merge";

export interface DialogProps {
  readonly open?: boolean;
  readonly defaultOpen?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  /** Disparador. Si se omite, el diálogo se controla por completo con `open`/`onOpenChange`. */
  readonly trigger?: ReactNode;
  /** Título accesible, SIEMPRE visible (`11 §5`: display-md → aquí `heading-md`). */
  readonly title: string;
  /** Descripción accesible. Con `descriptionHidden`, queda solo para lectores de pantalla. */
  readonly description: string;
  readonly descriptionHidden?: boolean;
  /**
   * Estado "ocupado" (`11 §5`): bloquea Esc y el clic fuera mientras hay una operación en curso
   * (publicar, guardar). SIEMPRE debe acompañarse de una explicación visible en `children` o
   * `footer` (`11 §5`: "nunca un control mudo") — este componente no la puede escribir por ti.
   */
  readonly busy?: boolean;
  /** Acciones a la derecha. */
  readonly footer?: ReactNode;
  readonly children?: ReactNode;
  /**
   * Capa modal (por defecto `true`): foco atrapado, `Esc`/clic fuera activos, velo, scroll
   * bloqueado y el RESTO de la página marcada `aria-hidden` + `pointer-events: none` por Radix.
   * `false` deja el mismo panel sin ninguna de esas cuatro cosas: es lo que necesita una VITRINA
   * (la galería `/design/componentes` lo muestra abierto de forma permanente dentro de su ficha, y
   * un modal de verdad ahí dejaría la página entera oculta para lectores de pantalla e
   * inaccesible al ratón). En producto, un diálogo se abre `modal`. */
  readonly modal?: boolean;
  /**
   * Nodo donde se monta el portal. Con `modal={false}` y un contenedor que sea BLOQUE CONTENEDOR
   * (`contain: paint`, `transform`…), el `position: fixed` del panel se resuelve contra ese
   * contenedor y no contra la ventana: así la vitrina encierra al diálogo en su ficha. */
  readonly container?: HTMLElement | null;
  /** Foco automático al abrir. `event.preventDefault()` lo desactiva (vitrina). */
  readonly onOpenAutoFocus?: (evento: Event) => void;
  readonly className?: string;
}

export function Dialog({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  title,
  description,
  descriptionHidden = false,
  busy = false,
  footer,
  children,
  className,
  modal = true,
  container,
  onOpenAutoFocus,
}: DialogProps): JSX.Element {
  return (
    <DialogPrimitive.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange} modal={modal}>
      {trigger ? <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger> : null}
      <DialogPrimitive.Portal container={container ?? undefined}>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ui-ink/40" />
        {/* `@radix-ui/react-dialog` 1.1.x ya no escribe `aria-modal` por sí solo (antes sí): con
            `modal` (por defecto `true`) el patrón WAI-ARIA de diálogo modal lo exige, así que lo
            fijamos aquí. */}
        <DialogPrimitive.Content
          aria-modal={modal ? "true" : undefined}
          onOpenAutoFocus={onOpenAutoFocus}
          aria-busy={busy || undefined}
          onEscapeKeyDown={(evento) => {
            if (busy) evento.preventDefault();
          }}
          onInteractOutside={(evento) => {
            if (busy) evento.preventDefault();
          }}
          className={twMerge(
            "fixed left-1/2 top-1/2 z-40 grid w-[calc(100%-32px)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 gap-3 rounded-[var(--ui-radius-lg)] bg-ui-surface-raised p-[22px] shadow-ui-2",
            "focus-visible:outline-none",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <DialogPrimitive.Title className="heading-md text-ui-ink">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Cerrar"
              disabled={busy}
              className="-mr-2 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-ui-pill text-ui-ink-muted transition-colors duration-[var(--ui-dur-1)] hover:bg-ui-surface-alt disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface-raised"
            >
              <IconoCerrar size={20} />
            </DialogPrimitive.Close>
          </div>
          {descriptionHidden ? (
            <DialogPrimitive.Description asChild>
              <VisuallyHidden>{description}</VisuallyHidden>
            </DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="text-sm text-ui-ink-muted">{description}</DialogPrimitive.Description>
          )}
          {children}
          {footer ? <div className="mt-1.5 flex justify-end gap-2">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
