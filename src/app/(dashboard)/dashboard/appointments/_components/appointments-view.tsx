"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, CalendarPlus, CalendarRange, Camera, ChevronLeft, ChevronRight, List } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { Appointment } from "@/lib/appointments/types";
import { addDays, addMonths, todayKey } from "@/lib/datetime";
import { APPOINTMENT_STATUS_LABEL, SERVICE_TYPE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import {
  appointmentStatusSchema,
  serviceTypeSchema,
  type AppointmentPageFilters,
  type AppointmentView,
} from "@/lib/validations/schemas";
import { AppointmentSheet } from "./appointment-sheet";
import { DayList } from "./day-list";
import { MonthCalendar } from "./month-calendar";
import { NewAppointmentSheet } from "./new-appointment-sheet";
import { WeekCalendar } from "./week-calendar";

type Props = {
  appointments: Appointment[];
  filters: AppointmentPageFilters;
  anchor: string;
  range: { from: string; to: string; label: string };
  openNew: boolean;
  /** Patente a precargar en la nueva cita (desde la ficha del cliente). */
  initialPlate?: string;
};

const VIEWS: { value: AppointmentView; label: string; icon: typeof CalendarDays }[] = [
  { value: "week", label: "Semana", icon: CalendarRange },
  { value: "month", label: "Mes", icon: CalendarDays },
  { value: "list", label: "Lista", icon: List },
];

export function AppointmentsView({ appointments, filters, anchor, range, openNew, initialPlate }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(openNew);
  // La hoja siempre muestra la versión actual de la cita (tras confirmar, etc.).
  const selected = appointments.find((a) => a.id === selectedId) ?? null;

  function navigate(next: Partial<AppointmentPageFilters>) {
    const merged = { ...filters, date: anchor, ...next };
    const params = new URLSearchParams();
    if (merged.view !== "week") params.set("view", merged.view);
    if (merged.date && merged.date !== todayKey()) params.set("date", merged.date);
    if (merged.status !== "all") params.set("status", merged.status);
    if (merged.service !== "all") params.set("service", merged.service);
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function shift(direction: -1 | 1) {
    const date =
      filters.view === "month"
        ? addMonths(anchor, direction)
        : addDays(anchor, direction * (filters.view === "week" ? 7 : 14));
    navigate({ date });
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-muted p-0.5" role="radiogroup" aria-label="Tipo de vista">
            {VIEWS.map((v) => (
              <button
                key={v.value}
                type="button"
                role="radio"
                aria-checked={filters.view === v.value}
                onClick={() => navigate({ view: v.value })}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  filters.view === v.value && "bg-background text-foreground shadow-xs ring-1 ring-foreground/10"
                )}
              >
                <v.icon className="size-4" aria-hidden />
                {v.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Período anterior">
              <ChevronLeft />
            </Button>
            <Button variant="outline" onClick={() => navigate({ date: todayKey() })}>
              Hoy
            </Button>
            <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="Período siguiente">
              <ChevronRight />
            </Button>
          </div>
          <h2 className="text-base font-semibold" aria-live="polite">
            {range.label}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
          <NativeSelect
            aria-label="Filtrar por estado"
            value={filters.status}
            onChange={(e) => navigate({ status: e.target.value as AppointmentPageFilters["status"] })}
            className="min-w-40 [&_select]:h-9"
          >
            <NativeSelectOption value="all">Todos los estados</NativeSelectOption>
            {appointmentStatusSchema.options.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {APPOINTMENT_STATUS_LABEL[s]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Filtrar por servicio"
            value={filters.service}
            onChange={(e) => navigate({ service: e.target.value as AppointmentPageFilters["service"] })}
            className="min-w-40 [&_select]:h-9"
          >
            <NativeSelectOption value="all">Todos los servicios</NativeSelectOption>
            {serviceTypeSchema.options.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {SERVICE_TYPE_LABEL[s]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button variant="outline" className="h-9" onClick={() => setNewOpen(true)}>
            <CalendarPlus data-icon="inline-start" />
            Nueva cita
          </Button>
          <Link href="/dashboard/orders/new" className={buttonVariants({ className: "h-9" })}>
            <Camera data-icon="inline-start" />
            Recepcionar moto
          </Link>
        </div>
      </div>

      <div className={cn("transition-opacity", isPending && "opacity-60")} aria-busy={isPending}>
        {filters.view === "week" ? (
          <WeekCalendar weekStart={range.from} appointments={appointments} onSelect={(a) => setSelectedId(a.id)} />
        ) : filters.view === "month" ? (
          <MonthCalendar
            gridStart={range.from}
            month={anchor.slice(0, 7)}
            appointments={appointments}
            onSelect={(a) => setSelectedId(a.id)}
            onOpenDay={(day) => navigate({ view: "list", date: day })}
          />
        ) : (
          <DayList appointments={appointments} />
        )}
      </div>

      <AppointmentSheet appointment={selected} onClose={() => setSelectedId(null)} />
      <NewAppointmentSheet
        open={newOpen}
        onOpenChange={(open) => {
          setNewOpen(open);
          if (!open && openNew) navigate({});
        }}
        onCreated={(date) => navigate({ date })}
        initialPlate={openNew ? initialPlate : undefined}
      />
    </div>
  );
}
