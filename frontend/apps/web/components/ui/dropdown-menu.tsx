"use client";

// components/ui/dropdown-menu.tsx — 04 §18: `Popover` (menú `⋮`) con rol `menu`/`menuitem`,
// teclado ↑/↓, Esc, Home/End. Radix `DropdownMenu` da exactamente ese patrón de fábrica — el
// **requisito AA de 04 §14.4** (alternativa sin arrastre) vive detrás de este menú.
import * as MenuPrimitive from "@radix-ui/react-dropdown-menu";
import { MoreVertical } from "lucide-react";
import { twMerge } from "tailwind-merge";

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;

export function DropdownMenuButton({
  label,
  className,
  ...resto
}: { label: string; className?: string } & MenuPrimitive.DropdownMenuTriggerProps) {
  return (
    <MenuPrimitive.Trigger asChild {...resto}>
      <button
        type="button"
        aria-label={label}
        className={twMerge("flex size-8 shrink-0 items-center justify-center rounded-ui-control text-ui-ink-muted hover:bg-ui-bg-alt hover:text-ui-ink", className)}
      >
        <MoreVertical aria-hidden="true" className="size-4" />
      </button>
    </MenuPrimitive.Trigger>
  );
}

export function DropdownMenuContent({ className, ...resto }: MenuPrimitive.DropdownMenuContentProps) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        sideOffset={4}
        align="end"
        className={twMerge(
          "z-50 min-w-44 rounded-ui-control border border-ui-border bg-ui-surface p-1 shadow-ui-2",
          className,
        )}
        {...resto}
      />
    </MenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({ className, ...resto }: MenuPrimitive.DropdownMenuItemProps) {
  return (
    <MenuPrimitive.Item
      className={twMerge(
        "flex min-h-9 cursor-pointer items-center rounded-[6px] px-2.5 text-ui-aux text-ui-ink outline-none data-[highlighted]:bg-ui-accent-soft data-[highlighted]:text-ui-accent-soft-ink",
        className,
      )}
      {...resto}
    />
  );
}
