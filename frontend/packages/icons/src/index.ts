// Generado por scripts/generar.ts a partir de svg/*.svg. No editar a mano.
import { createElement } from "react";
import type { ComponentType } from "react";
import { AlergiaIcon } from "./generated/AlergiaIcon.tsx";
import { AvisoIcon } from "./generated/AvisoIcon.tsx";
import { BautizoIcon } from "./generated/BautizoIcon.tsx";
import { BodaIcon } from "./generated/BodaIcon.tsx";
import { CandadoIcon } from "./generated/CandadoIcon.tsx";
import { CargandoIcon } from "./generated/CargandoIcon.tsx";
import { ChatIcon } from "./generated/ChatIcon.tsx";
import { ChispaIcon } from "./generated/ChispaIcon.tsx";
import { CompartirIcon } from "./generated/CompartirIcon.tsx";
import { ComunionIcon } from "./generated/ComunionIcon.tsx";
import { ConfirmarIcon } from "./generated/ConfirmarIcon.tsx";
import { CopiarIcon } from "./generated/CopiarIcon.tsx";
import { CorporativoIcon } from "./generated/CorporativoIcon.tsx";
import { CorreoIcon } from "./generated/CorreoIcon.tsx";
import { CuentaIcon } from "./generated/CuentaIcon.tsx";
import { CumpleanosIcon } from "./generated/CumpleanosIcon.tsx";
import { DescargarIcon } from "./generated/DescargarIcon.tsx";
import { EnlaceIcon } from "./generated/EnlaceIcon.tsx";
import { EntrarIcon } from "./generated/EntrarIcon.tsx";
import { ErrorIcon } from "./generated/ErrorIcon.tsx";
import { ExitoIcon } from "./generated/ExitoIcon.tsx";
import { GraduacionIcon } from "./generated/GraduacionIcon.tsx";
import { HistoriaIcon } from "./generated/HistoriaIcon.tsx";
import { ImagenPendienteIcon } from "./generated/ImagenPendienteIcon.tsx";
import { InfoIcon } from "./generated/InfoIcon.tsx";
import { InvitacionIcon } from "./generated/InvitacionIcon.tsx";
import { InvitadosIcon } from "./generated/InvitadosIcon.tsx";
import { LugarIcon } from "./generated/LugarIcon.tsx";
import { MesaIcon } from "./generated/MesaIcon.tsx";
import { NinosIcon } from "./generated/NinosIcon.tsx";
import { NotaIcon } from "./generated/NotaIcon.tsx";
import { PagoIcon } from "./generated/PagoIcon.tsx";
import { PieIcon } from "./generated/PieIcon.tsx";
import { PlanIcon } from "./generated/PlanIcon.tsx";
import { QrIcon } from "./generated/QrIcon.tsx";
import { RechazarIcon } from "./generated/RechazarIcon.tsx";
import { RelojIcon } from "./generated/RelojIcon.tsx";
import { SalirIcon } from "./generated/SalirIcon.tsx";
import { TelefonoIcon } from "./generated/TelefonoIcon.tsx";
import { VestimentaIcon } from "./generated/VestimentaIcon.tsx";
import { XvAnosIcon } from "./generated/XvAnosIcon.tsx";
import type { IconoProps } from "./tipos.ts";

export type { IconoProps, IconoTono } from "./tipos.ts";
export { AlergiaIcon } from "./generated/AlergiaIcon.tsx";
export { AvisoIcon } from "./generated/AvisoIcon.tsx";
export { BautizoIcon } from "./generated/BautizoIcon.tsx";
export { BodaIcon } from "./generated/BodaIcon.tsx";
export { CandadoIcon } from "./generated/CandadoIcon.tsx";
export { CargandoIcon } from "./generated/CargandoIcon.tsx";
export { ChatIcon } from "./generated/ChatIcon.tsx";
export { ChispaIcon } from "./generated/ChispaIcon.tsx";
export { CompartirIcon } from "./generated/CompartirIcon.tsx";
export { ComunionIcon } from "./generated/ComunionIcon.tsx";
export { ConfirmarIcon } from "./generated/ConfirmarIcon.tsx";
export { CopiarIcon } from "./generated/CopiarIcon.tsx";
export { CorporativoIcon } from "./generated/CorporativoIcon.tsx";
export { CorreoIcon } from "./generated/CorreoIcon.tsx";
export { CuentaIcon } from "./generated/CuentaIcon.tsx";
export { CumpleanosIcon } from "./generated/CumpleanosIcon.tsx";
export { DescargarIcon } from "./generated/DescargarIcon.tsx";
export { EnlaceIcon } from "./generated/EnlaceIcon.tsx";
export { EntrarIcon } from "./generated/EntrarIcon.tsx";
export { ErrorIcon } from "./generated/ErrorIcon.tsx";
export { ExitoIcon } from "./generated/ExitoIcon.tsx";
export { GraduacionIcon } from "./generated/GraduacionIcon.tsx";
export { HistoriaIcon } from "./generated/HistoriaIcon.tsx";
export { ImagenPendienteIcon } from "./generated/ImagenPendienteIcon.tsx";
export { InfoIcon } from "./generated/InfoIcon.tsx";
export { InvitacionIcon } from "./generated/InvitacionIcon.tsx";
export { InvitadosIcon } from "./generated/InvitadosIcon.tsx";
export { LugarIcon } from "./generated/LugarIcon.tsx";
export { MesaIcon } from "./generated/MesaIcon.tsx";
export { NinosIcon } from "./generated/NinosIcon.tsx";
export { NotaIcon } from "./generated/NotaIcon.tsx";
export { PagoIcon } from "./generated/PagoIcon.tsx";
export { PieIcon } from "./generated/PieIcon.tsx";
export { PlanIcon } from "./generated/PlanIcon.tsx";
export { QrIcon } from "./generated/QrIcon.tsx";
export { RechazarIcon } from "./generated/RechazarIcon.tsx";
export { RelojIcon } from "./generated/RelojIcon.tsx";
export { SalirIcon } from "./generated/SalirIcon.tsx";
export { TelefonoIcon } from "./generated/TelefonoIcon.tsx";
export { VestimentaIcon } from "./generated/VestimentaIcon.tsx";
export { XvAnosIcon } from "./generated/XvAnosIcon.tsx";

export const iconNames = ["alergia", "aviso", "bautizo", "boda", "candado", "cargando", "chat", "chispa", "compartir", "comunion", "confirmar", "copiar", "corporativo", "correo", "cuenta", "cumpleanos", "descargar", "enlace", "entrar", "error", "exito", "graduacion", "historia", "imagen-pendiente", "info", "invitacion", "invitados", "lugar", "mesa", "ninos", "nota", "pago", "pie", "plan", "qr", "rechazar", "reloj", "salir", "telefono", "vestimenta", "xv-anos"] as const;
export type IconName = (typeof iconNames)[number];

const registro: Record<IconName, ComponentType<IconoProps>> = {
  "alergia": AlergiaIcon,
  "aviso": AvisoIcon,
  "bautizo": BautizoIcon,
  "boda": BodaIcon,
  "candado": CandadoIcon,
  "cargando": CargandoIcon,
  "chat": ChatIcon,
  "chispa": ChispaIcon,
  "compartir": CompartirIcon,
  "comunion": ComunionIcon,
  "confirmar": ConfirmarIcon,
  "copiar": CopiarIcon,
  "corporativo": CorporativoIcon,
  "correo": CorreoIcon,
  "cuenta": CuentaIcon,
  "cumpleanos": CumpleanosIcon,
  "descargar": DescargarIcon,
  "enlace": EnlaceIcon,
  "entrar": EntrarIcon,
  "error": ErrorIcon,
  "exito": ExitoIcon,
  "graduacion": GraduacionIcon,
  "historia": HistoriaIcon,
  "imagen-pendiente": ImagenPendienteIcon,
  "info": InfoIcon,
  "invitacion": InvitacionIcon,
  "invitados": InvitadosIcon,
  "lugar": LugarIcon,
  "mesa": MesaIcon,
  "ninos": NinosIcon,
  "nota": NotaIcon,
  "pago": PagoIcon,
  "pie": PieIcon,
  "plan": PlanIcon,
  "qr": QrIcon,
  "rechazar": RechazarIcon,
  "reloj": RelojIcon,
  "salir": SalirIcon,
  "telefono": TelefonoIcon,
  "vestimenta": VestimentaIcon,
  "xv-anos": XvAnosIcon,
};

/** Icono genérico por nombre: `<Icon name="historia" />`. Para el uso normal, preferir el
 * componente con nombre propio (`<HistoriaIcon />`) — este existe para listas dirigidas por datos
 * (p. ej. el buscador de la galería `/design/iconos`). */
export function Icon({ name, ...props }: IconoProps & { name: IconName }) {
  const Componente = registro[name];
  return createElement(Componente, props);
}
