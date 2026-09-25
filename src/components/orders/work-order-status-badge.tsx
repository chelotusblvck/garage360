import { Ban, CheckCheck, CircleCheck, Clock, Inbox, Wrench, type LucideIcon } from "lucide-react";
import { WORK_ORDER_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { WorkOrderStatus } from "@/lib/validations/schemas";

/**
 * Estados de flujo (no de salud): cada uno con icono + etiqueta propios.
 * Solo "Esperando repuestos" (bloqueo) y "Lista para entrega" (listo) usan
 * colores de estado; el resto usa tonos neutros / de identidad.
 */
export const WORK_ORDER_STATUS_STYLE: Record<
  WorkOrderStatus,
  { icon: LucideIcon; iconClass: string; badgeClass: string; accentClass: string }
> = {
  open: {
    icon: Inbox,
    iconClass: "text-chart-1",
    badgeClass: "bg-chart-1/10 ring-chart-1/25",
    accentClass: "bg-chart-1",
  },
  in_progress: {
    icon: Wrench,
    iconClass: "text-foreground",
    badgeClass: "bg-foreground/[0.06] ring-foreground/15",
    accentClass: "bg-foreground/70",
  },
  waiting_parts: {
    icon: Clock,
    iconClass: "text-status-serious",
    badgeClass: "bg-status-warning/15 ring-status-warning/40",
    accentClass: "bg-status-warning",
  },
  completed: {
    icon: CircleCheck,
    iconClass: "text-status-good",
    badgeClass: "bg-status-good/10 ring-status-good/25",
    accentClass: "bg-status-good",
  },
  delivered: {
    icon: CheckCheck,
    iconClass: "text-muted-foreground",
    badgeClass: "bg-muted ring-foreground/10",
    accentClass: "bg-muted-foreground/40",
  },
  cancelled: {
    icon: Ban,
    iconClass: "text-muted-foreground",
    badgeClass: "bg-muted ring-foreground/10 text-muted-foreground",
    accentClass: "bg-muted-foreground/30",
  },
};

export function WorkOrderStatusBadge({ status, className }: { status: WorkOrderStatus; className?: string }) {
  const style = WORK_ORDER_STATUS_STYLE[status];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap text-foreground ring-1 ring-inset",
        style.badgeClass,
        className
      )}
    >
      <style.icon className={cn("size-3.5 shrink-0", style.iconClass)} aria-hidden />
      {WORK_ORDER_STATUS_LABEL[status]}
    </span>
  );
}
