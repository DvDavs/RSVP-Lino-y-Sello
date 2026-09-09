// components/plan/BarraDelPanel.tsx — la barra de navegación del panel del cliente, pintada a
// partir del registro compartido (`lib/panel/nav.ts`). Ningún otro módulo la pinta todavía (las
// otras dos secciones siguen siendo el marcador del andamio 5-0d), así que vive aquí, en el
// territorio de esta pantalla; si una sesión futura la necesita en otra ruta, se saca de aquí sin
// tocar el registro.
//
// `publicada: false` SIEMPRE: `GET .../invitations/{id}` (el único dato que trae esta pantalla) no
// informa si hay un release activo, y suponer `true` pintaría «Compartir» aunque no exista enlace
// que compartir. `false` es el supuesto seguro (`nav.plan.ts` documenta que «Plan» se ve siempre;
// `nav.compartir.ts` es la única entrada que depende de este campo).
import Link from "next/link";
import type { ComponentType } from "react";
import * as iconos from "@invitaciones/icons";
import type { IconProps } from "@invitaciones/icons";
import { navegacionVisible } from "@/lib/panel/nav";
import { es_MX } from "@/lib/i18n";

export interface PropsBarraDelPanel {
  readonly invitationId: string;
  /** Id de la entrada actual (`nav.<area>.ts`): la única que lleva `aria-current="page"`. */
  readonly actual: string;
}

export function BarraDelPanel({ invitationId, actual }: PropsBarraDelPanel) {
  const entradas = navegacionVisible({ invitationId, publicada: false });
  const registro = iconos as unknown as Record<string, ComponentType<IconProps>>;

  return (
    <nav aria-label={es_MX.panel.navegacion} className="flex flex-wrap gap-1">
      {entradas.map((entrada) => {
        const Icono = registro[entrada.icono];
        const esActual = entrada.id === actual;
        return (
          <Link
            key={entrada.id}
            href={entrada.href(invitationId)}
            aria-current={esActual ? "page" : undefined}
            data-testid={`panel-nav-${entrada.id}`}
            className={`inline-flex h-10 items-center gap-2 rounded-ui-pill px-3.5 text-sm font-semibold transition-colors duration-200 ease-ui-out ${
              esActual ? "bg-ui-primary-soft text-ui-on-primary-soft" : "text-ui-ink-muted hover:bg-ui-surface-alt hover:text-ui-ink"
            }`}
          >
            {Icono ? <Icono size={18} tone="mono" /> : null}
            {es_MX.panel.nav[entrada.etiqueta]}
          </Link>
        );
      })}
    </nav>
  );
}
