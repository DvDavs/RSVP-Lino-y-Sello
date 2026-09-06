// packages/ui/src/utilidades/controlSombra.ts — box-shadow de un control con borde (Input,
// Textarea, disparador de Select/Combobox): borde interior 1,5 px `border` en reposo, 2 px
// `primary` + anillo al enfocar, 2 px `danger` con error, `divider` deshabilitado (`11 §5`).
// Se calcula como `style.boxShadow`, no como clase Tailwind: ver `utilidades/foco.ts`.
import { SOMBRA_ANILLO_FOCO } from "./foco.ts";

export interface EstadoControl {
  readonly enFoco: boolean;
  readonly invalido?: boolean;
  readonly deshabilitado?: boolean;
}

export function sombraControl({ enFoco, invalido, deshabilitado }: EstadoControl): string {
  if (deshabilitado) return "inset 0 0 0 1.5px var(--ui-divider)";
  const borde = invalido ? "inset 0 0 0 2px var(--ui-danger)" : enFoco ? "inset 0 0 0 2px var(--ui-primary)" : "inset 0 0 0 1.5px var(--ui-border)";
  return enFoco ? `${borde}, ${SOMBRA_ANILLO_FOCO}` : borde;
}
