"use client";

import { APPOINTMENT_STATUS_STYLE } from "@/components/appointments/badges";
import { formatPlate } from "@/lib/format";
import type { Appointment } from "@/lib/appointments/types";
import { addDays, dayOfMonth, formatFullDate, formatWeekdayShort, toDateKey, toTimeKey, todayKey } from "@/lib/datetime";
import { APPOINTMENT_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

const MAX_PER_DAY = 3;

export function MonthCalendar({
  gridStart,
  month,
  appointments,
  onSelect,
  onOpenDay,
}: {
  /** Lunes de la primera semana visible. */
  gridStart: string;
  /** "YYYY-MM" del mes mostrado. */
  month: string;
  appointments: Appointment[];
  onSelect: (appointment: Appointment) => void;
  onOpenDay: (day: string) => void;
}) {
  const today = todayKey();
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const byDay = new Map<string, Appointment[]>();
  for (const a of appointments) {
    const key = toDateKey(new Date(a.starts_at));
    byDay.set(key, [...(byDay.get(key) ?? []), a]);
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div className="min-w-[46rem] overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {days.slice(0, 7).map((day) => (
            <div key={day} className="py-2 text-center text-xs font-medium text-muted-foreground">
              {formatWeekdayShort(day)}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            const items = byDay.get(day) ?? [];
            const inMonth = day.startsWith(month);
            return (
              <div
                key={day}
                className={cn(
                  "min-h-28 border-foreground/10 p-1.5",
                  index % 7 !== 0 && "border-l",
                  index >= 7 && "border-t",
                  !inMonth && "bg-muted/30"
                )}
              >
                <button
                  type="button"
                  onClick={() => onOpenDay(day)}
                  className={cn(
                    "mb-1 flex size-7 items-center justify-center rounded-full text-sm tabular-nums hover:bg-muted",
                    !inMonth && "text-muted-foreground/60",
                    day === today && "bg-foreground font-semibold text-background hover:bg-foreground/85"
                  )}
                  aria-label={`Ver ${formatFullDate(day)}`}
                >
                  {dayOfMonth(day)}
                </button>
                <ul className="grid gap-0.5">
                  {items.slice(0, MAX_PER_DAY).map((a) => {
                    const style = APPOINTMENT_STATUS_STYLE[a.status];
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => onSelect(a)}
                          className={cn(
                            "flex w-full items-center gap-1 truncate rounded border-l-2 px-1 py-0.5 text-left text-[11px] hover:bg-muted",
                            style.eventClass,
                            "border-y-0 border-r-0"
                          )}
                          aria-label={`${toTimeKey(new Date(a.starts_at))} ${formatPlate(a.motorcycle.plate)}, ${APPOINTMENT_STATUS_LABEL[a.status]}`}
                        >
                          <span className="font-mono tabular-nums">{toTimeKey(new Date(a.starts_at))}</span>
                          <span className="truncate font-mono">{formatPlate(a.motorcycle.plate)}</span>
                        </button>
                      </li>
                    );
                  })}
                  {items.length > MAX_PER_DAY ? (
                    <li>
                      <button
                        type="button"
                        onClick={() => onOpenDay(day)}
                        className="w-full rounded px-1 text-left text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        +{items.length - MAX_PER_DAY} más
                      </button>
                    </li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
