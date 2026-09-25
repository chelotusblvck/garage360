import { LOCALE, TIME_ZONE } from "./format";

/*
 * Fechas "de calendario" en la zona horaria del taller.
 * Un dateKey es "YYYY-MM-DD" y un timeKey "HH:mm", ambos en hora local del
 * taller (no del navegador ni del servidor).
 */

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function zonedParts(date: Date) {
  const parts = Object.fromEntries(partsFormatter.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Fecha local del taller: "2026-09-24". */
export function toDateKey(date: Date): string {
  const p = zonedParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Hora local del taller: "14:30". */
export function toTimeKey(date: Date): string {
  const p = zonedParts(date);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export const todayKey = () => toDateKey(new Date());

/** Minutos desde medianoche (hora local del taller). */
export function minutesOfDay(date: Date): number {
  const p = zonedParts(date);
  return p.hour * 60 + p.minute;
}

function offsetMs(date: Date): number {
  const p = zonedParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - (date.getTime() - date.getMilliseconds());
}

/** "2026-09-24" + "14:30" (hora del taller) → instante UTC. */
export function zonedToUtc(dateKey: string, timeKey = "00:00"): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = timeKey.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let result = guess - offsetMs(new Date(guess));
  const corrected = guess - offsetMs(new Date(result));
  if (corrected !== result) result = corrected; // cruce de horario de verano
  return new Date(result);
}

// ---- Aritmética de calendario (independiente de zona) ----------------------

const keyToUtcNoon = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
};
const utcToKey = (date: Date) =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

export function addDays(key: string, days: number): string {
  const date = keyToUtcNoon(key);
  date.setUTCDate(date.getUTCDate() + days);
  return utcToKey(date);
}

/** 0 = domingo … 6 = sábado. */
export const weekdayOf = (key: string) => keyToUtcNoon(key).getUTCDay();

/** Lunes de la semana del día dado. */
export function startOfWeek(key: string): string {
  const dow = weekdayOf(key);
  return addDays(key, dow === 0 ? -6 : 1 - dow);
}

export const startOfMonth = (key: string) => `${key.slice(0, 7)}-01`;

export function addMonths(key: string, months: number): string {
  const [y, m] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, 1, 12));
  return utcToKey(date);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((keyToUtcNoon(to).getTime() - keyToUtcNoon(from).getTime()) / 86_400_000);
}

export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let key = from; key <= to; key = addDays(key, 1)) days.push(key);
  return days;
}

// ---- Formato de dateKeys ---------------------------------------------------

const fmt = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: "UTC" });

const weekdayShort = fmt({ weekday: "short" });
const weekdayLong = fmt({ weekday: "long", day: "numeric", month: "long" });
const dayMonthShort = fmt({ day: "numeric", month: "short" });
const monthYear = fmt({ month: "long", year: "numeric" });
const fullDate = fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" });

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const formatWeekdayShort = (key: string) => capitalize(weekdayShort.format(keyToUtcNoon(key)).replace(".", ""));
export const formatDayLong = (key: string) => capitalize(weekdayLong.format(keyToUtcNoon(key)));
export const formatDayMonth = (key: string) => dayMonthShort.format(keyToUtcNoon(key)).replace(".", "");
export const formatMonthKey = (key: string) => capitalize(monthYear.format(keyToUtcNoon(key)));
export const formatFullDate = (key: string) => capitalize(fullDate.format(keyToUtcNoon(key)));
export const dayOfMonth = (key: string) => Number(key.slice(8, 10));
