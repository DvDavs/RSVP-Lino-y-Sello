// `<Ilustracion nombre="sin-invitaciones" />` — API pública pedida por `11 §4.3`: un solo componente
// por nombre en vez de importar cada dibujo suelto. `EmptyState` (bloque 3C-4) la consume así.
import type { ReactElement } from "react";
import { ErrorGenerico } from "./ErrorGenerico.tsx";
import { SinFotos } from "./SinFotos.tsx";
import { SinInvitaciones } from "./SinInvitaciones.tsx";
import type { NombreIlustracion, PropsIlustracion } from "./tipos.ts";

const REGISTRO: Record<NombreIlustracion, (props: PropsIlustracion) => ReactElement> = {
  "sin-invitaciones": SinInvitaciones,
  "sin-fotos": SinFotos,
  "error-generico": ErrorGenerico,
};

export interface IlustracionProps extends PropsIlustracion {
  nombre: NombreIlustracion;
}

export function Ilustracion({ nombre, ...props }: IlustracionProps) {
  const Dibujo = REGISTRO[nombre];
  return <Dibujo {...props} />;
}
