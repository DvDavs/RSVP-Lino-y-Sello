"use client";

// components/fields/ScalarBlockField.tsx — despachador: UN `BlockSpec` escalar (13 de los 14 tipos;
// el 14.º es `group`, que resuelve `GroupField`/`PhotoManager`) → el componente de `components/fields/`
// que le corresponde. Punto ÚNICO de mapeo tipo → campo, para que `BlockForm` y `GroupItemFields` no
// dupliquen el `switch`.
import type { GroupSpec, ScalarValue, BlockSpec as BlockSpecUnion } from "@invitaciones/schema";
import type { ResolvedValue } from "@/lib/block-types.ts";
import { AudioField } from "./AudioField.tsx";
import { BooleanField } from "./BooleanField.tsx";
import { ChoiceField } from "./ChoiceField.tsx";
import { DateField } from "./DateField.tsx";
import { DateTimeRangeField } from "./DateTimeRangeField.tsx";
import { ImageField } from "./ImageField.tsx";
import { LinkField } from "./LinkField.tsx";
import { ListTextField } from "./ListTextField.tsx";
import { LocationField } from "./LocationField.tsx";
import { PersonField } from "./PersonField.tsx";
import { RichTextField } from "./RichTextField.tsx";
import { TextField } from "./TextField.tsx";
import { TimeField } from "./TimeField.tsx";

export type ScalarSpec = Exclude<BlockSpecUnion, GroupSpec>;

export interface ScalarBlockFieldProps {
  id: string;
  invitationId: number;
  spec: ScalarSpec;
  /** Valor RESUELTO (con `url` para `image`/`audio`); `null` si el bloque no tiene valor (R2). */
  composedValue: ResolvedValue | null;
  /** Valor CRUDO del documento (`document.content[blockId]`): solo se usa para `assetId` (04 §13,
   *  `assetId` no viaja en `ComposedDocument`, `contratos.md §3`). Nunca es un grupo: este
   *  despachador solo atiende bloques escalares (el 14.º tipo, `group`, lo resuelve `GroupField`). */
  rawValue: ScalarValue | null;
  esContenidoDeEjemplo?: boolean;
  onCommit: (value: ScalarValue) => void;
}

export function ScalarBlockField({ id, invitationId, spec, composedValue, rawValue, esContenidoDeEjemplo, onCommit }: ScalarBlockFieldProps) {
  const esDecorativo = spec.role === "decorative";

  switch (spec.type) {
    case "text":
      return (
        <TextField
          id={id}
          spec={spec}
          value={composedValue?.kind === "text" ? composedValue.value : ""}
          esContenidoDeEjemplo={esContenidoDeEjemplo}
          onCommit={onCommit}
        />
      );
    case "richText":
      return (
        <RichTextField
          id={id}
          spec={spec}
          value={composedValue?.kind === "richText" ? composedValue.doc : { type: "doc", content: [] }}
          esContenidoDeEjemplo={esContenidoDeEjemplo}
          onCommit={onCommit}
        />
      );
    case "listText":
      return (
        <ListTextField
          id={id}
          spec={spec}
          value={composedValue?.kind === "listText" ? composedValue.items : []}
          esContenidoDeEjemplo={esContenidoDeEjemplo}
          onCommit={onCommit}
        />
      );
    case "image": {
      const assetId = rawValue?.kind === "image" ? rawValue.assetId : null;
      const resuelto = composedValue?.kind === "image" ? composedValue : null;
      return (
        <ImageField
          id={id}
          invitationId={invitationId}
          spec={spec}
          esDecorativo={esDecorativo}
          value={assetId && resuelto ? { assetId, url: resuelto.url, alt: resuelto.alt, focal: resuelto.focal } : null}
          esContenidoDeEjemplo={esContenidoDeEjemplo}
          onCommit={onCommit}
        />
      );
    }
    case "audio":
      return (
        <AudioField
          id={id}
          invitationId={invitationId}
          spec={spec}
          value={composedValue?.kind === "audio" ? { url: composedValue.url } : null}
          esContenidoDeEjemplo={esContenidoDeEjemplo}
          onCommit={onCommit}
        />
      );
    case "date":
      return (
        <DateField
          id={id}
          spec={spec}
          value={composedValue?.kind === "date" ? composedValue.value : ""}
          esContenidoDeEjemplo={esContenidoDeEjemplo}
          onCommit={onCommit}
        />
      );
    case "time":
      return (
        <TimeField
          id={id}
          spec={spec}
          value={composedValue?.kind === "time" ? composedValue.value : ""}
          esContenidoDeEjemplo={esContenidoDeEjemplo}
          onCommit={onCommit}
        />
      );
    case "dateTimeRange":
      return (
        <DateTimeRangeField
          id={id}
          spec={spec}
          value={
            composedValue?.kind === "dateTimeRange"
              ? { start: composedValue.start, end: composedValue.end }
              : { start: "" }
          }
          esContenidoDeEjemplo={esContenidoDeEjemplo}
          onCommit={onCommit}
        />
      );
    case "link":
      return (
        <LinkField
          id={id}
          spec={spec}
          value={composedValue?.kind === "link" ? { href: composedValue.href, label: composedValue.label } : { href: "" }}
          esContenidoDeEjemplo={esContenidoDeEjemplo}
          onCommit={onCommit}
        />
      );
    case "location":
      return (
        <LocationField
          id={id}
          spec={spec}
          value={
            composedValue?.kind === "location"
              ? { name: composedValue.name, address: composedValue.address, mapHref: composedValue.mapHref }
              : { name: "" }
          }
          esContenidoDeEjemplo={esContenidoDeEjemplo}
          onCommit={onCommit}
        />
      );
    case "choice":
      return (
        <ChoiceField
          id={id}
          spec={spec}
          value={composedValue?.kind === "choice" ? composedValue.optionId : null}
          esContenidoDeEjemplo={esContenidoDeEjemplo}
          onCommit={onCommit}
        />
      );
    case "boolean":
      return (
        <BooleanField
          id={id}
          spec={spec}
          value={composedValue?.kind === "boolean" ? composedValue.value : false}
          esContenidoDeEjemplo={esContenidoDeEjemplo}
          onCommit={onCommit}
        />
      );
    case "person":
      return (
        <PersonField
          id={id}
          spec={spec}
          value={composedValue?.kind === "person" ? { name: composedValue.name, note: composedValue.note } : { name: "" }}
          esContenidoDeEjemplo={esContenidoDeEjemplo}
          onCommit={onCommit}
        />
      );
  }
}
