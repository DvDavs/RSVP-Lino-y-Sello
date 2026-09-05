// GENERADO por scripts/generar.ts a partir de svg/*.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
//
// Fichero `.ts` (no `.tsx`, sin JSX): usa `createElement` para poder reexportar todo desde un
// único índice sin depender de que el bundler trate `.ts` como JSX (oxc/esbuild no lo hacen).
import { createElement, forwardRef } from "react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import type { IconProps, IconTone } from "./tipos.ts";
import { IconoAdelante } from "./generated/AdelanteIcon.tsx";
import { IconoAgregar } from "./generated/AgregarIcon.tsx";
import { IconoAjustes } from "./generated/AjustesIcon.tsx";
import { IconoArrastrar } from "./generated/ArrastrarIcon.tsx";
import { IconoAtras } from "./generated/AtrasIcon.tsx";
import { IconoAyuda } from "./generated/AyudaIcon.tsx";
import { IconoBajar } from "./generated/BajarIcon.tsx";
import { IconoBorrar } from "./generated/BorrarIcon.tsx";
import { IconoBuscar } from "./generated/BuscarIcon.tsx";
import { IconoCelebrantes } from "./generated/CelebrantesIcon.tsx";
import { IconoCerrar } from "./generated/CerrarIcon.tsx";
import { IconoChevronAbajo } from "./generated/ChevronAbajoIcon.tsx";
import { IconoChevronDerecha } from "./generated/ChevronDerechaIcon.tsx";
import { IconoComodidades } from "./generated/ComodidadesIcon.tsx";
import { IconoDeshacer } from "./generated/DeshacerIcon.tsx";
import { IconoDuplicar } from "./generated/DuplicarIcon.tsx";
import { IconoEditar } from "./generated/EditarIcon.tsx";
import { IconoEscritorio } from "./generated/EscritorioIcon.tsx";
import { IconoEventoFecha } from "./generated/EventoFechaIcon.tsx";
import { IconoExterno } from "./generated/ExternoIcon.tsx";
import { IconoFamilia } from "./generated/FamiliaIcon.tsx";
import { IconoGaleria } from "./generated/GaleriaIcon.tsx";
import { IconoGuardar } from "./generated/GuardarIcon.tsx";
import { IconoInicio } from "./generated/InicioIcon.tsx";
import { IconoItinerario } from "./generated/ItinerarioIcon.tsx";
import { IconoMenu } from "./generated/MenuIcon.tsx";
import { IconoMesaDeRegalos } from "./generated/MesaDeRegalosIcon.tsx";
import { IconoMovil } from "./generated/MovilIcon.tsx";
import { IconoOcultar } from "./generated/OcultarIcon.tsx";
import { IconoPaleta } from "./generated/PaletaIcon.tsx";
import { IconoPortada } from "./generated/PortadaIcon.tsx";
import { IconoPuntoFocal } from "./generated/PuntoFocalIcon.tsx";
import { IconoQuitar } from "./generated/QuitarIcon.tsx";
import { IconoRecortar } from "./generated/RecortarIcon.tsx";
import { IconoRehacer } from "./generated/RehacerIcon.tsx";
import { IconoRsvpConfirmado } from "./generated/RsvpConfirmadoIcon.tsx";
import { IconoSubir } from "./generated/SubirIcon.tsx";
import { IconoSugerencias } from "./generated/SugerenciasIcon.tsx";
import { IconoTipografia } from "./generated/TipografiaIcon.tsx";
import { IconoVer } from "./generated/VerIcon.tsx";
import { IconoVistaPrevia } from "./generated/VistaPreviaIcon.tsx";

export type { IconProps, IconTone };

/** Nombre del paquete (compatibilidad con el esqueleto de la fase 3-C). */
export const PAQUETE = "@invitaciones/icons" as const;

export {
  IconoAdelante,
  IconoAgregar,
  IconoAjustes,
  IconoArrastrar,
  IconoAtras,
  IconoAyuda,
  IconoBajar,
  IconoBorrar,
  IconoBuscar,
  IconoCelebrantes,
  IconoCerrar,
  IconoChevronAbajo,
  IconoChevronDerecha,
  IconoComodidades,
  IconoDeshacer,
  IconoDuplicar,
  IconoEditar,
  IconoEscritorio,
  IconoEventoFecha,
  IconoExterno,
  IconoFamilia,
  IconoGaleria,
  IconoGuardar,
  IconoInicio,
  IconoItinerario,
  IconoMenu,
  IconoMesaDeRegalos,
  IconoMovil,
  IconoOcultar,
  IconoPaleta,
  IconoPortada,
  IconoPuntoFocal,
  IconoQuitar,
  IconoRecortar,
  IconoRehacer,
  IconoRsvpConfirmado,
  IconoSubir,
  IconoSugerencias,
  IconoTipografia,
  IconoVer,
  IconoVistaPrevia,
};

export const iconNames = [
  "adelante",
  "agregar",
  "ajustes",
  "arrastrar",
  "atras",
  "ayuda",
  "bajar",
  "borrar",
  "buscar",
  "celebrantes",
  "cerrar",
  "chevron-abajo",
  "chevron-derecha",
  "comodidades",
  "deshacer",
  "duplicar",
  "editar",
  "escritorio",
  "evento-fecha",
  "externo",
  "familia",
  "galeria",
  "guardar",
  "inicio",
  "itinerario",
  "menu",
  "mesa-de-regalos",
  "movil",
  "ocultar",
  "paleta",
  "portada",
  "punto-focal",
  "quitar",
  "recortar",
  "rehacer",
  "rsvp-confirmado",
  "subir",
  "sugerencias",
  "tipografia",
  "ver",
  "vista-previa",
] as const;

export type IconName = (typeof iconNames)[number];

type IconoComponente = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;

const REGISTRO: Record<IconName, IconoComponente> = {
  "adelante": IconoAdelante,
  "agregar": IconoAgregar,
  "ajustes": IconoAjustes,
  "arrastrar": IconoArrastrar,
  "atras": IconoAtras,
  "ayuda": IconoAyuda,
  "bajar": IconoBajar,
  "borrar": IconoBorrar,
  "buscar": IconoBuscar,
  "celebrantes": IconoCelebrantes,
  "cerrar": IconoCerrar,
  "chevron-abajo": IconoChevronAbajo,
  "chevron-derecha": IconoChevronDerecha,
  "comodidades": IconoComodidades,
  "deshacer": IconoDeshacer,
  "duplicar": IconoDuplicar,
  "editar": IconoEditar,
  "escritorio": IconoEscritorio,
  "evento-fecha": IconoEventoFecha,
  "externo": IconoExterno,
  "familia": IconoFamilia,
  "galeria": IconoGaleria,
  "guardar": IconoGuardar,
  "inicio": IconoInicio,
  "itinerario": IconoItinerario,
  "menu": IconoMenu,
  "mesa-de-regalos": IconoMesaDeRegalos,
  "movil": IconoMovil,
  "ocultar": IconoOcultar,
  "paleta": IconoPaleta,
  "portada": IconoPortada,
  "punto-focal": IconoPuntoFocal,
  "quitar": IconoQuitar,
  "recortar": IconoRecortar,
  "rehacer": IconoRehacer,
  "rsvp-confirmado": IconoRsvpConfirmado,
  "subir": IconoSubir,
  "sugerencias": IconoSugerencias,
  "tipografia": IconoTipografia,
  "ver": IconoVer,
  "vista-previa": IconoVistaPrevia,
};

/** Icono genérico por nombre: `createElement(Icon, { name: "inicio" })` o `<Icon name="inicio" />` en un `.tsx`. */
export const Icon = forwardRef<SVGSVGElement, IconProps & { name: IconName }>(function Icon(
  { name, ...resto },
  ref,
) {
  return createElement(REGISTRO[name], { ref, ...resto });
});
