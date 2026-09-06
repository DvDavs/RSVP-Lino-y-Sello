// packages/ui/src/componentes/Badge/Badge.tsx — insignia de estado (`11 §5` fila «Badge»): 22 px,
// mono 11 en mayúsculas, texto SIEMPRE presente (nunca solo un punto de color: "texto siempre").
import type { JSX, ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export type TonoBadge = "neutro" | "primary" | "success" | "warning" | "danger" | "info" | "accent";

const TONO: Record<TonoBadge, string> = {
  neutro: "bg-ui-surface-alt text-ui-ink-muted",
  primary: "bg-ui-primary-soft text-ui-on-primary-soft",
  success: "bg-ui-success-soft text-ui-on-success-soft",
  warning: "bg-ui-warning-soft text-ui-on-warning-soft",
  danger: "bg-ui-danger-soft text-ui-on-danger-soft",
  info: "bg-ui-info-soft text-ui-on-info-soft",
  accent: "bg-ui-accent-soft text-ui-on-accent-soft",
};

export interface BadgeProps {
  readonly tone?: TonoBadge;
  readonly className?: string;
  readonly children: ReactNode;
}

export function Badge({ tone = "neutro", className, children }: BadgeProps): JSX.Element {
  return (
    <span className={twMerge("label-sm inline-flex h-[22px] items-center whitespace-nowrap rounded-ui-pill px-2.5", TONO[tone], className)}>
      {children}
    </span>
  );
}
