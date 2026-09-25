import type { WorkOrderPhoto } from "@/lib/customers/types";
import { FUEL_LEVEL_BARS, FUEL_LEVEL_LABEL } from "@/lib/checkin/shared";
import { formatCurrency, formatDate, formatDateTime, formatKm, formatNumber, formatPlate, formatRut } from "@/lib/format";
import { WORK_ORDER_STATUS_LABEL } from "@/lib/labels";
import { WORK_ORDER_DOC_TITLE, invoiceTotals, type WorkOrderDocType } from "@/lib/orders/documents";
import type { WorkOrderDetail } from "@/lib/orders/types";
import type { WorkshopBranding } from "@/lib/workshops/shared";

type Props = {
  type: WorkOrderDocType;
  workshop: WorkshopBranding;
  order: WorkOrderDetail;
  /** RUT normalizado del cliente (de su ficha), si lo tiene. */
  customerRut: string | null;
  /** Fotos de la etapa de recepción (solo se usan en el comprobante de recepción). */
  photos?: WorkOrderPhoto[];
  issuedAt: Date;
};

const sectionTitle = "mb-1.5 text-xs font-semibold tracking-wider text-neutral-500 uppercase";

/**
 * Comprobante A4 de la OT (recepción o liquidación). Siempre en blanco y negro,
 * para verse igual en pantalla (tema claro u oscuro) que impreso. Lo usan la
 * página /print/orders/[id] y el diálogo de vista previa de la orden.
 */
export function WorkOrderDocument({ type, workshop, order, customerRut, photos = [], issuedAt }: Props) {
  const { motorcycle: moto, customer } = order;

  return (
    <article
      data-print-document
      className="mx-auto grid w-full max-w-[210mm] gap-6 bg-white [print-color-adjust:exact] p-[14mm] text-[13px] leading-relaxed text-neutral-900 shadow-sm ring-1 ring-black/5 print:max-w-none print:p-0 print:shadow-none print:ring-0"
    >
      <style>{`@page { size: A4; margin: 14mm; }`}</style>

      {/* Encabezado */}
      <header className="flex items-start justify-between gap-6 border-b-2 border-neutral-900 pb-4">
        <div className="flex items-start gap-3">
          {workshop.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- documento imprimible
            <img src={workshop.logoUrl} alt="" className="size-14 shrink-0 rounded object-contain" />
          ) : null}
          <div>
            <p className="text-lg font-bold tracking-tight">{workshop.name}</p>
            <p className="text-xs text-neutral-600">{workshop.legalLine}</p>
            <p className="text-xs text-neutral-600">{workshop.address}</p>
            <p className="text-xs text-neutral-600">
              {[workshop.phone, workshop.email].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium tracking-widest text-neutral-500 uppercase">{WORK_ORDER_DOC_TITLE[type]}</p>
          <p className="font-mono text-2xl font-bold">{order.folio}</p>
          <p className="text-xs text-neutral-600">
            {type === "reception" ? `Ingreso: ${formatDateTime(new Date(order.created_at))}` : `Emitido: ${formatDate(issuedAt)}`}
          </p>
          {type === "invoice" ? <p className="text-xs text-neutral-600">Estado: {WORK_ORDER_STATUS_LABEL[order.status]}</p> : null}
        </div>
      </header>

      {/* Cliente y vehículo */}
      <section className="grid grid-cols-2 gap-6">
        <div>
          <h2 className={sectionTitle}>Cliente</h2>
          <p className="font-semibold">{customer.name}</p>
          <p>{customerRut ? <span className="font-mono">RUT {formatRut(customerRut)}</span> : "RUT: ____________________"}</p>
          <p>{customer.phone ?? "—"}</p>
          {customer.email ? <p>{customer.email}</p> : null}
        </div>
        <div>
          <h2 className={sectionTitle}>Vehículo</h2>
          <p className="font-semibold">
            {moto.brand} {moto.model} ({moto.year})
          </p>
          <p>
            Patente <span className="font-mono font-semibold">{formatPlate(moto.plate)}</span>
            {order.km_at_intake !== null ? ` · ${formatKm(order.km_at_intake)}` : ""}
          </p>
          {moto.vin ? <p className="font-mono text-xs">VIN {moto.vin}</p> : null}
        </div>
      </section>

      <section>
        <h2 className={sectionTitle}>Motivo de ingreso</h2>
        <p className="rounded border border-neutral-300 p-3 whitespace-pre-line">{order.intake_reason}</p>
      </section>

      {type === "reception" ? <ReceptionBody order={order} photos={photos} policy={workshop.receptionPolicy} /> : <InvoiceBody order={order} taxRate={workshop.taxRate} />}

      {/* Firmas de conformidad */}
      <footer className="mt-10 grid break-inside-avoid grid-cols-2 gap-16 text-center text-xs text-neutral-600">
        <div className="border-t border-neutral-900 pt-1.5">
          {type === "reception" ? "Firma de conformidad del cliente" : "Recibí conforme · firma del cliente"}
          <br />
          Nombre y RUT
        </div>
        <div className="border-t border-neutral-900 pt-1.5">
          Por {workshop.name}
          <br />
          {type === "reception" ? "Recepcionó" : "Entregó"}
        </div>
      </footer>
    </article>
  );
}

function ReceptionBody({ order, photos, policy }: { order: WorkOrderDetail; photos: WorkOrderPhoto[]; policy: string }) {
  return (
    <>
      <section className="grid grid-cols-2 gap-6">
        <div>
          <h2 className={sectionTitle}>Kilometraje de entrada</h2>
          <p className="text-lg font-semibold tabular-nums">{order.km_at_intake !== null ? formatKm(order.km_at_intake) : "—"}</p>
        </div>
        <div>
          <h2 className={sectionTitle}>Combustible</h2>
          {order.fuel_level ? (
            <p className="flex items-center gap-2 text-lg font-semibold">
              <span className="inline-flex gap-0.5" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`h-4 w-2.5 border border-neutral-900 ${i < FUEL_LEVEL_BARS[order.fuel_level!] ? "bg-neutral-900" : ""}`}
                  />
                ))}
              </span>
              {FUEL_LEVEL_LABEL[order.fuel_level]}
            </p>
          ) : (
            <p>—</p>
          )}
        </div>
      </section>

      {photos.length ? (
        <section>
          <h2 className={sectionTitle}>Registro fotográfico de ingreso ({photos.length})</h2>
          <ul className="grid grid-cols-3 gap-3">
            {photos.map((p) => (
              <li key={p.id} className="break-inside-avoid">
                {/* eslint-disable-next-line @next/next/no-img-element -- documento imprimible */}
                <img
                  src={p.url}
                  alt={p.caption ?? "Foto de recepción"}
                  className="aspect-[4/3] w-full rounded border border-neutral-300 object-cover"
                />
                <p className="mt-1 text-[11px] leading-snug">{p.caption ?? "Foto de recepción"}</p>
                <p className="text-[10px] text-neutral-500">{formatDateTime(new Date(p.created_at))}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className={sectionTitle}>Observaciones de recepción (accesorios entregados, otros detalles)</h2>
        <div className="grid gap-5 pt-3" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="border-b border-dashed border-neutral-400" />
          ))}
        </div>
      </section>
      <section className="text-xs text-neutral-600">
        <p className="whitespace-pre-line">{policy}</p>
      </section>
    </>
  );
}

function InvoiceBody({ order, taxRate }: { order: WorkOrderDetail; taxRate: number }) {
  const { net, tax, total, rate } = invoiceTotals(order.total_amount, taxRate);

  return (
    <>
      {order.diagnosis ? (
        <section>
          <h2 className={sectionTitle}>Diagnóstico y trabajos</h2>
          <p className="whitespace-pre-line">{order.diagnosis}</p>
        </section>
      ) : null}

      <section>
        <h2 className={sectionTitle}>Mano de obra</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-neutral-900 text-left text-xs">
              <th className="py-1.5 font-semibold">Trabajo</th>
              <th className="py-1.5 text-right font-semibold">Horas</th>
              <th className="py-1.5 text-right font-semibold">Valor hora</th>
              <th className="py-1.5 text-right font-semibold">Importe</th>
            </tr>
          </thead>
          <tbody>
            {order.labor.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-2 text-neutral-500">
                  Sin mano de obra.
                </td>
              </tr>
            ) : (
              order.labor.map((l) => (
                <tr key={l.id} className="break-inside-avoid border-b border-neutral-200">
                  <td className="py-1.5">{l.description}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatNumber(l.hours)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatCurrency(l.hourly_rate)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatCurrency(l.line_total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className={sectionTitle}>Repuestos e insumos</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-neutral-900 text-left text-xs">
              <th className="py-1.5 font-semibold">Descripción</th>
              <th className="py-1.5 font-semibold">SKU</th>
              <th className="py-1.5 text-right font-semibold">Cant.</th>
              <th className="py-1.5 text-right font-semibold">P. unit.</th>
              <th className="py-1.5 text-right font-semibold">Importe</th>
            </tr>
          </thead>
          <tbody>
            {order.parts.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-2 text-neutral-500">
                  Sin repuestos.
                </td>
              </tr>
            ) : (
              order.parts.map((p) => (
                <tr key={p.id} className="break-inside-avoid border-b border-neutral-200">
                  <td className="py-1.5">{p.product_name}</td>
                  <td className="py-1.5 font-mono text-xs">{p.sku}</td>
                  <td className="py-1.5 text-right tabular-nums">{p.quantity}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatCurrency(p.unit_price)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatCurrency(p.line_total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="ml-auto grid w-72 break-inside-avoid gap-1.5 text-sm">
        <div className="flex justify-between">
          <span>Mano de obra</span>
          <span className="tabular-nums">{formatCurrency(order.labor_amount)}</span>
        </div>
        <div className="flex justify-between">
          <span>Repuestos e insumos</span>
          <span className="tabular-nums">{formatCurrency(order.parts_amount)}</span>
        </div>
        <div className="flex justify-between border-t border-neutral-300 pt-1.5 text-neutral-600">
          <span>Neto</span>
          <span className="tabular-nums">{formatCurrency(net)}</span>
        </div>
        <div className="flex justify-between text-neutral-600">
          <span>IVA ({Math.round(rate * 100)}%)</span>
          <span className="tabular-nums">{formatCurrency(tax)}</span>
        </div>
        <div className="flex justify-between border-t-2 border-neutral-900 pt-1.5 text-base font-bold">
          <span>Total CLP</span>
          <span className="tabular-nums">{formatCurrency(total)}</span>
        </div>
      </section>

      <p className="text-xs text-neutral-500">
        Valores con IVA incluido. Documento no válido como factura. Garantía de mano de obra: 90 días o 3.000 km, lo que
        ocurra primero.
      </p>
    </>
  );
}
