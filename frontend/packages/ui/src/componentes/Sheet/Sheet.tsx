// packages/ui/src/componentes/Sheet/Sheet.tsx — hoja inferior (`11 §5` fila «Dialog / Sheet»): la
// versión MÓVIL del diálogo. Mismo contrato de accesibilidad que `Dialog` (foco atrapado y devuelto,
// `title`/`description` obligatorios, Radix Dialog por debajo), distinta composición visual: asa de
// arrastre decorativa, borde superior redondeado, `safe-area-inset` y el botón primario del `footer`
// pegado abajo incluso si el cuerpo hace scroll.
"use client";

import type { JSX, ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { twMerge } from "tailwind-merge";

export interface SheetProps {
  readonly open?: boolean;
  readonly defaultOpen?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly trigger?: ReactNode;
  /** Título accesible, SIEMPRE visible. */
  readonly title: string;
  /** Descripción accesible; obligatoria (usa `descriptionHidden` si no debe verse). */
  readonly description: string;
  readonly descriptionHidden?: boolean;
  /** Estado "ocupado": bloquea Esc y el clic fuera. Ver `Dialog`. */
  readonly busy?: boolean;
  /** Acción primaria pegada abajo (`11 §5`: "botón primario pegado abajo"). */
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

export function Sheet({
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
}: SheetProps): JSX.Element {
  return (
    <DialogPrimitive.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange} modal={modal}>
      {trigger ? <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger> : null}
      <DialogPrimitive.Portal container={container ?? undefined}>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ui-ink/40" />
        {/* Ver `Dialog.tsx`: `@radix-ui/react-dialog` 1.1.x no fija `aria-modal` por sí solo. */}
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
            "fixed inset-x-0 bottom-0 z-40 flex max-h-[85vh] flex-col gap-3 rounded-t-[var(--ui-radius-lg)] bg-ui-surface-raised p-5 shadow-ui-2",
            "focus-visible:outline-none",
            className,
          )}
        >
          <span aria-hidden="true" className="mx-auto -mt-1 mb-1 h-1.5 w-10 shrink-0 rounded-ui-pill bg-ui-divider" />
          <DialogPrimitive.Title className="heading-md text-ui-ink">{title}</DialogPrimitive.Title>
          {descriptionHidden ? (
            <DialogPrimitive.Description asChild>
              <VisuallyHidden>{description}</VisuallyHidden>
            </DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="text-sm text-ui-ink-muted">{description}</DialogPrimitive.Description>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footer ? (
            <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-col gap-2 border-t border-ui-divider bg-ui-surface-raised px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
              {footer}
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
