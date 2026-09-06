// packages/ui/src/componentes/WizardProgress/WizardProgress.tsx — progreso del asistente (`11 §5`
// fila «Stepper»: pasos con círculo 30, número o check, etiqueta mono 10,5 en mayúsculas, líneas de
// 3 px). Nombrado `WizardProgress` en este bloque para no chocar con el `Stepper` numérico (cantidad,
// `±`) que también entrega este bloque — el doc 11 llama "Stepper" a ESTE componente; ver ADR de la
// bitácora. `<ol>` con `aria-current="step"`; los pasos "hecho" son enlaces (se puede volver atrás).
import type { JSX } from "react";
import { twMerge } from "tailwind-merge";

export type EstadoPaso = "pendiente" | "actual" | "hecho" | "error";

export interface PasoAsistente {
  readonly id: string;
  readonly etiqueta: string;
  readonly estado: EstadoPaso;
  /** Solo tiene efecto con `estado="hecho"`: un paso ya completado se puede reabrir. */
  readonly href?: string;
}

export interface WizardProgressProps {
  readonly pasos: readonly PasoAsistente[];
  readonly className?: string;
}

const CIRCULO_BASE = "grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-sm font-bold";

const CIRCULO_POR_ESTADO: Record<EstadoPaso, string> = {
  pendiente: "bg-ui-surface-raised text-ui-ink-muted shadow-[inset_0_0_0_2px_var(--ui-border)]",
  actual: "bg-ui-surface-raised text-ui-link shadow-[inset_0_0_0_2px_var(--ui-primary)]",
  hecho: "bg-ui-primary text-ui-on-primary",
  error: "bg-ui-danger text-ui-on-danger",
};

function IconoCheck(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5 L10 17 L19 7.5" />
    </svg>
  );
}

function IconoAlerta(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 8 V13.5 M12 17 h.01" />
    </svg>
  );
}

export function WizardProgress({ pasos, className }: WizardProgressProps): JSX.Element {
  const indiceActual = pasos.findIndex((paso) => paso.estado === "actual");
  const numeroActual = indiceActual === -1 ? pasos.filter((p) => p.estado === "hecho").length : indiceActual + 1;

  return (
    <div className={twMerge("grid gap-3", className)}>
      <p className="label-sm text-ui-ink-muted">
        Paso {numeroActual} de {pasos.length}
      </p>
      <ol className="flex max-w-full items-start">
        {pasos.map((paso, indice) => {
          const esUltimo = indice === pasos.length - 1;
          const numero = indice + 1;
          const contenidoCirculo =
            paso.estado === "hecho" ? <IconoCheck /> : paso.estado === "error" ? <IconoAlerta /> : numero;

          const circulo = (
            <span className={twMerge(CIRCULO_BASE, CIRCULO_POR_ESTADO[paso.estado])} aria-hidden="true">
              {contenidoCirculo}
            </span>
          );

          return (
            <li key={paso.id} className="flex flex-1 flex-col items-center gap-1.5 text-center last:flex-none">
              <div className="flex w-full items-center">
                {paso.estado === "hecho" && paso.href !== undefined ? (
                  <a
                    href={paso.href}
                    aria-label={`Volver a: ${paso.etiqueta}`}
                    className="rounded-full focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface"
                  >
                    {circulo}
                  </a>
                ) : (
                  circulo
                )}
                {esUltimo ? null : (
                  <span
                    aria-hidden="true"
                    className={twMerge("mx-1 h-[3px] flex-1 rounded-full", paso.estado === "hecho" ? "bg-ui-primary" : "bg-ui-divider")}
                  />
                )}
              </div>
              <span
                aria-current={paso.estado === "actual" ? "step" : undefined}
                className={twMerge(
                  "label-sm hidden max-w-[76px] sm:block",
                  paso.estado === "actual" ? "text-ui-ink" : "text-ui-ink-muted",
                )}
              >
                {paso.etiqueta}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
