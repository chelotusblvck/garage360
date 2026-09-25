import { CircleCheck, OctagonAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import { STOCK_STATUS_LABEL } from "@/lib/inventory/constants";
import type { StockStatus } from "@/lib/inventory/types";
import { cn } from "@/lib/utils";

/**
 * Los colores de estado nunca van solos: siempre icono + etiqueta, y el texto
 * se mantiene en color de tinta para conservar contraste.
 */
export const STOCK_STATUS_STYLE: Record<
  StockStatus,
  { icon: LucideIcon; iconClass: string; badgeClass: string; barClass: string }
> = {
  ok: {
    icon: CircleCheck,
    iconClass: "text-status-good",
    badgeClass: "bg-status-good/10 ring-status-good/25",
    barClass: "bg-status-good",
  },
  low: {
    icon: TriangleAlert,
    iconClass: "text-status-serious",
    badgeClass: "bg-status-warning/15 ring-status-warning/40",
    barClass: "bg-status-serious",
  },
  out: {
    icon: OctagonAlert,
    iconClass: "text-status-critical",
    badgeClass: "bg-status-critical/10 ring-status-critical/25",
    barClass: "bg-status-critical",
  },
};

export function StockStatusBadge({ status, className }: { status: StockStatus; className?: string }) {
  const style = STOCK_STATUS_STYLE[status];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap text-foreground ring-1 ring-inset",
        style.badgeClass,
        className
      )}
    >
      <style.icon className={cn("size-3.5 shrink-0", style.iconClass)} aria-hidden />
      {STOCK_STATUS_LABEL[status]}
    </span>
  );
}
