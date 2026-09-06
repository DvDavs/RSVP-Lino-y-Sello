// components/editor/iconos-de-seccion.ts — un icono del sistema por cada uno de los doce
// `SectionType` de `packages/sections` (`04 §5.2`). Los nombres salen del inventario canónico de
// `11 §4.2` («Secciones de invitación», 15 nombres): la fila de sección del editor los usa para que
// la lista se lea de un vistazo sin depender solo del texto (`11 §7`, fila «Chrome del editor»).
//
// El mapa es TOTAL sobre `SectionType` (`Record<SectionType, …>`): si el registro gana un tipo, esto
// deja de compilar en vez de degradar en silencio a un icono genérico.
import type { ComponentType } from "react";
import type { SectionType } from "@invitaciones/schema";
import {
  IconoCelebrantes,
  IconoComodidades,
  IconoEventoFecha,
  IconoFamilia,
  IconoGaleria,
  IconoHistoria,
  IconoMesaDeRegalos,
  IconoPie,
  IconoPortada,
  IconoRsvpConfirmado,
  IconoSugerencias,
  IconoVestimenta,
  type IconProps,
} from "@invitaciones/icons";

export const ICONO_DE_SECCION: Record<SectionType, ComponentType<IconProps>> = {
  cover: IconoPortada,
  celebrant: IconoCelebrantes,
  event: IconoEventoFecha,
  gallery: IconoGaleria,
  story: IconoHistoria,
  dressCode: IconoVestimenta,
  giftTable: IconoMesaDeRegalos,
  suggestions: IconoSugerencias,
  amenities: IconoComodidades,
  rsvp: IconoRsvpConfirmado,
  family: IconoFamilia,
  footer: IconoPie,
};
