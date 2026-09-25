"use client";

import { CalendarX } from "lucide-react";
import type { Appointment } from "@/lib/appointments/types";
import { formatDayLong, toDateKey, todayKey } from "@/lib/datetime";
import { AppointmentCard } from "./appointment-card";

/** Lista agrupada por día. */
export function DayList({ appointments }: { appointments: Appointment[] }) {
  if (appointments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl bg-card px-4 py-16 text-center ring-1 ring-foreground/10">
        <span className="flex size-11 items-center justify-center rounded-xl bg-muted">
          <CalendarX className="size-5 text-muted-foreground" aria-hidden />
        </span>
        <p className="font-medium">No hay citas en este período</p>
        <p className="text-sm text-muted-foreground">Cambia las fechas o los filtros, o agenda una nueva cita.</p>
      </div>
    );
  }

  const today = todayKey();
  const groups = new Map<string, Appointment[]>();
  for (const a of appointments) {
    const key = toDateKey(new Date(a.starts_at));
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }

  return (
    <div className="grid gap-6">
      {[...groups.entries()].map(([day, items]) => (
        <section key={day} aria-labelledby={`day-${day}`} className="grid gap-2.5">
          <h2 id={`day-${day}`} className="flex items-baseline gap-2 text-sm font-semibold">
            {formatDayLong(day)}
            {day === today ? (
              <span className="rounded-full bg-foreground px-2 py-0.5 text-[11px] font-medium text-background">Hoy</span>
            ) : null}
            <span className="font-normal text-muted-foreground">
              · {items.length} {items.length === 1 ? "cita" : "citas"}
            </span>
          </h2>
          <div className="grid gap-2">
            {items.map((a) => (
              <AppointmentCard key={a.id} appointment={a} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
