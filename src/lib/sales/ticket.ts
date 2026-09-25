import { WORKSHOP } from "@/lib/business";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "./shared";
import type { SaleDetail } from "./types";

/** Vuelto a entregar (solo efectivo con monto recibido). */
export function saleChange(sale: Pick<SaleDetail, "amount_tendered" | "total">) {
  return sale.amount_tendered === null ? null : Math.max(0, sale.amount_tendered - sale.total);
}

/** Ticket en texto plano (cuerpo del email). */
export function ticketText(sale: SaleDetail): string {
  const lines = [
    WORKSHOP.name,
    `${WORKSHOP.address} · ${WORKSHOP.phone}`,
    "",
    `Ticket ${sale.folio} · ${formatDateTime(new Date(sale.paid_at ?? sale.created_at))}`,
    sale.customer.name ? `Cliente: ${sale.customer.name}` : "Cliente: consumidor final",
    "",
    ...sale.items.map(
      (i) => `${i.quantity} x ${i.product_name} (${formatCurrency(i.unit_price)}) = ${formatCurrency(i.line_total)}`
    ),
    "",
    `Subtotal: ${formatCurrency(sale.subtotal)}`,
    ...(sale.tax > 0 ? [`IVA: ${formatCurrency(sale.tax)}`] : []),
    `TOTAL: ${formatCurrency(sale.total)}`,
    `Pago: ${sale.payment_method ? PAYMENT_METHOD_LABEL[sale.payment_method] : "—"}`,
  ];
  const change = saleChange(sale);
  if (sale.amount_tendered !== null && change !== null) {
    lines.push(`Recibido: ${formatCurrency(sale.amount_tendered)} · Vuelto: ${formatCurrency(change)}`);
  }
  lines.push("", "¡Gracias por tu compra!", "Comprobante no válido como factura.");
  return lines.join("\n");
}

export function ticketMailto(sale: SaleDetail, email: string) {
  const subject = `Ticket ${sale.folio} · ${WORKSHOP.name}`;
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(ticketText(sale))}`;
}
