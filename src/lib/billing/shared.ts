import { SALES_TAX } from "@/lib/business";
import { daysBetween } from "@/lib/datetime";
import { PLANS, SETUPS, type PlanKey } from "@/lib/workshops/plans";

/* Facturación de talleres (superadmin): estados, conceptos y cálculo de vencimientos. Cliente y servidor. */

export const BILLING_STATUSES = ["current", "pending", "overdue", "suspended"] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];

export const BILLING_STATUS_LABEL: Record<BillingStatus, string> = {
  current: "Al día",
  pending: "Pendiente",
  overdue: "En Mora",
  suspended: "Suspendido",
};

/** Días tras el vencimiento antes de pasar de «Pendiente» a «En Mora». */
export const GRACE_DAYS = 7;

export const PAYMENT_CONCEPTS = ["monthly", "annual", "setup"] as const;
export type PaymentConcept = (typeof PAYMENT_CONCEPTS)[number];

export const PAYMENT_CONCEPT: Record<PaymentConcept, { label: string; months: number }> = {
  monthly: { label: "Mensualidad", months: 1 },
  annual: { label: "Anualidad", months: 12 },
  setup: { label: "Setup VIP", months: 0 },
};

export const BILLING_METHODS = ["transfer", "webpay", "card", "cash", "other"] as const;
export type BillingMethod = (typeof BILLING_METHODS)[number];

export const BILLING_METHOD_LABEL: Record<BillingMethod, string> = {
  transfer: "Transferencia",
  webpay: "Webpay",
  card: "Tarjeta",
  cash: "Efectivo",
  other: "Otro",
};

/**
 * Estado de cobro. «Pendiente»: nunca pagó o venció hace menos de GRACE_DAYS.
 * «En Mora»: venció hace más. La suspensión es manual y tiene prioridad.
 */
export function billingStatus(
  account: { next_due_at: string | null; suspended_at: string | null },
  today: string
): BillingStatus {
  if (account.suspended_at) return "suspended";
  if (!account.next_due_at) return "pending";
  const late = daysBetween(account.next_due_at, today);
  if (late <= 0) return "current";
  return late > GRACE_DAYS ? "overdue" : "pending";
}

/** Suma meses a un dateKey conservando el día (31 ene + 1 mes → 28/29 feb). */
export function addBillingMonths(key: string, months: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Nuevo vencimiento tras un pago: si estaba al día se extiende desde el
 * vencimiento vigente (pago adelantado); si no, desde la fecha de pago.
 * El setup no mueve la fecha.
 */
export function nextDueAfterPayment(currentDue: string | null, paidAt: string, concept: PaymentConcept): string | null {
  const months = PAYMENT_CONCEPT[concept].months;
  if (!months) return currentDue;
  const base = currentDue && currentDue > paidAt ? currentDue : paidAt;
  return addBillingMonths(base, months);
}

/** Monto sugerido según el plan (IVA incluido). */
export function suggestedAmount(concept: PaymentConcept, plan: PlanKey, setupFee: number) {
  if (concept === "monthly") return PLANS[plan].monthly;
  if (concept === "annual") return PLANS[plan].monthly * 12;
  return setupFee || SETUPS.turnkey.fee;
}

/** Desglose de un monto con IVA incluido. */
export function withTax(total: number) {
  const net = Math.round(total / (1 + SALES_TAX.rate));
  return { net, tax: total - net, total };
}
