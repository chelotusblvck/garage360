import { PLATFORM } from "@/lib/business";
import { formatCurrency } from "@/lib/format";
import { PLANS, SETUPS, quoteTotals, type HardwareLine, type PlanKey, type SetupType } from "@/lib/workshops/plans";

/* Resumen en texto plano de una cotización (WhatsApp a ventas y descarga .txt). */

export type QuoteContact = {
  workshop_name: string;
  contact_name: string;
  email: string;
  phone: string;
  comuna: string | null;
};

/** Número corto para citar por teléfono / WhatsApp. */
export const quotationRef = (id: string) => id.replaceAll("-", "").slice(0, 8).toUpperCase();

/** "+56 9 5555 0360" → "56955550360" (formato de wa.me). */
export const whatsappNumber = (phone: string) => phone.replace(/\D/g, "");

export function quoteSummaryText(
  id: string,
  contact: QuoteContact,
  plan: PlanKey,
  setup: SetupType,
  hardware: HardwareLine[]
) {
  const t = quoteTotals(plan, setup, hardware);
  const money = formatCurrency;
  return [
    `Cotización ${PLATFORM.name} · N° ${quotationRef(id)}`,
    "",
    `Taller: ${contact.workshop_name}${contact.comuna ? ` (${contact.comuna})` : ""}`,
    `Contacto: ${contact.contact_name} · ${contact.email} · ${contact.phone}`,
    "",
    `Plan: ${PLANS[plan].label} · ${money(PLANS[plan].monthly)}/mes`,
    `Implementación: ${SETUPS[setup].label}`,
    ...(t.lines.length ? ["Equipamiento:", ...t.lines.map((l) => `  · ${l.qty} × ${l.label} (${money(l.unit)} c/u) = ${money(l.subtotal)}`)] : ["Equipamiento: sin equipos"]),
    "",
    "PAGO INICIAL (setup + equipamiento)",
    `  Neto: ${money(t.initial.net)}`,
    `  IVA:  ${money(t.initial.tax)}`,
    `  Total: ${money(t.initial.total)}`,
    "",
    "MENSUALIDAD RECURRENTE",
    `  Neto: ${money(t.monthly.net)}`,
    `  IVA:  ${money(t.monthly.tax)}`,
    `  Total: ${money(t.monthly.total)}/mes`,
    "",
    "Precios en CLP. Valores referenciales sujetos a confirmación del equipo de ventas.",
    `${PLATFORM.company} · ${PLATFORM.salesEmail} · ${PLATFORM.salesPhone}`,
  ].join("\n");
}
