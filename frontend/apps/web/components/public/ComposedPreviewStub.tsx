// components/public/ComposedPreviewStub.tsx — STUB LOCAL DE `packages/sections` (que otro agente
// construye en paralelo, en otro worktree; prohibido tocarlo, ver `docs/.../memoria/handoffs/3-1.md`).
// Pinta el `ComposedDocument` con los mecanismos MÍNIMOS que P3/§19 permiten: solo los seis colores
// de `theme.tokens` (nunca un color de Tailwind ni del chrome) y sin JS de edición (`mode="public"`
// nunca lleva `onClick`/`data-block-*`, 04 §5.3 U-07). El bloque 3-3 (render público) y 3-4/3-5
// (editor) SUSTITUYEN este componente por `SectionsRoot` de `@invitaciones/sections` en cuanto ese
// paquete exista en el workspace — es una función pura, sin estado, fácil de intercambiar.
import type { ComposedDocument } from "@invitaciones/schema";

// `composed.ts` solo exporta el TIPO de `ComposedDocument` (no el de `ComposedSection`/
// `ComposedBlock`/`ComposedGroup` por separado); se derivan por acceso indexado, que es estable
// ante refactors del paquete de esquema (P1, sin duplicar la forma a mano).
type Seccion = ComposedDocument["sections"][number];
type BloqueOGrupo = Seccion["blocks"][number];
// Distribuye sobre la unión (solo funciona con un parámetro de tipo "desnudo", de ahí el genérico):
// solo `ComposedBlock` tiene `value` (`ComposedGroup` tiene `items`), así que la rama de grupo se
// descarta sola con `never` en vez de colapsar la unión entera a `never`.
type ValorDe<T> = T extends { value: infer V } ? V : never;
type ValorResuelto = NonNullable<ValorDe<BloqueOGrupo>>;

function textoDeValor(valor: ValorResuelto): string {
  if (!valor) return "";
  switch (valor.kind) {
    case "text":
      return valor.value;
    case "richText":
      return valor.doc.content.map((p) => p.content.map((s) => s.text).join("")).join(" ");
    case "listText":
      return valor.items.join(" · ");
    case "date":
    case "time":
    case "dateTimeRange":
      return valor.formatted;
    case "link":
      return valor.label ?? valor.href;
    case "location":
      return [valor.name, valor.address].filter(Boolean).join(", ");
    case "choice":
      return valor.label;
    case "boolean":
      return valor.value ? "Sí" : "No";
    case "person":
      return valor.name;
    default:
      return "";
  }
}

export function ComposedPreviewStub({ composed }: { composed: ComposedDocument }) {
  const { tokens } = composed.theme;
  return (
    <div
      style={{
        background: tokens.bg,
        color: tokens.ink,
        minHeight: "100vh",
        fontFamily: `${composed.theme.fonts.body.family}, serif`,
      }}
    >
      {composed.sections
        .filter((seccion) => seccion.visible)
        .map((seccion) => (
          <section
            key={seccion.key}
            style={{ background: tokens.surface, padding: "2rem", borderBottom: `1px solid ${tokens.muted}` }}
          >
            <h2 style={{ color: tokens.accentInk }}>{seccion.title}</h2>
            {seccion.blocks.map((bloque) => {
              // `ComposedBlock.type` es `BlockKind` (incluye el literal "group" en su propio
              // catálogo) y `ComposedGroup.type` es `z.literal("group")`: comparar por `type` NO
              // discrimina la unión de forma segura para TypeScript. Se discrimina por la
              // propiedad `items`, que solo existe en `ComposedGroup` (R7, `01 §5.2`).
              if ("items" in bloque) {
                return (
                  <ul key={bloque.id}>
                    {bloque.items.map((item) => (
                      <li key={item.itemId}>
                        {item.blocks
                          .map((b) => (b.value ? textoDeValor(b.value) : null))
                          .filter(Boolean)
                          .join(" — ")}
                      </li>
                    ))}
                  </ul>
                );
              }
              if (!bloque.value) return null;
              return <p key={bloque.id}>{textoDeValor(bloque.value)}</p>;
            })}
          </section>
        ))}
    </div>
  );
}
