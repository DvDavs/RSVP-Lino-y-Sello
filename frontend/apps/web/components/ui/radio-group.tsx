"use client";

// components/ui/radio-group.tsx — 04 §18: `radiogroup` para ≤ 5 opciones (variante de sección,
// `choice`). Envoltorio delgado sobre Radix con las clases del chrome.
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import type { ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export const RadioGroup = RadioGroupPrimitive.Root;

export function RadioGroupItem({
  value,
  id,
  className,
  children,
  ...resto
}: RadioGroupPrimitive.RadioGroupItemProps & { children?: ReactNode }) {
  return (
    <RadioGroupPrimitive.Item
      value={value}
      id={id}
      className={twMerge(
        "flex size-5 shrink-0 items-center justify-center rounded-full border border-ui-border-field bg-white data-[state=checked]:border-ui-primary",
        className,
      )}
      {...resto}
    >
      <RadioGroupPrimitive.Indicator asChild>
        <span className="size-2.5 rounded-full bg-ui-primary" />
      </RadioGroupPrimitive.Indicator>
      {children}
    </RadioGroupPrimitive.Item>
  );
}
