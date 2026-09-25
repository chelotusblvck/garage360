import { SALES_TAX, WORKSHOP } from "@/lib/business";
import { FUEL_LEVEL_LABEL } from "@/lib/checkin/shared";
import { formatCurrency, formatKm, formatPlate } from "@/lib/format";
import type { WorkOrderDetail, WorkOrderSummary } from "./types";

/* Comprobantes de la OT: compartidos por el diálogo del panel y /print/orders. */

export type WorkOrderDocType = "reception" | "invoice";

export const WORK_ORDER_DOC_TITLE: Record<WorkOrderDocType, string> = {
  reception: "Comprobante de recepción",
  invoice: "Comprobante de servicio",
};

/**
 * Desglose tributario del total. Los precios de repuestos y mano de obra son
 * finales (IVA incluido), así que el neto se obtiene descontando el IVA.
 */
export function invoiceTotals(total: number) {
  const net = Math.round(total / (1 + SALES_TAX.rate));
  return { net, tax: total - net, total, rate: SALES_TAX.rate };
}

const firstName = (name: string) => name.split(" ")[0];

/** Mensaje de WhatsApp / email al recepcionar la moto. */
export function receptionMessage(order: WorkOrderSummary, photoCount: number) {
  const { customer, motorcycle: moto } = order;
  return [
    `Hola ${firstName(customer.name)}, recibimos tu ${moto.brand} ${moto.model} (${formatPlate(moto.plate)}) en ${WORKSHOP.name}.`,
    `Orden de trabajo ${order.folio}` +
      (order.km_at_intake !== null ? ` · ${formatKm(order.km_at_intake)}` : "") +
      (order.fuel_level ? ` · combustible ${FUEL_LEVEL_LABEL[order.fuel_level]}` : "") +
      ".",
    `Registramos ${photoCount} fotos del estado de ingreso. Te avisaremos apenas tengamos el diagnóstico.`,
  ].join("\n");
}

/** Mensaje de WhatsApp con la liquidación del servicio. */
export function invoiceMessage(order: WorkOrderDetail) {
  const { customer, motorcycle: moto } = order;
  const { net, tax, total } = invoiceTotals(order.total_amount);
  return [
    `Hola ${firstName(customer.name)}, este es el detalle del servicio de tu ${moto.brand} ${moto.model} (${formatPlate(moto.plate)}).`,
    `Orden de trabajo ${order.folio}`,
    "",
    `Repuestos: ${formatCurrency(order.parts_amount)}`,
    `Mano de obra: ${formatCurrency(order.labor_amount)}`,
    `Neto: ${formatCurrency(net)} · IVA: ${formatCurrency(tax)}`,
    `TOTAL: ${formatCurrency(total)}`,
    "",
    `${WORKSHOP.name} · ${WORKSHOP.phone}`,
  ].join("\n");
}
