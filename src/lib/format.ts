/**
 * Configuración regional centralizada. Cambia LOCALE / CURRENCY para
 * adaptar todo el formato de la app (p. ej. "es-MX" + "MXN", "es-CL" + "CLP").
 */
export const LOCALE = "es-CL";
export const CURRENCY = "CLP";
export const TIME_ZONE = "America/Santiago";

/** Pesos chilenos sin decimales y con punto de miles: "$1.234.567". */
const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const compactCurrencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  notation: "compact",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const percentFormatter = new Intl.NumberFormat(LOCALE, {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

const numberFormatter = new Intl.NumberFormat(LOCALE);

export const formatCurrency = (value: number) => currencyFormatter.format(value);
export const formatCompactCurrency = (value: number) =>
  compactCurrencyFormatter.format(value);
export const formatPercent = (ratio: number) => percentFormatter.format(ratio);
export const formatNumber = (value: number) => numberFormatter.format(value);

export const formatTime = (date: Date) =>
  new Intl.DateTimeFormat(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: TIME_ZONE,
  }).format(date);

export const formatMonthYear = (date: Date) =>
  new Intl.DateTimeFormat(LOCALE, {
    month: "long",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(date);

export const formatDateTime = (date: Date) =>
  new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: TIME_ZONE,
  }).format(date);

export const formatDate = (date: Date) =>
  new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(date);

const relativeFormatter = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });

/** "hoy", "ayer", "hace 3 días", "hace 2 semanas"… */
export function formatRelativeDays(date: Date, now = new Date()) {
  const startOfDay = (d: Date) => {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy.getTime();
  };
  const days = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
  if (days > -14) return relativeFormatter.format(days, "day");
  if (days > -60) return relativeFormatter.format(Math.round(days / 7), "week");
  return relativeFormatter.format(Math.round(days / 30), "month");
}

export const formatKm = (km: number) => `${numberFormatter.format(km)} km`;

/**
 * Patente chilena de moto con separador: "AB123" → "AB·123", "JKL12" → "JKL·12".
 * Se guarda normalizada (sin separadores); esto es solo para mostrar.
 */
export function formatPlate(plate: string) {
  const match = /^([A-Z]{2,3})(\d{2,3})$/.exec(plate);
  return match ? `${match[1]}·${match[2]}` : plate;
}

/** RUT chileno: "765432103" o "76543210-3" → "76.543.210-3". */
export function formatRut(rut: string) {
  const clean = rut.replace(/[^0-9kK]/g, "").toUpperCase();
  if (clean.length < 2) return rut;
  const body = clean.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${body}-${clean.slice(-1)}`;
}

export const formatLongDate = (date: Date) =>
  new Intl.DateTimeFormat(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TIME_ZONE,
  }).format(date);
