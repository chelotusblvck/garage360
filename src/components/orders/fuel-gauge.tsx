import { Fuel } from "lucide-react";
import { FUEL_LEVEL_BARS, FUEL_LEVEL_LABEL } from "@/lib/checkin/shared";
import { cn } from "@/lib/utils";
import type { FuelLevel } from "@/lib/validations/schemas";

/** Indicador de combustible de 4 barras (reserva = ninguna encendida). */
export function FuelGauge({ level, className }: { level: FuelLevel; className?: string }) {
  const bars = FUEL_LEVEL_BARS[level];
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <Fuel className={cn("size-4", bars === 0 ? "text-status-serious" : "text-muted-foreground")} aria-hidden />
      <span className="inline-flex items-end gap-0.5" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn("w-1.5 rounded-sm", i < bars ? "bg-foreground" : "bg-foreground/15")}
            style={{ height: `${8 + i * 3}px` }}
          />
        ))}
      </span>
      <span className="text-sm">{FUEL_LEVEL_LABEL[level]}</span>
    </span>
  );
}
