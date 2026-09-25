import type { Metadata } from "next";
import { CalendarCheck, Clock, Wrench, type LucideIcon } from "lucide-react";
import { getAppointmentDaySummary, getAppointments } from "@/app/actions/appointments";
import { PageHeader } from "@/components/dashboard/page-header";
import { formatPlate } from "@/lib/format";
import { BUSINESS_HOURS_LABEL } from "@/lib/appointments/schedule";
import {
  addDays,
  formatDayMonth,
  formatMonthKey,
  startOfMonth,
  startOfWeek,
  todayKey,
  toTimeKey,
} from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { appointmentPageFiltersSchema, type AppointmentView } from "@/lib/validations/schemas";
import { AppointmentsView } from "./_components/appointments-view";

export const metadata: Metadata = { title: "Citas" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Rango de días visible según la vista. */
function rangeFor(view: AppointmentView, anchor: string) {
  if (view === "month") {
    const from = startOfWeek(startOfMonth(anchor));
    return { from, to: addDays(from, 41), label: formatMonthKey(anchor) };
  }
  if (view === "list") {
    const to = addDays(anchor, 13);
    return { from: anchor, to, label: `${formatDayMonth(anchor)} – ${formatDayMonth(to)}` };
  }
  const from = startOfWeek(anchor);
  const to = addDays(from, 6);
  return { from, to, label: `Semana del ${formatDayMonth(from)} al ${formatDayMonth(to)}` };
}

function KpiTile({
  label,
  value,
  detail,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: number | string;
  detail: string;
  icon: LucideIcon;
  iconClass?: string;
}) {
  return (
    <div className="grid gap-1 rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
      <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        {label}
        <Icon className={cn("size-4", iconClass ?? "text-muted-foreground")} aria-hidden />
      </span>
      <span className="text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
      <span className="truncate text-xs text-muted-foreground">{detail}</span>
    </div>
  );
}

export default async function AppointmentsPage({ searchParams }: PageProps<"/dashboard/appointments">) {
  const params = await searchParams;
  const filters = appointmentPageFiltersSchema.parse({
    view: first(params.view),
    date: first(params.date),
    status: first(params.status),
    service: first(params.service),
  });
  const anchor = filters.date ?? todayKey();
  const range = rangeFor(filters.view, anchor);

  const [appointments, summary] = await Promise.all([
    getAppointments({ from: range.from, to: range.to, status: filters.status, service: filters.service }),
    getAppointmentDaySummary(),
  ]);

  const next = summary.next;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <PageHeader title="Citas" description={`Agenda de mantenimientos, revisiones y diagnósticos · ${BUSINESS_HOURS_LABEL}`} />

      <section aria-label="Indicadores de hoy" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Pendientes de confirmar hoy"
          value={summary.scheduled}
          detail={summary.scheduled > 0 ? "Llamar o escribir para confirmar" : "Todo confirmado"}
          icon={Clock}
          iconClass="text-status-serious"
        />
        <KpiTile
          label="Confirmadas hoy"
          value={summary.confirmed}
          detail={`${summary.total} citas en total`}
          icon={CalendarCheck}
          iconClass="text-chart-1"
        />
        <KpiTile
          label="Mantenimientos del día"
          value={summary.maintenance}
          detail="Service por kilometraje"
          icon={Wrench}
        />
        <KpiTile
          label="Próxima cita"
          value={next ? toTimeKey(new Date(next.starts_at)) : "—"}
          detail={next ? `${formatPlate(next.motorcycle.plate)} · ${next.contact.name ?? next.customer.name}` : "Sin más citas hoy"}
          icon={CalendarCheck}
        />
      </section>

      <AppointmentsView
        appointments={appointments}
        filters={filters}
        anchor={anchor}
        range={range}
        openNew={first(params.new) === "1"}
        initialPlate={first(params.plate)}
      />
    </div>
  );
}
