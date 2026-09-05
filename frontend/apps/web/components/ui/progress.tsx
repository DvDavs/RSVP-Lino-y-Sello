"use client";

// components/ui/progress.tsx — barra de subida (04 §18: rol `progressbar` + `aria-valuenow`, "con
// texto numérico visible", nunca solo un gráfico).
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { twMerge } from "tailwind-merge";

export interface ProgressProps {
  /** 0-100. */
  value: number;
  label?: string;
  className?: string;
}

export function Progress({ value, label, className }: ProgressProps) {
  const clamp = Math.max(0, Math.min(100, value));
  return (
    <div className={twMerge("flex items-center gap-2", className)}>
      <ProgressPrimitive.Root
        value={clamp}
        className="h-2 flex-1 overflow-hidden rounded-ui-pill bg-ui-border"
        aria-label={label}
      >
        <ProgressPrimitive.Indicator
          className="h-full bg-ui-accent transition-transform duration-[var(--ui-duration)] ease-[var(--ui-ease)]"
          style={{ transform: `translateX(-${100 - clamp}%)` }}
        />
      </ProgressPrimitive.Root>
      <span className="w-10 shrink-0 text-right text-ui-aux text-ui-ink-muted">{Math.round(clamp)}%</span>
    </div>
  );
}
