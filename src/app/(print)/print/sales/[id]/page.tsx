import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSaleDetail } from "@/app/actions/pos";
import { WORKSHOP } from "@/lib/business";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { FULFILLMENT_LABEL, PAYMENT_METHOD_LABEL, SALES_CHANNEL_LABEL } from "@/lib/sales/shared";
import { saleChange } from "@/lib/sales/ticket";
import { TicketToolbar } from "./ticket-toolbar";

export async function generateMetadata({ params }: PageProps<"/print/sales/[id]">): Promise<Metadata> {
  const sale = await getSaleDetail((await params).id);
  return { title: sale ? `Ticket ${sale.folio}` : "Ticket" };
}

/** Ticket de venta para impresora térmica de 80 mm (o PDF). */
export default async function PrintSalePage({ params, searchParams }: PageProps<"/print/sales/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const sale = await getSaleDetail(id);
  if (!sale) notFound();

  const change = saleChange(sale);
  const row = "flex justify-between gap-2";

  return (
    <>
      <style>{`@page { size: 80mm auto; margin: 3mm; }`}</style>
      {/* ?print=1 (desde el POS) abre el diálogo de impresión al cargar. */}
      <TicketToolbar autoPrint={sp.print === "1"} />

      <article className="mx-auto grid w-[80mm] gap-2 bg-white px-[4mm] py-[5mm] font-mono text-[11px] leading-snug text-neutral-900 shadow-sm ring-1 ring-black/5 print:w-auto print:p-0 print:shadow-none print:ring-0">
        <header className="grid gap-0.5 text-center">
          <p className="text-sm font-bold">{WORKSHOP.name}</p>
          <p>{WORKSHOP.legalName}</p>
          <p>{WORKSHOP.taxId}</p>
          <p>{WORKSHOP.address}</p>
          <p>{WORKSHOP.phone}</p>
        </header>

        <div className="grid gap-0.5 border-y border-dashed border-neutral-400 py-1.5">
          <p className={row}>
            <span>Ticket</span>
            <span className="font-bold">{sale.folio}</span>
          </p>
          <p className={row}>
            <span>Fecha</span>
            <span>{formatDateTime(new Date(sale.paid_at ?? sale.created_at))}</span>
          </p>
          <p className={row}>
            <span>Canal</span>
            <span>{SALES_CHANNEL_LABEL[sale.channel]}</span>
          </p>
          <p className={row}>
            <span>Cliente</span>
            <span className="truncate">{sale.customer.name ?? "Consumidor final"}</span>
          </p>
          {sale.seller_name ? (
            <p className={row}>
              <span>Atendió</span>
              <span className="truncate">{sale.seller_name}</span>
            </p>
          ) : null}
          {sale.fulfillment ? (
            <p className={row}>
              <span>Entrega</span>
              <span>{FULFILLMENT_LABEL[sale.fulfillment]}</span>
            </p>
          ) : null}
        </div>

        <table className="w-full">
          <thead className="sr-only">
            <tr>
              <th>Producto</th>
              <th>Importe</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item) => (
              <tr key={item.product_id} className="align-top">
                <td className="py-0.5 pr-2">
                  <p>{item.product_name}</p>
                  <p className="text-neutral-600">
                    {item.quantity} x {formatCurrency(item.unit_price)}
                  </p>
                </td>
                <td className="py-0.5 text-right whitespace-nowrap">{formatCurrency(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="grid gap-0.5 border-t border-dashed border-neutral-400 pt-1.5">
          <p className={row}>
            <span>Subtotal</span>
            <span>{formatCurrency(sale.subtotal)}</span>
          </p>
          {sale.tax > 0 ? (
            <p className={row}>
              <span>IVA</span>
              <span>{formatCurrency(sale.tax)}</span>
            </p>
          ) : null}
          <p className={`${row} text-sm font-bold`}>
            <span>TOTAL</span>
            <span>{formatCurrency(sale.total)}</span>
          </p>
          <p className={row}>
            <span>Pago</span>
            <span>{sale.payment_method ? PAYMENT_METHOD_LABEL[sale.payment_method] : "—"}</span>
          </p>
          {sale.amount_tendered !== null && change !== null ? (
            <>
              <p className={row}>
                <span>Recibido</span>
                <span>{formatCurrency(sale.amount_tendered)}</span>
              </p>
              <p className={row}>
                <span>Vuelto</span>
                <span>{formatCurrency(change)}</span>
              </p>
            </>
          ) : null}
        </div>

        <footer className="grid gap-0.5 border-t border-dashed border-neutral-400 pt-1.5 text-center">
          <p>¡Gracias por tu compra!</p>
          <p className="text-neutral-600">Comprobante no válido como factura</p>
        </footer>
      </article>
    </>
  );
}
