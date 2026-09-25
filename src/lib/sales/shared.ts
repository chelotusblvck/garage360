import type { Fulfillment, PaymentMethod } from "@/lib/validations/schemas";
import type { Sale, SalesChannel, SalesSummary } from "./types";

/* Etiquetas y cálculos de ventas compartidos por cliente y servidor. */

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  debit_card: "Tarjeta de débito",
  credit_card: "Tarjeta de crédito",
  transfer: "Transferencia",
  online: "Tarjeta online",
};

export const SALES_CHANNEL_LABEL: Record<SalesChannel, string> = {
  pos: "Mostrador",
  online: "E-commerce",
};

export const FULFILLMENT_LABEL: Record<Fulfillment, string> = {
  pickup: "Retiro en taller",
  delivery: "Envío a domicilio",
};

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const formatSaleFolio = (n: number) => `V-${String(n).padStart(6, "0")}`;

/** Totales de un carrito: mismo redondeo que create_pos_sale() en SQL. */
export function computeTotals(lines: { unit_price: number; quantity: number }[], taxRate = 0) {
  const subtotal = round2(lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0));
  const tax = round2(subtotal * taxRate);
  return { subtotal, tax, total: round2(subtotal + tax) };
}

export function summarizeSales(sales: Sale[]): SalesSummary {
  const paid = sales.filter((s) => s.status === "paid");
  const summary: SalesSummary = {
    count: paid.length,
    revenue: 0,
    units: 0,
    averageTicket: 0,
    byChannel: { pos: { count: 0, revenue: 0 }, online: { count: 0, revenue: 0 } },
    byPaymentMethod: {},
  };
  for (const sale of paid) {
    summary.revenue += sale.total;
    summary.units += sale.units;
    summary.byChannel[sale.channel].count += 1;
    summary.byChannel[sale.channel].revenue += sale.total;
    if (sale.payment_method) {
      summary.byPaymentMethod[sale.payment_method] = (summary.byPaymentMethod[sale.payment_method] ?? 0) + sale.total;
    }
  }
  summary.revenue = round2(summary.revenue);
  summary.averageTicket = paid.length ? round2(summary.revenue / paid.length) : 0;
  return summary;
}
