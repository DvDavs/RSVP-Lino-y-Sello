// packages/ui/src/componentes/ProgressRing/ProgressRing.tsx — progreso anular (`11 §5` fila
// «Progreso anular»): anillo 72, trazo 7, el número SIEMPRE como texto (nunca solo el arco).
// `role="progressbar"` con `aria-valuenow`/`aria-valuetext`; en `indeterminate`, se omiten los
// valores numéricos (no hay progreso que reportar) y el texto pasa a "Cargando…" (`11 §6.2` regla 6:
// ninguna espera larga sin texto). El giro respeta `prefers-reduced-motion` (Tailwind `motion-reduce`).
import type { JSX } from "react";
import { twMerge } from "tailwind-merge";

export interface ProgressRingProps {
  /** Progreso, `0..max`. Se ignora si `indeterminate`. */
  readonly value?: number;
  readonly max?: number;
  /** Nombre accesible del anillo (`11 §5`: "Progreso de tu invitación", por ejemplo). */
  readonly label: string;
  readonly indeterminate?: boolean;
  /** Diámetro en px. 72 por defecto (`11 §5`). */
  readonly size?: number;
  readonly className?: string;
}

const TRAZO = 7;

function IconoCompleto(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5 L10 17 L19 7.5" />
    </svg>
  );
}

export function ProgressRing({ value = 0, max = 100, label, indeterminate = false, size = 72, className }: ProgressRingProps): JSX.Element {
  const radio = (size - TRAZO) / 2;
  const circunferencia = 2 * Math.PI * radio;
  const porcentaje = indeterminate ? 0 : Math.round(Math.max(0, Math.min(100, (value / max) * 100)));
  const desplazamiento = circunferencia * (1 - porcentaje / 100);
  const completo = !indeterminate && porcentaje >= 100;
  const centro = size / 2;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuemax={indeterminate ? undefined : 100}
      aria-valuenow={indeterminate ? undefined : porcentaje}
      aria-valuetext={indeterminate ? "Cargando…" : `${String(porcentaje)} %`}
      className={twMerge("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox={`0 0 ${String(size)} ${String(size)}`}
        width={size}
        height={size}
        className={indeterminate ? "motion-safe:animate-spin" : undefined}
        aria-hidden="true"
      >
        <circle cx={centro} cy={centro} r={radio} fill="none" stroke="var(--ui-divider)" strokeWidth={TRAZO} />
        <circle
          cx={centro}
          cy={centro}
          r={radio}
          fill="none"
          stroke={completo ? "var(--ui-success)" : "var(--ui-primary)"}
          strokeWidth={TRAZO}
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          strokeDashoffset={indeterminate ? circunferencia * 0.75 : desplazamiento}
          transform={`rotate(-90 ${String(centro)} ${String(centro)})`}
        />
      </svg>
      <span className={twMerge("absolute text-ui-ink", indeterminate ? "text-xs font-semibold" : "text-sm font-bold tabular-nums", completo && "text-ui-success")}>
        {indeterminate ? "Cargando…" : completo ? <IconoCompleto /> : `${String(porcentaje)} %`}
      </span>
    </div>
  );
}
