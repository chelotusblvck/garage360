"use client";

import { Plus, Printer, Tablet, WalletCards } from "lucide-react";
import { QuantityStepper } from "@/components/quantity-stepper";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { HARDWARE, HARDWARE_KEYS, MAX_HARDWARE_UNITS, type HardwareKey, type HardwareSelection } from "@/lib/workshops/plans";

export const HARDWARE_ICON: Record<HardwareKey, typeof Tablet> = {
  tablet_rugged_10: Tablet,
  printer_thermal_80: Printer,
  pos_smart_c2c: WalletCards,
};

/** Selector de equipamiento del catálogo (cotización pública y alta manual en /admin). */
export function HardwarePicker({
  value,
  onChange,
}: {
  value: HardwareSelection;
  onChange: (sku: HardwareKey, qty: number) => void;
}) {
  function set(sku: HardwareKey, qty: number) {
    if (!Number.isFinite(qty)) return;
    onChange(sku, Math.min(MAX_HARDWARE_UNITS, Math.max(0, Math.trunc(qty))));
  }

  return (
    <ul className="grid gap-2">
      {HARDWARE_KEYS.map((key) => {
        const item = HARDWARE[key];
        const Icon = HARDWARE_ICON[key];
        const qty = value[key] ?? 0;
        return (
          <li key={key} className={cn("flex items-center gap-3 rounded-xl border p-3", qty > 0 && "border-foreground bg-muted/40")}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="grid min-w-0 flex-1 leading-tight">
              <span className="truncate text-sm font-medium">{item.label}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{formatCurrency(item.price)} c/u</span>
            </span>
            {qty > 0 ? (
              <QuantityStepper value={qty} max={MAX_HARDWARE_UNITS} label={item.label} size="sm" onChange={(v) => set(key, v)} />
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => set(key, 1)}>
                <Plus data-icon="inline-start" />
                Agregar
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
