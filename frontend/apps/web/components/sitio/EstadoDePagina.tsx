// components/sitio/EstadoDePagina.tsx — el 404 y el error genérico de la web pública, con el mismo
// molde: ilustración del sistema, un titular, una frase y UNA salida (`11 §7`, fila «Estados»:
// «ningún callejón sin salida»). Se usa desde `not-found.tsx` y desde `error.tsx`.
import { EmptyState, type EmptyStateAccion } from "@invitaciones/ui/componentes/EmptyState.tsx";

export interface PropsEstadoDePagina {
  readonly titulo: string;
  readonly texto: string;
  readonly accion: EmptyStateAccion;
  /** Código técnico (`digest` de React, `TPL_…`): en voz `label`, aparte y nunca dentro de la frase. */
  readonly codigo?: string;
}

export function EstadoDePagina({ titulo, texto, accion, codigo }: PropsEstadoDePagina) {
  return (
    <div className="mx-auto w-full max-w-ui-page px-5 py-16 sm:px-8">
      <EmptyState ilustracion="error-generico" titulo={titulo} texto={texto} accion={accion} />
      {codigo ? (
        <p className="label-sm mt-6 text-center text-ui-ink-muted">{codigo}</p>
      ) : null}
    </div>
  );
}
