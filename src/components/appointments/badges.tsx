import {
  Ban,
  CalendarCheck,
  CheckCheck,
  Clock,
  ScanSearch,
  Stethoscope,
  UserX,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { APPOINTMENT_STATUS_LABEL, SERVICE_TYPE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { AppointmentStatus, ServiceType } from "@/lib/validations/schemas";

/** Estados de la cita: icono + etiqueta; color de estado solo donde significa algo. */
export const APPOINTMENT_STATUS_STYLE: Record<
  AppointmentStatus,
  { icon: LucideIcon; iconClass: string; badgeClass: string; eventClass: string }
> = {
  scheduled: {
    icon: Clock,
    iconClass: "text-status-serious",
    badgeClass: "bg-status-warning/15 ring-status-warning/40",
    eventClass: "border-dashed border-status-warning bg-card",
  },
  confirmed: {
    icon: CalendarCheck,
    iconClass: "text-chart-1",
    badgeClass: "bg-chart-1/10 ring-chart-1/25",
    eventClass: "border-chart-1 bg-chart-1/10",
  },
  completed: {
    icon: CheckCheck,
    iconClass: "text-status-good",
    badgeClass: "bg-status-good/10 ring-status-good/25",
    eventClass: "border-status-good/60 bg-muted/70 text-muted-foreground",
  },
  cancelled: {
    icon: Ban,
    iconClass: "text-muted-foreground",
    badgeClass: "bg-muted ring-foreground/10 text-muted-foreground",
    eventClass: "border-foreground/15 bg-muted/60 text-muted-foreground line-through",
  },
  no_show: {
    icon: UserX,
    iconClass: "text-status-critical",
    badgeClass: "bg-status-critical/10 ring-status-critical/25",
    eventClass: "border-status-critical/50 bg-muted/60 text-muted-foreground",
  },
};

export const SERVICE_ICON: Record<ServiceType, LucideIcon> = {
  maintenance: Wrench,
  inspection: ScanSearch,
  repair: Stethoscope,
};

const pill = "inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap ring-1 ring-inset";

export function AppointmentStatusBadge({ status, className }: { status: AppointmentStatus; className?: string }) {
  const style = APPOINTMENT_STATUS_STYLE[status];
  return (
    <span className={cn(pill, "text-foreground", style.badgeClass, className)}>
      <style.icon className={cn("size-3.5 shrink-0", style.iconClass)} aria-hidden />
      {APPOINTMENT_STATUS_LABEL[status]}
    </span>
  );
}

export function ServiceTypeBadge({ service, className }: { service: ServiceType; className?: string }) {
  const Icon = SERVICE_ICON[service];
  return (
    <span className={cn(pill, "bg-secondary text-secondary-foreground ring-foreground/5", className)}>
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      {SERVICE_TYPE_LABEL[service]}
    </span>
  );
}
