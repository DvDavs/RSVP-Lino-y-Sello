// packages/ui/src/historias/registro.ts — ÚNICO punto donde se enumeran las historias. Cada familia
// del bloque 2 añade UNA línea por componente (orden alfabético por slug) y su import arriba; el
// orquestador resuelve el merge conservando todas las líneas.
import type { Historia } from "./tipos.ts";
import { historias as historiasButton } from "../componentes/Button/Button.historias.tsx";
import { historias as historiasCheckbox } from "../componentes/Checkbox/Checkbox.historias.tsx";
import { historias as historiasChip } from "../componentes/Chip/Chip.historias.tsx";
import { historias as historiasCombobox } from "../componentes/Combobox/Combobox.historias.tsx";
import { historias as historiasField } from "../componentes/Field/Field.historias.tsx";
import { historias as historiasInput } from "../componentes/Input/Input.historias.tsx";
import { historias as historiasRadioGroup } from "../componentes/RadioGroup/RadioGroup.historias.tsx";
import { historias as historiasSelect } from "../componentes/Select/Select.historias.tsx";
import { historias as historiasSwitch } from "../componentes/Switch/Switch.historias.tsx";
import { historias as historiasTextarea } from "../componentes/Textarea/Textarea.historias.tsx";

export const registro: readonly Historia[] = [
  // F1 formularios · F2 superficies y navegación · F3 estados e imagen
  ...historiasButton,
  ...historiasCheckbox,
  ...historiasChip,
  ...historiasCombobox,
  ...historiasField,
  ...historiasInput,
  ...historiasRadioGroup,
  ...historiasSelect,
  ...historiasSwitch,
  ...historiasTextarea,
];

export function historiaPorSlug(slug: string): Historia | undefined {
  return registro.find((h) => h.slug === slug);
}
