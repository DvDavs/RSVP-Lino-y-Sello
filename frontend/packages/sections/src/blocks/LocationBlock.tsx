// packages/sections/src/blocks/LocationBlock.tsx — tipo 10/14.
import type { BlockComponentProps } from "./types.ts";
import { isSafeHttpUrl } from "./url.ts";
import { activationAttrs } from "./activation.ts";
import styles from "./blocks.module.css";
import shared from "../styles/shared.module.css";

export function LocationBlock({ block, mode, onActivate, ref_, pending }: BlockComponentProps) {
  if (block.value === null || block.value.kind !== "location") return null;
  const { name, address, mapHref } = block.value;
  return (
    <span
      className={`${styles.location} ${shared.focusRing} ${shared.transition}`}
      {...activationAttrs(mode, ref_, onActivate, pending)}
    >
      <span className={styles.locationName}>{name}</span>
      {address !== undefined && address !== "" ? (
        <span className={styles.locationAddress}>{address}</span>
      ) : null}
      {mapHref !== undefined && isSafeHttpUrl(mapHref) ? (
        <a
          className={`${styles.link} ${shared.focusRing} ${shared.touchTarget}`}
          href={mapHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          Ver en el mapa
        </a>
      ) : null}
    </span>
  );
}
