// packages/ui/src/historias/metadatos.ts — GENERADO desde registro.ts por el orquestador al integrar
// el bloque 2 (evaluando el registro bajo Vitest; regenerar con el mismo método si cambia una historia).
// Gemelo SEGURO para Server Components: sin render() ni módulos "use client". metadatos.test.ts rompe si
// diverge de registro.
import type { FamiliaHistoria } from "./tipos.ts";

export interface MetadatoHistoria {
  readonly slug: string;
  readonly nombre: string;
  readonly familia: FamiliaHistoria;
  readonly descripcion: string;
}

export const metadatos: readonly MetadatoHistoria[] = [
  {
    slug: "avatar",
    nombre: "Avatar",
    familia: "superficies",
    descripcion:
      "Retrato de 44 px (36 en listas). Iniciales por defecto; foto con máscara circular si existe.",
  },
  {
    slug: "badge",
    nombre: "Badge",
    familia: "superficies",
    descripcion:
      "Insignia de 22 px, mono 11 en mayúsculas. El texto va siempre: nunca solo un punto de color.",
  },
  {
    slug: "breadcrumb",
    nombre: "Breadcrumb",
    familia: "navegacion",
    descripcion:
      "Ruta de navegación, solo en escritorio. El último tramo es texto con aria-current=page; en móvil lo sustituye el Stepper o un botón «Atrás».",
  },
  {
    slug: "button",
    nombre: "Button",
    familia: "formularios",
    descripcion:
      "Botón píldora con seis variantes, tres tamaños y estado de carga con aria-busy y texto visible.",
  },
  {
    slug: "card",
    nombre: "Card",
    familia: "superficies",
    descripcion:
      "Tarjeta con cuatro variantes: plana (borde, listas y filas), elevada (diálogos y menús), sombra de color (la destacada, una por vista) y tinta (banda de apoyo). Sin hover de elevación en rejillas.",
  },
  {
    slug: "checkbox",
    nombre: "Checkbox",
    familia: "formularios",
    descripcion:
      "Casilla de 26 px; con label, la fila entera es el objetivo (>= 44 px).",
  },
  {
    slug: "chip",
    nombre: "Chip",
    familia: "formularios",
    descripcion:
      "Píldora de 34 px: seleccionable, de estado, con icono o cerrable.",
  },
  {
    slug: "combobox",
    nombre: "Combobox",
    familia: "formularios",
    descripcion:
      "Selector con búsqueda para listas largas: campo + panel propio, aria-activedescendant.",
  },
  {
    slug: "dialog",
    nombre: "Dialog",
    familia: "superficies",
    descripcion:
      "Diálogo modal con foco atrapado y devuelto, título y descripción accesibles obligatorios. Esc y el clic fuera cierran, salvo en el estado ocupado (publicando).",
  },
  {
    slug: "empty-state",
    nombre: "EmptyState",
    familia: "estados",
    descripcion:
      "Ilustración del sistema (§4.3) + título display-sm + una frase + una sola acción. Nunca dos botones primarios en un estado vacío.",
  },
  {
    slug: "field",
    nombre: "Field",
    familia: "formularios",
    descripcion:
      "Etiqueta, ayuda y error con aria-describedby/aria-invalid, para cualquier control.",
  },
  {
    slug: "image",
    nombre: "Image",
    familia: "imagen",
    descripcion:
      "Toda fotografía del producto: máscara o radio ≥ 24 px (§3.1), placeholder del sistema sin foto, alt obligatorio salvo decorative.",
  },
  {
    slug: "input",
    nombre: "Input",
    familia: "formularios",
    descripcion:
      "Control de texto de 46 px con borde de 1,5 px, foco de 2 px y error con aria-invalid.",
  },
  {
    slug: "progress-ring",
    nombre: "ProgressRing",
    familia: "superficies",
    descripcion:
      "Anillo de 72 px, trazo de 7. El número va siempre como texto (nunca solo el arco); role=progressbar con aria-valuenow/valuetext.",
  },
  {
    slug: "radio-group",
    nombre: "RadioGroup",
    familia: "formularios",
    descripcion:
      "Radios de 26 px; cada fila es el objetivo (>= 44 px). Flechas para moverse entre opciones.",
  },
  {
    slug: "select",
    nombre: "Select",
    familia: "formularios",
    descripcion:
      "Selector propio para listas de hasta 5 opciones fijas; Radix Select por debajo.",
  },
  {
    slug: "sheet",
    nombre: "Sheet",
    familia: "superficies",
    descripcion:
      "Hoja inferior: la versión móvil del diálogo. Asa de arrastre decorativa, borde superior redondeado y acción primaria pegada abajo con safe-area-inset.",
  },
  {
    slug: "skeleton",
    nombre: "Skeleton",
    familia: "estados",
    descripcion:
      "Progreso, nunca pantalla vacía (11 §6.2 regla 6): brillo lento que prefers-reduced-motion apaga. aria-busy en el contenedor, aria-hidden en las barras.",
  },
  {
    slug: "stepper",
    nombre: "Stepper",
    familia: "superficies",
    descripcion:
      "Contador numérico con botones ≥ 44 px («Restar/Sumar <campo>», nunca «+»/«−» mudos). Se deshabilita en los límites sin dejar de decir a quién pertenece el campo.",
  },
  {
    slug: "switch",
    nombre: "Switch",
    familia: "formularios",
    descripcion:
      "Interruptor de 48 × 28 con bolita de 22 px y transición de rebote suave.",
  },
  {
    slug: "tabs",
    nombre: "Tabs",
    familia: "navegacion",
    descripcion:
      "Pestañas con activación manual (mover el foco con las flechas no cambia el panel hasta Enter o Espacio). Píldora contenedora en surface-alt; la activa resalta con surface-raised y shadow-ui-1.",
  },
  {
    slug: "textarea",
    nombre: "Textarea",
    familia: "formularios",
    descripcion:
      "Como Input, alto mínimo 96 px; contador «n/límite» que aparece al 80 % del límite.",
  },
  {
    slug: "toast",
    nombre: "Toast",
    familia: "superficies",
    descripcion:
      "Aviso informativo que aparece arriba centrado y desaparece solo (4 s por defecto). Región role=status/aria-live=polite, cola con tope de 2 y botón de cerrar siempre presente. Un error que exige una decisión de la persona NO es un toast: usa Dialog/Sheet o un banner.",
  },
  {
    slug: "tooltip",
    nombre: "Tooltip",
    familia: "superficies",
    descripcion:
      "Información complementaria al enfocar (sin retardo) o al pasar el ratón. Nunca es el único portador de una información: en táctil no aparece.",
  },
  {
    slug: "wizard-progress",
    nombre: "WizardProgress",
    familia: "navegacion",
    descripcion:
      "Progreso del asistente de creación: círculos con número o check, líneas entre pasos y el texto «Paso N de M». Los pasos hechos son enlaces para volver atrás.",
  },
];
