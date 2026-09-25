"use client";

import { useSyncExternalStore } from "react";
import { APPOINTMENT_STATUS_STYLE, SERVICE_ICON } from "@/components/appointments/badges";
import { formatPlate } from "@/lib/format";
import { BUSINESS_HOURS } from "@/lib/appointments/schedule";
import type { Appointment } from "@/lib/appointments/types";
import {
  addDays,
  dayOfMonth,
  formatFullDate,
  formatWeekdayShort,
  minutesOfDay,
  toDateKey,
  toTimeKey,
  todayKey,
  weekdayOf,
} from "@/lib/datetime";
import { APPOINTMENT_STATUS_LABEL, SERVICE_TYPE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

const START_HOUR = 8;
const END_HOUR = 19;
const HOUR_PX = 56;
const toPx = (minutes: number) => ((minutes - START_HOUR * 60) / 60) * HOUR_PX;
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

type Positioned = { appointment: Appointment; lane: number; lanes: number };

/** Asigna carriles a citas solapadas para mostrarlas lado a lado. */
function layoutDay(items: Appointment[]): Positioned[] {
  const sorted = [...items].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const result: Positioned[] = [];
  let group: Positioned[] = [];
  let groupEnd = 0;

  const flush = () => {
    const lanes = Math.max(1, ...group.map((p) => p.lane + 1));
    group.forEach((p) => (p.lanes = lanes));
    result.push(...group);
    group = [];
  };

  for (const appointment of sorted) {
    const start = new Date(appointment.starts_at).getTime();
    const end = new Date(appointment.ends_at).getTime();
    if (group.length && start >= groupEnd) flush();
    const laneEnds = new Map<number, number>();
    for (const p of group) {
      const pEnd = new Date(p.appointment.ends_at).getTime();
      laneEnds.set(p.lane, Math.max(laneEnds.get(p.lane) ?? 0, pEnd));
    }
    let lane = 0;
    while ((laneEnds.get(lane) ?? 0) > start) lane++;
    group.push({ appointment, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, end);
  }
  if (group.length) flush();
  return result;
}

const subscribeMinute = (cb: () => void) => {
  const id = setInterval(cb, 60_000);
  return () => clearInterval(id);
};

export function WeekCalendar({
  weekStart,
  appointments,
  onSelect,
}: {
  weekStart: string;
  appointments: Appointment[];
  onSelect: (appointment: Appointment) => void;
}) {
  const today = todayKey();
  // Minuto actual (se actualiza cada minuto; null en el servidor).
  const nowMinutes = useSyncExternalStore(subscribeMinute, () => Math.floor(Date.now() / 60_000), () => null);

  const byDay = new Map<string, Appointment[]>();
  for (const a of appointments) {
    const key = toDateKey(new Date(a.starts_at));
    byDay.set(key, [...(byDay.get(key) ?? []), a]);
  }
  const sunday = addDays(weekStart, 6);
  const days = Array.from({ length: byDay.has(sunday) ? 7 : 6 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const height = (END_HOUR - START_HOUR) * HOUR_PX;

  return (
    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div className="min-w-[46rem] overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        {/* Encabezado de días */}
        <div className="grid border-b" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
          <div />
          {days.map((day) => {
            const count = (byDay.get(day) ?? []).filter((a) => a.status !== "cancelled").length;
            return (
              <div key={day} className="flex items-center justify-center gap-2 border-l py-2.5 text-sm">
                <span className="text-muted-foreground">{formatWeekdayShort(day)}</span>
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full font-semibold tabular-nums",
                    day === today && "bg-foreground text-background"
                  )}
                  aria-label={day === today ? `${formatFullDate(day)} (hoy)` : formatFullDate(day)}
                >
                  {dayOfMonth(day)}
                </span>
                {count > 0 ? <span className="text-xs text-muted-foreground tabular-nums">{count}</span> : null}
              </div>
            );
          })}
        </div>

        {/* Grilla horaria */}
        <div className="relative grid" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))`, height }}>
          <div className="relative">
            {hours.map((h) => (
              <span
                key={h}
                className="absolute right-2 -translate-y-1/2 font-mono text-[11px] text-muted-foreground tabular-nums"
                style={{ top: (h - START_HOUR) * HOUR_PX }}
              >
                {h > START_HOUR ? `${String(h).padStart(2, "0")}:00` : ""}
              </span>
            ))}
          </div>

          {days.map((day) => {
            const hoursOfDay = BUSINESS_HOURS[weekdayOf(day)];
            const openPx = hoursOfDay ? toPx(toMin(hoursOfDay.open)) : height;
            const closePx = hoursOfDay ? toPx(toMin(hoursOfDay.close)) : height;
            const isToday = day === today;
            const nowPx = isToday && nowMinutes !== null ? toPx(minutesOfDay(new Date(nowMinutes * 60_000))) : null;

            return (
              <div key={day} className={cn("relative border-l", isToday && "bg-chart-1/[0.03]")}>
                {/* Líneas de hora y media hora */}
                {hours.map((h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-foreground/[0.06]" style={{ top: (h - START_HOUR) * HOUR_PX }}>
                    <div className="border-t border-dashed border-foreground/[0.04]" style={{ marginTop: HOUR_PX / 2 }} />
                  </div>
                ))}
                {/* Fuera de jornada */}
                <div className="closed-hatch absolute inset-x-0 top-0" style={{ height: Math.max(0, openPx) }} aria-hidden />
                <div className="closed-hatch absolute inset-x-0 bottom-0" style={{ top: closePx }} aria-hidden />

                {layoutDay(byDay.get(day) ?? []).map(({ appointment: a, lane, lanes }) => {
                  const start = new Date(a.starts_at);
                  const style = APPOINTMENT_STATUS_STYLE[a.status];
                  const Icon = SERVICE_ICON[a.service_type];
                  const top = toPx(minutesOfDay(start));
                  const h = (a.duration_minutes / 60) * HOUR_PX - 3;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onSelect(a)}
                      className={cn(
                        "absolute overflow-hidden rounded-md border-l-[3px] border px-1.5 py-1 text-left text-xs shadow-xs transition-shadow outline-none hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50",
                        style.eventClass
                      )}
                      style={{
                        top: top + 1,
                        height: h,
                        left: `calc(${(lane / lanes) * 100}% + 2px)`,
                        width: `calc(${100 / lanes}% - 4px)`,
                      }}
                      aria-label={`${toTimeKey(start)} ${SERVICE_TYPE_LABEL[a.service_type]}, ${formatPlate(a.motorcycle.plate)}, ${a.customer.name}, ${APPOINTMENT_STATUS_LABEL[a.status]}`}
                    >
                      <span className="flex items-center gap-1 font-medium">
                        <span className="font-mono tabular-nums">{toTimeKey(start)}</span>
                        <Icon className="size-3 shrink-0 opacity-70" aria-hidden />
                        <span className="truncate font-mono">{formatPlate(a.motorcycle.plate)}</span>
                      </span>
                      <span className="block truncate opacity-80">{a.contact.name ?? a.customer.name}</span>
                      {h > 64 ? (
                        <span className="block truncate opacity-70">
                          {a.motorcycle.brand} {a.motorcycle.model}
                        </span>
                      ) : null}
                    </button>
                  );
                })}

                {nowPx !== null && nowPx >= 0 && nowPx <= height ? (
                  <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: nowPx }} aria-hidden>
                    <span className="-ml-1 size-2 rounded-full bg-chart-2" />
                    <span className="h-0.5 flex-1 bg-chart-2" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
