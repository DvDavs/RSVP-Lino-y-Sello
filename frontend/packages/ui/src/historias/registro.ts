// packages/ui/src/historias/registro.ts — ÚNICO punto donde se enumeran las historias. Cada familia
// del bloque 2 añade UNA línea por componente (orden alfabético por slug) y su import arriba; el
// orquestador resuelve el merge conservando todas las líneas.
import type { Historia } from "./tipos.ts";
import { historias as avatar } from "../componentes/Avatar/Avatar.historias.tsx";
import { historias as badge } from "../componentes/Badge/Badge.historias.tsx";
import { historias as breadcrumb } from "../componentes/Breadcrumb/Breadcrumb.historias.tsx";
import { historias as card } from "../componentes/Card/Card.historias.tsx";
import { historias as dialog } from "../componentes/Dialog/Dialog.historias.tsx";
import { historias as progressRing } from "../componentes/ProgressRing/ProgressRing.historias.tsx";
import { historias as sheet } from "../componentes/Sheet/Sheet.historias.tsx";
import { historias as stepper } from "../componentes/Stepper/Stepper.historias.tsx";
import { historias as tabs } from "../componentes/Tabs/Tabs.historias.tsx";
import { historias as toast } from "../componentes/Toast/Toast.historias.tsx";
import { historias as tooltip } from "../componentes/Tooltip/Tooltip.historias.tsx";
import { historias as wizardProgress } from "../componentes/WizardProgress/WizardProgress.historias.tsx";

export const registro: readonly Historia[] = [
  // F1 formularios · F2 superficies y navegación · F3 estados e imagen
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

export function historiaPorSlug(slug: string): Historia | undefined {
  return registro.find((h) => h.slug === slug);
}
