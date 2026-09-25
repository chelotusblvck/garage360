"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Selector de cantidad compacto (−, input, +). Valores inválidos se ignoran. */
export function QuantityStepper({
  value,
  max,
  label,
  onChange,
  size = "default",
}: {
  value: number;
  max: number;
  label: string;
  onChange: (value: number) => void;
  size?: "default" | "sm";
}) {
  return (
    <div className="inline-flex items-center rounded-lg border bg-background" role="group" aria-label={`Cantidad de ${label}`}>
      <Button
        variant="ghost"
        size={size === "sm" ? "icon-xs" : "icon-sm"}
        aria-label="Restar una unidad"
        onClick={() => onChange(value - 1)}
      >
        <Minus />
      </Button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.valueAsNumber)}
        aria-label={`Unidades de ${label}`}
        className={cn(
          "w-10 [appearance:textfield] bg-transparent text-center text-sm tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none",
          size === "sm" && "w-8 text-xs"
        )}
      />
      <Button
        variant="ghost"
        size={size === "sm" ? "icon-xs" : "icon-sm"}
        aria-label="Sumar una unidad"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus />
      </Button>
    </div>
  );
}
