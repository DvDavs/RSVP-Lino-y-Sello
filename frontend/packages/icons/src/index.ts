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
import { IconoAlergia } from "./generated/AlergiaIcon.tsx";
import { IconoArrastrar } from "./generated/ArrastrarIcon.tsx";
import { IconoAtras } from "./generated/AtrasIcon.tsx";
import { IconoAviso } from "./generated/AvisoIcon.tsx";
import { IconoAyuda } from "./generated/AyudaIcon.tsx";
import { IconoBajar } from "./generated/BajarIcon.tsx";
import { IconoBautizo } from "./generated/BautizoIcon.tsx";
import { IconoBoda } from "./generated/BodaIcon.tsx";
import { IconoBorrar } from "./generated/BorrarIcon.tsx";
import { IconoBuscar } from "./generated/BuscarIcon.tsx";
import { IconoCandado } from "./generated/CandadoIcon.tsx";
import { IconoCargando } from "./generated/CargandoIcon.tsx";
import { IconoCelebrantes } from "./generated/CelebrantesIcon.tsx";
import { IconoCerrar } from "./generated/CerrarIcon.tsx";
import { IconoChat } from "./generated/ChatIcon.tsx";
import { IconoChevronAbajo } from "./generated/ChevronAbajoIcon.tsx";
import { IconoChevronDerecha } from "./generated/ChevronDerechaIcon.tsx";
import { IconoChispa } from "./generated/ChispaIcon.tsx";
import { IconoComodidades } from "./generated/ComodidadesIcon.tsx";
import { IconoCompartir } from "./generated/CompartirIcon.tsx";
import { IconoComunion } from "./generated/ComunionIcon.tsx";
import { IconoConfirmar } from "./generated/ConfirmarIcon.tsx";
import { IconoCopiar } from "./generated/CopiarIcon.tsx";
import { IconoCorporativo } from "./generated/CorporativoIcon.tsx";
import { IconoCorreo } from "./generated/CorreoIcon.tsx";
import { IconoCuenta } from "./generated/CuentaIcon.tsx";
import { IconoCumpleanos } from "./generated/CumpleanosIcon.tsx";
import { IconoDescargar } from "./generated/DescargarIcon.tsx";
import { IconoDeshacer } from "./generated/DeshacerIcon.tsx";
import { IconoDuplicar } from "./generated/DuplicarIcon.tsx";
import { IconoEditar } from "./generated/EditarIcon.tsx";
import { IconoEnlace } from "./generated/EnlaceIcon.tsx";
import { IconoEntrar } from "./generated/EntrarIcon.tsx";
import { IconoError } from "./generated/ErrorIcon.tsx";
import { IconoEscritorio } from "./generated/EscritorioIcon.tsx";
import { IconoEventoFecha } from "./generated/EventoFechaIcon.tsx";
import { IconoExito } from "./generated/ExitoIcon.tsx";
import { IconoExterno } from "./generated/ExternoIcon.tsx";
import { IconoFamilia } from "./generated/FamiliaIcon.tsx";
import { IconoGaleria } from "./generated/GaleriaIcon.tsx";
import { IconoGraduacion } from "./generated/GraduacionIcon.tsx";
import { IconoGuardar } from "./generated/GuardarIcon.tsx";
import { IconoHistoria } from "./generated/HistoriaIcon.tsx";
import { IconoImagenPendiente } from "./generated/ImagenPendienteIcon.tsx";
import { IconoInfo } from "./generated/InfoIcon.tsx";
import { IconoInicio } from "./generated/InicioIcon.tsx";
import { IconoInvitacion } from "./generated/InvitacionIcon.tsx";
import { IconoInvitados } from "./generated/InvitadosIcon.tsx";
import { IconoItinerario } from "./generated/ItinerarioIcon.tsx";
import { IconoLugar } from "./generated/LugarIcon.tsx";
import { IconoMenu } from "./generated/MenuIcon.tsx";
import { IconoMesa } from "./generated/MesaIcon.tsx";
import { IconoMesaDeRegalos } from "./generated/MesaDeRegalosIcon.tsx";
import { IconoMovil } from "./generated/MovilIcon.tsx";
import { IconoNinos } from "./generated/NinosIcon.tsx";
import { IconoNota } from "./generated/NotaIcon.tsx";
import { IconoOcultar } from "./generated/OcultarIcon.tsx";
import { IconoPago } from "./generated/PagoIcon.tsx";
import { IconoPaleta } from "./generated/PaletaIcon.tsx";
import { IconoPie } from "./generated/PieIcon.tsx";
import { IconoPlan } from "./generated/PlanIcon.tsx";
import { IconoPortada } from "./generated/PortadaIcon.tsx";
import { IconoPuntoFocal } from "./generated/PuntoFocalIcon.tsx";
import { IconoQr } from "./generated/QrIcon.tsx";
import { IconoQuitar } from "./generated/QuitarIcon.tsx";
import { IconoRechazar } from "./generated/RechazarIcon.tsx";
import { IconoRecortar } from "./generated/RecortarIcon.tsx";
import { IconoRehacer } from "./generated/RehacerIcon.tsx";
import { IconoReloj } from "./generated/RelojIcon.tsx";
import { IconoRsvpConfirmado } from "./generated/RsvpConfirmadoIcon.tsx";
import { IconoSalir } from "./generated/SalirIcon.tsx";
import { IconoSubir } from "./generated/SubirIcon.tsx";
import { IconoSugerencias } from "./generated/SugerenciasIcon.tsx";
import { IconoTelefono } from "./generated/TelefonoIcon.tsx";
import { IconoTipografia } from "./generated/TipografiaIcon.tsx";
import { IconoVer } from "./generated/VerIcon.tsx";
import { IconoVestimenta } from "./generated/VestimentaIcon.tsx";
import { IconoVistaPrevia } from "./generated/VistaPreviaIcon.tsx";
import { IconoXvAnos } from "./generated/XvAnosIcon.tsx";

export type { IconProps, IconTone };

/** Nombre del paquete (compatibilidad con el esqueleto de la fase 3-C). */
export const PAQUETE = "@invitaciones/icons" as const;

export {
  IconoAdelante,
  IconoAgregar,
  IconoAjustes,
  IconoAlergia,
  IconoArrastrar,
  IconoAtras,
  IconoAviso,
  IconoAyuda,
  IconoBajar,
  IconoBautizo,
  IconoBoda,
  IconoBorrar,
  IconoBuscar,
  IconoCandado,
  IconoCargando,
  IconoCelebrantes,
  IconoCerrar,
  IconoChat,
  IconoChevronAbajo,
  IconoChevronDerecha,
  IconoChispa,
  IconoComodidades,
  IconoCompartir,
  IconoComunion,
  IconoConfirmar,
  IconoCopiar,
  IconoCorporativo,
  IconoCorreo,
  IconoCuenta,
  IconoCumpleanos,
  IconoDescargar,
  IconoDeshacer,
  IconoDuplicar,
  IconoEditar,
  IconoEnlace,
  IconoEntrar,
  IconoError,
  IconoEscritorio,
  IconoEventoFecha,
  IconoExito,
  IconoExterno,
  IconoFamilia,
  IconoGaleria,
  IconoGraduacion,
  IconoGuardar,
  IconoHistoria,
  IconoImagenPendiente,
  IconoInfo,
  IconoInicio,
  IconoInvitacion,
  IconoInvitados,
  IconoItinerario,
  IconoLugar,
  IconoMenu,
  IconoMesa,
  IconoMesaDeRegalos,
  IconoMovil,
  IconoNinos,
  IconoNota,
  IconoOcultar,
  IconoPago,
  IconoPaleta,
  IconoPie,
  IconoPlan,
  IconoPortada,
  IconoPuntoFocal,
  IconoQr,
  IconoQuitar,
  IconoRechazar,
  IconoRecortar,
  IconoRehacer,
  IconoReloj,
  IconoRsvpConfirmado,
  IconoSalir,
  IconoSubir,
  IconoSugerencias,
  IconoTelefono,
  IconoTipografia,
  IconoVer,
  IconoVestimenta,
  IconoVistaPrevia,
  IconoXvAnos,
};

export const iconNames = [
  "adelante",
  "agregar",
  "ajustes",
  "alergia",
  "arrastrar",
  "atras",
  "aviso",
  "ayuda",
  "bajar",
  "bautizo",
  "boda",
  "borrar",
  "buscar",
  "candado",
  "cargando",
  "celebrantes",
  "cerrar",
  "chat",
  "chevron-abajo",
  "chevron-derecha",
  "chispa",
  "comodidades",
  "compartir",
  "comunion",
  "confirmar",
  "copiar",
  "corporativo",
  "correo",
  "cuenta",
  "cumpleanos",
  "descargar",
  "deshacer",
  "duplicar",
  "editar",
  "enlace",
  "entrar",
  "error",
  "escritorio",
  "evento-fecha",
  "exito",
  "externo",
  "familia",
  "galeria",
  "graduacion",
  "guardar",
  "historia",
  "imagen-pendiente",
  "info",
  "inicio",
  "invitacion",
  "invitados",
  "itinerario",
  "lugar",
  "menu",
  "mesa",
  "mesa-de-regalos",
  "movil",
  "ninos",
  "nota",
  "ocultar",
  "pago",
  "paleta",
  "pie",
  "plan",
  "portada",
  "punto-focal",
  "qr",
  "quitar",
  "rechazar",
  "recortar",
  "rehacer",
  "reloj",
  "rsvp-confirmado",
  "salir",
  "subir",
  "sugerencias",
  "telefono",
  "tipografia",
  "ver",
  "vestimenta",
  "vista-previa",
  "xv-anos",
] as const;

export type IconName = (typeof iconNames)[number];

type IconoComponente = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;

const REGISTRO: Record<IconName, IconoComponente> = {
  "adelante": IconoAdelante,
  "agregar": IconoAgregar,
  "ajustes": IconoAjustes,
  "alergia": IconoAlergia,
  "arrastrar": IconoArrastrar,
  "atras": IconoAtras,
  "aviso": IconoAviso,
  "ayuda": IconoAyuda,
  "bajar": IconoBajar,
  "bautizo": IconoBautizo,
  "boda": IconoBoda,
  "borrar": IconoBorrar,
  "buscar": IconoBuscar,
  "candado": IconoCandado,
  "cargando": IconoCargando,
  "celebrantes": IconoCelebrantes,
  "cerrar": IconoCerrar,
  "chat": IconoChat,
  "chevron-abajo": IconoChevronAbajo,
  "chevron-derecha": IconoChevronDerecha,
  "chispa": IconoChispa,
  "comodidades": IconoComodidades,
  "compartir": IconoCompartir,
  "comunion": IconoComunion,
  "confirmar": IconoConfirmar,
  "copiar": IconoCopiar,
  "corporativo": IconoCorporativo,
  "correo": IconoCorreo,
  "cuenta": IconoCuenta,
  "cumpleanos": IconoCumpleanos,
  "descargar": IconoDescargar,
  "deshacer": IconoDeshacer,
  "duplicar": IconoDuplicar,
  "editar": IconoEditar,
  "enlace": IconoEnlace,
  "entrar": IconoEntrar,
  "error": IconoError,
  "escritorio": IconoEscritorio,
  "evento-fecha": IconoEventoFecha,
  "exito": IconoExito,
  "externo": IconoExterno,
  "familia": IconoFamilia,
  "galeria": IconoGaleria,
  "graduacion": IconoGraduacion,
  "guardar": IconoGuardar,
  "historia": IconoHistoria,
  "imagen-pendiente": IconoImagenPendiente,
  "info": IconoInfo,
  "inicio": IconoInicio,
  "invitacion": IconoInvitacion,
  "invitados": IconoInvitados,
  "itinerario": IconoItinerario,
  "lugar": IconoLugar,
  "menu": IconoMenu,
  "mesa": IconoMesa,
  "mesa-de-regalos": IconoMesaDeRegalos,
  "movil": IconoMovil,
  "ninos": IconoNinos,
  "nota": IconoNota,
  "ocultar": IconoOcultar,
  "pago": IconoPago,
  "paleta": IconoPaleta,
  "pie": IconoPie,
  "plan": IconoPlan,
  "portada": IconoPortada,
  "punto-focal": IconoPuntoFocal,
  "qr": IconoQr,
  "quitar": IconoQuitar,
  "rechazar": IconoRechazar,
  "recortar": IconoRecortar,
  "rehacer": IconoRehacer,
  "reloj": IconoReloj,
  "rsvp-confirmado": IconoRsvpConfirmado,
  "salir": IconoSalir,
  "subir": IconoSubir,
  "sugerencias": IconoSugerencias,
  "telefono": IconoTelefono,
  "tipografia": IconoTipografia,
  "ver": IconoVer,
  "vestimenta": IconoVestimenta,
  "vista-previa": IconoVistaPrevia,
  "xv-anos": IconoXvAnos,
};

/** Icono genérico por nombre: `createElement(Icon, { name: "inicio" })` o `<Icon name="inicio" />` en un `.tsx`. */
export const Icon = forwardRef<SVGSVGElement, IconProps & { name: IconName }>(function Icon(
  { name, ...resto },
  ref,
) {
  return createElement(REGISTRO[name], { ref, ...resto });
});
