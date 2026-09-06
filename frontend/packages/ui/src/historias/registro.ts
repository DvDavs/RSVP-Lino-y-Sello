// packages/ui/src/historias/registro.ts — ÚNICO punto donde se enumeran las historias con sus
// `render()`. SOLO se importa desde componentes cliente (subpath `@invitaciones/ui/historias`):
// varias historias son módulos "use client" y, evaluadas desde un Server Component, llegan como
// referencias cliente sin `slug`. Su gemelo seguro para servidor es `metadatos.ts` (una prueba los
// compara). Convención: F1 y F3 exportan `historias: readonly Historia[]` (se expanden con `...`);
// F2 exporta `historias: Historia` (una por componente). Orden final: alfabético por slug.
import type { Historia } from "./tipos.ts";
import { historias as avatar } from "../componentes/Avatar/Avatar.historias.tsx";
import { historias as badge } from "../componentes/Badge/Badge.historias.tsx";
import { historias as breadcrumb } from "../componentes/Breadcrumb/Breadcrumb.historias.tsx";
import { historias as card } from "../componentes/Card/Card.historias.tsx";
import { historias as dialog } from "../componentes/Dialog/Dialog.historias.tsx";
import { historias as historiasButton } from "../componentes/Button/Button.historias.tsx";
import { historias as historiasCheckbox } from "../componentes/Checkbox/Checkbox.historias.tsx";
import { historias as historiasChip } from "../componentes/Chip/Chip.historias.tsx";
import { historias as historiasCombobox } from "../componentes/Combobox/Combobox.historias.tsx";
import { historias as historiasEmptyState } from "../componentes/EmptyState.historias.tsx";
import { historias as historiasField } from "../componentes/Field/Field.historias.tsx";
import { historias as historiasImage } from "../componentes/Image.historias.tsx";
import { historias as historiasInput } from "../componentes/Input/Input.historias.tsx";
import { historias as historiasRadioGroup } from "../componentes/RadioGroup/RadioGroup.historias.tsx";
import { historias as historiasSelect } from "../componentes/Select/Select.historias.tsx";
import { historias as historiasSkeleton } from "../componentes/Skeleton.historias.tsx";
import { historias as historiasSwitch } from "../componentes/Switch/Switch.historias.tsx";
import { historias as historiasTextarea } from "../componentes/Textarea/Textarea.historias.tsx";
import { historias as progressRing } from "../componentes/ProgressRing/ProgressRing.historias.tsx";
import { historias as sheet } from "../componentes/Sheet/Sheet.historias.tsx";
import { historias as stepper } from "../componentes/Stepper/Stepper.historias.tsx";
import { historias as tabs } from "../componentes/Tabs/Tabs.historias.tsx";
import { historias as toast } from "../componentes/Toast/Toast.historias.tsx";
import { historias as tooltip } from "../componentes/Tooltip/Tooltip.historias.tsx";
import { historias as wizardProgress } from "../componentes/WizardProgress/WizardProgress.historias.tsx";

const ENTRADAS: readonly Historia[] = [
  ...historiasButton,
  ...historiasCheckbox,
  ...historiasChip,
  ...historiasCombobox,
  ...historiasEmptyState,
  ...historiasField,
  ...historiasImage,
  ...historiasInput,
  ...historiasRadioGroup,
  ...historiasSelect,
  ...historiasSkeleton,
  ...historiasSwitch,
  ...historiasTextarea,
  avatar,
  badge,
  breadcrumb,
  card,
  dialog,
  progressRing,
  sheet,
  stepper,
  tabs,
  toast,
  tooltip,
  wizardProgress,
];

/** Ordenado por `slug` para que la galería y las pruebas no dependan del orden de integración. */
export const registro: readonly Historia[] = [...ENTRADAS].sort((a, b) => a.slug.localeCompare(b.slug, "es"));

export function historiaPorSlug(slug: string): Historia | undefined {
  return registro.find((h) => h.slug === slug);
}
