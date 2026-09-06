// packages/ui/src/componentes/Avatar/Avatar.tsx — retrato de persona (`11 §5` fila «Avatar»):
// 44 px por defecto (36 en listas), iniciales 15/700 o foto con máscara CIRCULAR (`border-radius:
// 50%`, la máscara neutra de una cara — la biblioteca de `shapes` es para fotografía editorial, no
// para retratos pequeños de persona). Base Radix (`@radix-ui/react-avatar`): si la foto tarda o
// falla, cae a las iniciales sin parpadeo (`delayMs`).
import type { JSX } from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { twMerge } from "tailwind-merge";

export type TamanoAvatar = "sm" | "md";
export type EstadoAvatar = "activo" | "ausente";

const TAMANO: Record<TamanoAvatar, string> = {
  sm: "h-9 w-9 text-sm", // 36 px, listas
  md: "h-11 w-11 text-base", // 44 px, por defecto
};

const PUNTO_ESTADO: Record<EstadoAvatar, string> = {
  activo: "bg-ui-success",
  ausente: "bg-ui-warning",
};

export interface AvatarProps {
  /** Nombre completo: da las iniciales y, sin foto, es lo único que identifica a la persona. */
  readonly nombre: string;
  readonly src?: string;
  readonly size?: TamanoAvatar;
  readonly estado?: EstadoAvatar;
  readonly className?: string;
}

function inicialesDe(nombre: string): string {
  const partes = nombre.trim().split(/\s+/u).filter(Boolean);
  const letras = partes.slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? "");
  return letras.join("") || "?";
}

export function Avatar({ nombre, src, size = "md", estado, className }: AvatarProps): JSX.Element {
  return (
    <span className="relative inline-flex shrink-0">
      <AvatarPrimitive.Root
        className={twMerge(
          "inline-flex items-center justify-center overflow-hidden rounded-full bg-ui-support-1-soft font-bold text-ui-support-1-deep",
          TAMANO[size],
          className,
        )}
      >
        {src ? <AvatarPrimitive.Image src={src} alt={nombre} className="h-full w-full object-cover" /> : null}
        {/* Sin `src`, `delayMs` se omite a propósito: con un número (incluido 0) Radix arranca en
            `canRender=false` y espera un `setTimeout` para pintar; sin foto que cargar, las
            iniciales deben verse en el primer render, no un tic después. */}
        <AvatarPrimitive.Fallback delayMs={src ? 300 : undefined}>{inicialesDe(nombre)}</AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>
      {estado ? (
        <span
          aria-hidden="true"
          className={twMerge("absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-ui-surface", PUNTO_ESTADO[estado])}
        />
      ) : null}
    </span>
  );
}
