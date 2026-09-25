import { addDays, minutesOfDay, toDateKey, weekdayOf, zonedToUtc } from "@/lib/datetime";
import type { ServiceType } from "@/lib/validations/schemas";

/*
 * Reglas de agenda del taller. Espejo de assert_appointment_slot() en
 * supabase/schema.sql: si cambias una, cambia la otra.
 */

export const SLOT_MINUTES = 30;
/** Motos que se pueden atender en simultáneo (boxes / mecánicos). */
export const BAY_CAPACITY = 2;
/** Anticipación mínima para reservas públicas. */
export const PUBLIC_MIN_LEAD_MINUTES = 60;
export const BOOKING_WINDOW_DAYS = 60;

/** Jornada por día de la semana (0 = domingo). `null` = cerrado. */
export const BUSINESS_HOURS: Record<number, { open: string; close: string } | null> = {
  0: null,
  1: { open: "09:00", close: "18:00" },
  2: { open: "09:00", close: "18:00" },
  3: { open: "09:00", close: "18:00" },
  4: { open: "09:00", close: "18:00" },
  5: { open: "09:00", close: "18:00" },
  6: { open: "09:00", close: "13:00" },
};

export const BUSINESS_HOURS_LABEL = "Lun a vie 9 a 18 h · Sáb 9 a 13 h";

export const SERVICE_DURATION: Record<ServiceType, number> = {
  maintenance: 90,
  inspection: 60,
  repair: 60,
};

export type BusyInterval = { starts_at: string; minutes: number };

export type Slot = {
  time: string;
  starts_at: string;
  available: boolean;
  reason?: "past" | "full";
};

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const toHHMM = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export const isOpenDay = (dateKey: string) => BUSINESS_HOURS[weekdayOf(dateKey)] !== null;

/** Próximos `count` días hábiles a partir de `from` (inclusive). */
export function upcomingOpenDays(from: string, count: number): string[] {
  const days: string[] = [];
  for (let key = from; days.length < count; key = addDays(key, 1)) {
    if (isOpenDay(key)) days.push(key);
  }
  return days;
}

/** Cantidad de turnos activos que cubren el instante `t`. */
function occupancyAt(busy: BusyInterval[], t: number) {
  return busy.filter((b) => {
    const start = new Date(b.starts_at).getTime();
    return start <= t && start + b.minutes * 60_000 > t;
  }).length;
}

/** Horarios de un día con su disponibilidad (jornada, anticipación y capacidad). */
export function computeSlots({
  date,
  minutes,
  busy,
  now = new Date(),
  minLeadMinutes = 0,
}: {
  date: string;
  minutes: number;
  busy: BusyInterval[];
  now?: Date;
  minLeadMinutes?: number;
}): Slot[] {
  const hours = BUSINESS_HOURS[weekdayOf(date)];
  if (!hours) return [];
  const windowEnd = now.getTime() + BOOKING_WINDOW_DAYS * 86_400_000;
  const earliest = now.getTime() + minLeadMinutes * 60_000;
  const slots: Slot[] = [];

  for (let m = toMinutes(hours.open); m + minutes <= toMinutes(hours.close); m += SLOT_MINUTES) {
    const time = toHHMM(m);
    const start = zonedToUtc(date, time).getTime();
    if (start > windowEnd) continue;

    let reason: Slot["reason"];
    if (start < earliest) {
      reason = "past";
    } else {
      for (let t = start; t < start + minutes * 60_000; t += SLOT_MINUTES * 60_000) {
        if (occupancyAt(busy, t) >= BAY_CAPACITY) {
          reason = "full";
          break;
        }
      }
    }
    slots.push({ time, starts_at: new Date(start).toISOString(), available: !reason, reason });
  }
  return slots;
}

/**
 * Valida un turno concreto. Devuelve el mensaje de error (mismos textos que
 * el SQL) o `null` si es válido.
 */
export function validateSlot(input: {
  start: Date;
  minutes: number;
  busy: BusyInterval[];
  now?: Date;
  minLeadMinutes?: number;
}): string | null {
  const { start, minutes, busy, now = new Date(), minLeadMinutes = 0 } = input;
  if (start.getTime() < now.getTime() + minLeadMinutes * 60_000) {
    return "Ese horario ya pasó o es demasiado próximo. Elige otro.";
  }
  if (start.getTime() > now.getTime() + BOOKING_WINDOW_DAYS * 86_400_000) {
    return `Solo se puede reservar con hasta ${BOOKING_WINDOW_DAYS} días de anticipación`;
  }
  const date = toDateKey(start);
  const hours = BUSINESS_HOURS[weekdayOf(date)];
  if (!hours) return "El taller no atiende los domingos";
  const startMin = minutesOfDay(start);
  if (startMin % SLOT_MINUTES !== 0) return "Los turnos comienzan cada 30 minutos";
  if (startMin < toMinutes(hours.open) || startMin + minutes > toMinutes(hours.close)) {
    return "El turno queda fuera del horario de atención";
  }
  for (let t = start.getTime(); t < start.getTime() + minutes * 60_000; t += SLOT_MINUTES * 60_000) {
    if (occupancyAt(busy, t) >= BAY_CAPACITY) return "Ese horario ya está completo. Elige otro.";
  }
  return null;
}
