"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarX, Clock } from "lucide-react";
import { getAvailableSlots } from "@/app/actions/appointments";
import { Skeleton } from "@/components/ui/skeleton";
import { SERVICE_DURATION, upcomingOpenDays, type Slot } from "@/lib/appointments/schedule";
import { dayOfMonth, formatDayMonth, formatFullDate, formatWeekdayShort, todayKey } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type { ServiceType } from "@/lib/validations/schemas";

type SlotPickerProps = {
  service: ServiceType;
  date: string | null;
  time: string | null;
  onChange: (date: string | null, time: string | null) => void;
  /** Reagendar: la propia cita no cuenta como ocupación. */
  excludeAppointmentId?: string;
  days?: number;
  dateError?: string;
  timeError?: string;
};

/** Selector de día + horario con disponibilidad real (jornada, capacidad y anticipación). */
export function SlotPicker({
  service,
  date,
  time,
  onChange,
  excludeAppointmentId,
  days = 14,
  dateError,
  timeError,
}: SlotPickerProps) {
  const openDays = useMemo(() => upcomingOpenDays(todayKey(), days), [days]);
  const [slots, setSlots] = useState<{ key: string; data: Slot[] } | null>(null);
  const requestKey = date ? `${date}|${service}` : null;
  const loading = requestKey !== null && slots?.key !== requestKey;

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    getAvailableSlots(date, service, excludeAppointmentId).then((data) => {
      if (cancelled) return;
      setSlots({ key: `${date}|${service}`, data });
      // Si el horario elegido dejó de estar disponible (p. ej. cambió el servicio), se limpia.
      if (time && !data.some((s) => s.time === time && s.available)) onChange(date, null);
    });
    return () => {
      cancelled = true;
    };
    // `time`/`onChange` no disparan una nueva consulta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, service, excludeAppointmentId]);

  const visibleSlots = slots?.key === requestKey ? slots.data.filter((s) => s.reason !== "past") : [];
  const hasAvailable = visibleSlots.some((s) => s.available);

  return (
    <div className="grid gap-4">
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Día</legend>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7" role="radiogroup" aria-label="Elegir día">
          {openDays.map((key) => {
            const selected = key === date;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={formatFullDate(key)}
                onClick={() => onChange(key, null)}
                className={cn(
                  "flex flex-col items-center rounded-lg border px-1 py-2 text-center transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  selected ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted"
                )}
              >
                <span className={cn("text-[11px] uppercase", selected ? "opacity-80" : "text-muted-foreground")}>
                  {formatWeekdayShort(key)}
                </span>
                <span className="text-lg leading-tight font-semibold tabular-nums">{dayOfMonth(key)}</span>
                <span className={cn("text-[11px]", selected ? "opacity-80" : "text-muted-foreground")}>
                  {formatDayMonth(key).split(" ")[1]}
                </span>
              </button>
            );
          })}
        </div>
        {dateError ? (
          <p role="alert" className="text-xs text-destructive">
            {dateError}
          </p>
        ) : null}
      </fieldset>

      <fieldset className="grid gap-2" aria-busy={loading}>
        <legend className="mb-2 flex w-full items-center justify-between text-sm font-medium">
          <span>Horario</span>
          <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
            <Clock className="size-3.5" aria-hidden /> Duración estimada {SERVICE_DURATION[service]} min
          </span>
        </legend>

        {!date ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Elige un día para ver los horarios disponibles.
          </p>
        ) : loading ? (
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : !hasAvailable ? (
          <p className="flex items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <CalendarX className="size-4" aria-hidden /> No quedan horarios disponibles este día. Prueba con otro.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5" role="radiogroup" aria-label="Elegir horario">
            {visibleSlots.map((slot) => {
              const selected = slot.time === time;
              return (
                <button
                  key={slot.time}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!slot.available}
                  onClick={() => onChange(date, slot.time)}
                  title={slot.available ? undefined : "Horario completo"}
                  className={cn(
                    "h-9 rounded-md border text-sm font-medium tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    selected && "border-foreground bg-foreground text-background",
                    !selected && slot.available && "bg-card hover:bg-muted",
                    !slot.available && "cursor-not-allowed border-dashed bg-muted/40 text-muted-foreground/60 line-through"
                  )}
                >
                  {slot.time}
                  <span className="sr-only">{slot.available ? "" : " (completo)"}</span>
                </button>
              );
            })}
          </div>
        )}
        {timeError ? (
          <p role="alert" className="text-xs text-destructive">
            {timeError}
          </p>
        ) : null}
      </fieldset>
    </div>
  );
}
