// packages/ui/src/componentes/Toast/Toast.tsx — tostada informativa (`11 §5` fila «Toast»):
// `ink` sobre `surface`, icono 22, negrita + frase, 4 s por defecto, máximo 2 apiladas (`store.ts`).
// Base Radix (`@radix-ui/react-toast`) para el swipe-to-dismiss y el temporizador (se PAUSA solo al
// pasar el ratón o enfocar, comportamiento nativo de `Toast.Root`). Además de la región que Radix
// anuncia internamente, este componente monta su PROPIA región `role="status"` `aria-live="polite"`
// (11 §5 y el brief del bloque lo piden explícitos: es lo que la prueba y la revisión verifican).
//
// IMPORTANTE (documentado también en el handoff): un error que exige una decisión de la persona
// (aceptar/cancelar, corregir un dato) NUNCA es un toast — es un `Dialog`/`Sheet` o un banner en la
// página. El toast es de un solo sentido: informa y desaparece solo.
"use client";

import { useSyncExternalStore } from "react";
import type { ComponentType, JSX } from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { IconoCerrar, IconoError, IconoExito, IconoInfo } from "@invitaciones/icons";
import type { IconProps } from "@invitaciones/icons";
import { twMerge } from "tailwind-merge";
import {
  agregarTostada,
  obtenerCola,
  quitarTostada,
  suscribirTostadas,
  type TostadaEntrada,
  type TostadaOpciones,
  type TostadaVariante,
} from "./store.ts";

export type { TostadaEntrada, TostadaOpciones, TostadaVariante };

/** API imperativa: `toast({ descripcion, variante, titulo, duracion })` desde cualquier sitio. */
export const toast = agregarTostada;

/** Hook de lectura de la cola (para una pantalla que quiera mostrar "N avisos", por ejemplo). */
export function useToast(): { readonly cola: readonly TostadaEntrada[]; readonly toast: typeof agregarTostada; readonly cerrar: typeof quitarTostada } {
  const cola = useSyncExternalStore(suscribirTostadas, obtenerCola, obtenerCola);
  return { cola, toast: agregarTostada, cerrar: quitarTostada };
}

const ICONO_POR_VARIANTE: Record<TostadaVariante, ComponentType<IconProps>> = {
  info: IconoInfo,
  exito: IconoExito,
  error: IconoError,
};

const COLOR_POR_VARIANTE: Record<TostadaVariante, string> = {
  info: "text-ui-info",
  exito: "text-ui-success",
  error: "text-ui-danger",
};

function TostadaItem({ entrada }: { readonly entrada: TostadaEntrada }): JSX.Element {
  const Icono = ICONO_POR_VARIANTE[entrada.variante];
  return (
    <ToastPrimitive.Root
      type="background"
      duration={entrada.duracion}
      onOpenChange={(abierta) => {
        if (!abierta) quitarTostada(entrada.id);
      }}
      className="pointer-events-auto flex w-full max-w-[420px] items-start gap-3 rounded-ui-card bg-ui-ink px-4 py-3 text-ui-surface shadow-ui-2"
    >
      <Icono size={22} tone="mono" className={twMerge("mt-0.5 shrink-0", COLOR_POR_VARIANTE[entrada.variante])} />
      <div className="min-w-0 flex-1 text-sm">
        {entrada.titulo ? <ToastPrimitive.Title className="font-bold">{entrada.titulo}</ToastPrimitive.Title> : null}
        <ToastPrimitive.Description>{entrada.descripcion}</ToastPrimitive.Description>
      </div>
      <ToastPrimitive.Close
        aria-label="Cerrar"
        className="-mr-1 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-ui-pill text-ui-surface/80 transition-colors duration-[var(--ui-dur-1)] hover:bg-white/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ui-ink"
      >
        <IconoCerrar size={16} />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

/**
 * Punto de montaje ÚNICO (una vez, cerca de la raíz del chrome). `toast()`/`useToast()` funcionan
 * desde cualquier sitio en cuanto `Toaster` está montado en algún lugar del árbol.
 */
export function Toaster(): JSX.Element {
  const cola = useSyncExternalStore(suscribirTostadas, obtenerCola, obtenerCola);
  const ultima = cola.at(-1);
  return (
    <ToastPrimitive.Provider swipeDirection="right" duration={4000} label="Aviso">
      {cola.map((entrada) => (
        <TostadaItem key={entrada.id} entrada={entrada} />
      ))}
      <ToastPrimitive.Viewport className="pointer-events-none fixed inset-x-0 top-4 z-50 mx-auto flex w-full max-w-[420px] flex-col items-center gap-2 p-2 outline-none" />
      {/* Región explícita del sistema: `role="status"` + `aria-live="polite"` (11 §5). Radix añade
          la suya propia por tostada (con `type="background"` de arriba, también "polite"); esta es
          la que fija el contrato y la que verifica la prueba (`data-region` es un gancho de prueba,
          no ARIA: no cambia cómo lo anuncia el lector de pantalla). */}
      <div role="status" aria-live="polite" data-region="anuncio-tostadas" className="sr-only">
        {ultima ? [ultima.titulo, ultima.descripcion].filter(Boolean).join(". ") : ""}
      </div>
    </ToastPrimitive.Provider>
  );
}
