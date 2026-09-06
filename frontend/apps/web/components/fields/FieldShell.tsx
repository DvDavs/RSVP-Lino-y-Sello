"use client";

// components/fields/FieldShell.tsx — envoltorio COMÚN de los 14 campos: etiqueta, ayuda, contador,
// insignia de "contenido de ejemplo" (H-03, `report.stillDefault`) y mensaje de error con
// `aria-describedby` (U-17: "anuncia el error con `aria-describedby`"). Nunca decide SI hay error —
// eso es de cada campo, según su `BlockSpec`.
//
// Fase 3-C: mismo contrato de ids y `aria-describedby` (no se toca: lo consumen los 14 campos y sus
// pruebas), vestido con la escala tipográfica y los roles de color del sistema. Por qué NO usa el
// `Field` de `@invitaciones/ui`: aquel CLONA su único hijo para inyectarle `id`/`aria-*`, y estos
// campos tienen varios controles por bloque (`LocationField`: nombre + dirección + mapa) y calculan
// su propio `aria-describedby` con `describedByPara`. La apariencia es la misma —etiqueta 14/600
// arriba, ayuda 12,5 debajo, error con icono `danger`— porque sale de los mismos tokens.
import type { ReactNode } from "react";
import { IconoAviso, IconoCandado, IconoError, IconoExterno } from "@invitaciones/icons";
import { es_MX } from "@/lib/i18n.ts";

export function idsAyudaError(id: string): { helpId: string; errorId: string } {
  return { helpId: `${id}-ayuda`, errorId: `${id}-error` };
}

/** El MISMO cálculo que usa `FieldShell`: el control real (`<input>`, …) debe usar este valor tal cual
 *  para que `aria-describedby` apunte a los nodos que `FieldShell` efectivamente pinta (U-17). */
export function describedByPara(id: string, opciones: { help?: string; error?: string }): string | undefined {
  const { helpId, errorId } = idsAyudaError(id);
  return [opciones.help ? helpId : null, opciones.error ? errorId : null].filter(Boolean).join(" ") || undefined;
}

export interface FieldShellProps {
  id: string;
  label: string;
  help?: string;
  required?: boolean;
  esContenidoDeEjemplo?: boolean;
  counter?: string;
  error?: string;
  children: ReactNode;
}

export function FieldShell({ id, label, help, required, esContenidoDeEjemplo, counter, error, children }: FieldShellProps) {
  const { helpId, errorId } = idsAyudaError(id);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-ui-ink">
          {label}
          {required ? (
            <span aria-hidden="true" className="ml-0.5 text-ui-danger-text">
              *
            </span>
          ) : null}
        </label>
        {counter ? <span className="numeros-tabulares shrink-0 text-xs text-ui-ink-muted">{counter}</span> : null}
      </div>
      {help ? (
        <p id={helpId} className="text-xs text-ui-ink-muted">
          {help}
        </p>
      ) : null}
      {children}
      {/* Aviso, no control: es una afirmación sobre el valor, así que va como texto con icono de
          `aviso` y no como `Chip` (que es un botón y prometería una acción que no existe). */}
      {esContenidoDeEjemplo ? (
        <p className="flex items-center gap-1.5 text-xs text-ui-warning-text">
          <IconoAviso size={16} tone="mono" className="shrink-0" />
          {es_MX.editor.campo.contenidoDeEjemplo}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="flex items-center gap-1.5 text-xs font-semibold text-ui-danger-text">
          <IconoError size={16} tone="mono" className="shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Bloque de solo lectura (04 §6.3, §7.1 paso 5): NUNCA un input deshabilitado y mudo.
 *
 * U-3 — el candado sin salida costó cinco minutos de búsqueda a la clienta y le impidió el TERCER
 * verbo del criterio de terminado. `04 §6.3` dibuja, junto a la explicación, un botón `[Editar
 * allí]`; nunca se implementó. Ahora la explicación va acompañada de `dondeSeCambia`, un enlace REAL
 * al sitio donde se resuelve. Se llama «Dónde se cambia» y no «Editar allí» porque en esta fase
 * ningún destino EDITA la fecha (no existe ruta de cliente que escriba `invitation.date`: solo
 * `PUT /admin/invitations/{id}`, rol ADMIN — `InvitationAdminService.kt:414`), y prometer «editar»
 * sería el mismo callejón sin salida con otro nombre. Ver `bitacora/3-8.md` § U-3.
 *
 * Fase 3-C: el candado deja de ser un emoji y pasa a ser `IconoCandado` del sistema, con `title`
 * accesible; el enlace externo lleva `IconoExterno` en vez de una flecha tipográfica.
 */
export function SoloLectura({
  label,
  valor,
  explicacion,
  dondeSeCambia,
}: {
  label: string;
  valor: string;
  explicacion: string;
  dondeSeCambia?: { href: string; etiqueta: string };
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-sm font-semibold text-ui-ink">
        {label}
        <IconoCandado size={16} tone="mono" title={es_MX.editor.campo.soloLecturaTitulo} className="text-ui-ink-muted" />
      </span>
      <p className="rounded-ui-control bg-ui-surface-alt px-4 py-2.5 text-md text-ui-ink">
        {valor || es_MX.editor.campo.sinValor}
      </p>
      <p className="text-xs text-ui-ink-muted">
        {explicacion}
        {dondeSeCambia ? (
          <>
            {" "}
            <a
              href={dondeSeCambia.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-ui-link underline"
            >
              {dondeSeCambia.etiqueta}
              <IconoExterno size={14} tone="mono" />
            </a>
          </>
        ) : null}
      </p>
    </div>
  );
}

/**
 * PUENTE TEMPORAL (fase 3-C, bloque 3). Los 14 campos de `components/fields/**` ya usan `Input` y
 * `Textarea` de `@invitaciones/ui`, que fijan alto (46 px), foco y borde por `style` calculado. Esta
 * constante solo sigue viva porque `app/(chrome)/acceso/page.tsx` —pantalla de otra tarea del mismo
 * bloque— la importa; reproduce el mismo aspecto con utilidades del preset, sin ningún nombre de la
 * capa de compatibilidad. Bórrala cuando `/acceso` use `Input` del sistema.
 *
 * @deprecated Usa `<Input>` de `@invitaciones/ui`.
 */
export const CLASES_CONTROL =
  "h-[46px] w-full min-w-0 rounded-ui-control bg-ui-surface-raised px-[14px] text-base text-ui-ink shadow-[inset_0_0_0_1.5px_var(--color-ui-border)] outline-none placeholder:text-ui-ink-placeholder disabled:cursor-not-allowed disabled:bg-ui-surface-alt disabled:text-ui-ink-muted";
