// packages/ui/src/componentes/Tabs/Tabs.tsx — pestañas del sistema (`11 §5` fila «Tabs»).
// Base Radix (`@radix-ui/react-tabs`): teclado ←/→ Inicio/Fin, `role="tablist"/"tab"/"tabpanel"`,
// asociación `aria-controls`/`aria-labelledby` automática. Activación MANUAL por defecto (el brief
// del bloque lo pide): mover el foco con las flechas no cambia el panel hasta Enter/Espacio, para no
// disparar una carga cara con solo pasar por encima con el teclado.
"use client";

import type { ComponentProps, JSX } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { twMerge } from "tailwind-merge";

export type TabsProps = ComponentProps<typeof TabsPrimitive.Root>;

export function Tabs({ activationMode = "manual", className, ...props }: TabsProps): JSX.Element {
  return <TabsPrimitive.Root activationMode={activationMode} className={twMerge("block w-full", className)} {...props} />;
}

export type TabsListProps = ComponentProps<typeof TabsPrimitive.List>;

/** Píldora contenedora en `surface-alt`; scroll horizontal si las pestañas no caben (`11 §5`). */
export function TabsList({ className, ...props }: TabsListProps): JSX.Element {
  return (
    <TabsPrimitive.List
      className={twMerge(
        "inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-ui-pill bg-ui-surface-alt p-1",
        className,
      )}
      {...props}
    />
  );
}

export type TabsTriggerProps = ComponentProps<typeof TabsPrimitive.Trigger>;

/** Pestaña activa en `surface-raised` con `shadow-ui-1`; inactiva en `ink-muted`. */
export function TabsTrigger({ className, ...props }: TabsTriggerProps): JSX.Element {
  return (
    <TabsPrimitive.Trigger
      className={twMerge(
        "inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-ui-pill px-4 text-sm text-ui-ink-muted outline-none transition-colors duration-[var(--ui-dur-2)] ease-ui-out",
        "data-[state=active]:bg-ui-surface-raised data-[state=active]:text-ui-ink data-[state=active]:shadow-ui-1",
        "disabled:cursor-not-allowed disabled:opacity-45",
        "focus-visible:ring-[3px] focus-visible:ring-ui-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface-alt",
        className,
      )}
      {...props}
    />
  );
}

export type TabsContentProps = ComponentProps<typeof TabsPrimitive.Content>;

export function TabsContent({ className, ...props }: TabsContentProps): JSX.Element {
  return (
    <TabsPrimitive.Content
      className={twMerge(
        "mt-4 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface",
        className,
      )}
      {...props}
    />
  );
}
