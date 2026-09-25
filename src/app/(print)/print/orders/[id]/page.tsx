import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWorkOrderPhotos } from "@/app/actions/customers";
import { getWorkOrderDetail } from "@/app/actions/orders";
import { WORKSHOP } from "@/lib/business";
import { FUEL_LEVEL_BARS, FUEL_LEVEL_LABEL } from "@/lib/checkin/shared";
import { formatCurrency, formatDate, formatDateTime, formatKm, formatNumber, formatPlate } from "@/lib/format";
import { WORK_ORDER_STATUS_LABEL } from "@/lib/labels";
import { PrintToolbar } from "./print-toolbar";

type DocType = "reception" | "invoice";

const TITLES: Record<DocType, string> = {
  reception: "Comprobante de recepción",
  invoice: "Comprobante de servicio",
};

export async function generateMetadata({ params, searchParams }: PageProps<"/print/orders/[id]">): Promise<Metadata> {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const order = await getWorkOrderDetail(id);
  const type: DocType = sp.type === "invoice" ? "invoice" : "reception";
  return { title: order ? `${TITLES[type]} ${order.folio}` : "Documento" };
}

export default async function PrintWorkOrderPage({ params, searchParams }: PageProps<"/print/orders/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const type: DocType = sp.type === "invoice" ? "invoice" : "reception";
  const [order, photos] = await Promise.all([
    getWorkOrderDetail(id),
    type === "reception" ? getWorkOrderPhotos(id) : Promise.resolve([]),
  ]);
  if (!order) notFound();
  const receptionPhotos = photos.filter((p) => p.stage === "reception");

  const { motorcycle: moto, customer } = order;
  const issuedAt = new Date();

  return (
    <>
      <style>{`@page { size: A4; margin: 14mm; }`}</style>
      <PrintToolbar
        backHref={`/dashboard/orders/${order.id}`}
        otherHref={`/print/orders/${order.id}?type=${type === "invoice" ? "reception" : "invoice"}`}
        otherLabel={type === "invoice" ? "Ver orden de recepción" : "Ver comprobante"}
      />

      <article className="mx-auto grid max-w-[210mm] gap-6 bg-white p-[14mm] text-[13px] leading-relaxed text-neutral-900 shadow-sm ring-1 ring-black/5 print:max-w-none print:p-0 print:shadow-none print:ring-0">
        {/* Encabezado */}
        <header className="flex items-start justify-between gap-6 border-b-2 border-neutral-900 pb-4">
          <div>
            <p className="text-lg font-bold tracking-tight">{WORKSHOP.name}</p>
            <p className="text-xs text-neutral-600">{WORKSHOP.legalName} · {WORKSHOP.taxId}</p>
            <p className="text-xs text-neutral-600">{WORKSHOP.address}</p>
            <p className="text-xs text-neutral-600">{WORKSHOP.phone} · {WORKSHOP.email}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium tracking-widest text-neutral-500 uppercase">{TITLES[type]}</p>
            <p className="font-mono text-2xl font-bold">{order.folio}</p>
            <p className="text-xs text-neutral-600">
              {type === "reception" ? `Ingreso: ${formatDateTime(new Date(order.created_at))}` : `Emitido: ${formatDate(issuedAt)}`}
            </p>
            {type === "invoice" ? (
              <p className="text-xs text-neutral-600">Estado: {WORK_ORDER_STATUS_LABEL[order.status]}</p>
            ) : null}
          </div>
        </header>

        {/* Cliente y vehículo */}
        <section className="grid grid-cols-2 gap-6">
          <div>
            <h2 className="mb-1.5 text-xs font-semibold tracking-wider text-neutral-500 uppercase">Cliente</h2>
            <p className="font-semibold">{customer.name}</p>
            <p>{customer.phone ?? "—"}</p>
            {customer.email ? <p>{customer.email}</p> : null}
          </div>
          <div>
            <h2 className="mb-1.5 text-xs font-semibold tracking-wider text-neutral-500 uppercase">Vehículo</h2>
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
          <h2 className="mb-1.5 text-xs font-semibold tracking-wider text-neutral-500 uppercase">Motivo de ingreso</h2>
          <p className="rounded border border-neutral-300 p-3 whitespace-pre-line">{order.intake_reason}</p>
        </section>

        {type === "reception" ? (
          <>
            <section className="grid grid-cols-2 gap-6">
              <div>
                <h2 className="mb-1.5 text-xs font-semibold tracking-wider text-neutral-500 uppercase">Kilometraje de entrada</h2>
                <p className="text-lg font-semibold tabular-nums">{order.km_at_intake !== null ? formatKm(order.km_at_intake) : "—"}</p>
              </div>
              <div>
                <h2 className="mb-1.5 text-xs font-semibold tracking-wider text-neutral-500 uppercase">Combustible</h2>
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

            {receptionPhotos.length ? (
              <section className="break-inside-avoid">
                <h2 className="mb-1.5 text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                  Registro fotográfico de ingreso ({receptionPhotos.length})
                </h2>
                <ul className="grid grid-cols-3 gap-3">
                  {receptionPhotos.map((p) => (
                    <li key={p.id} className="break-inside-avoid">
                      {/* eslint-disable-next-line @next/next/no-img-element -- documento imprimible */}
                      <img src={p.url} alt={p.caption ?? "Foto de recepción"} className="aspect-[4/3] w-full rounded border border-neutral-300 object-cover" />
                      <p className="mt-1 text-[11px] leading-snug">{p.caption ?? "Foto de recepción"}</p>
                      <p className="text-[10px] text-neutral-500">{formatDateTime(new Date(p.created_at))}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section>
              <h2 className="mb-1.5 text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                Observaciones de recepción (accesorios entregados, otros detalles)
              </h2>
              <div className="grid gap-5 pt-3" aria-hidden>
                {[0, 1].map((i) => (
                  <div key={i} className="border-b border-dashed border-neutral-400" />
                ))}
              </div>
            </section>
            <section className="text-xs text-neutral-600">
              <p>
                El cliente declara que las fotografías reflejan el estado de la unidad al ingreso. El cliente autoriza al taller a realizar el diagnóstico de la unidad. Todo trabajo adicional será
                presupuestado y requerirá aprobación previa. Las unidades no retiradas dentro de los 30 días
                posteriores a su aviso de finalización podrán generar cargos de guarda.
              </p>
            </section>
          </>
        ) : (
          <>
            {order.diagnosis ? (
              <section>
                <h2 className="mb-1.5 text-xs font-semibold tracking-wider text-neutral-500 uppercase">Diagnóstico y trabajos</h2>
                <p className="whitespace-pre-line">{order.diagnosis}</p>
              </section>
            ) : null}

            <section>
              <h2 className="mb-1.5 text-xs font-semibold tracking-wider text-neutral-500 uppercase">Repuestos</h2>
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
                      <td colSpan={5} className="py-2 text-neutral-500">Sin repuestos.</td>
                    </tr>
                  ) : (
                    order.parts.map((p) => (
                      <tr key={p.id} className="border-b border-neutral-200">
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

            <section>
              <h2 className="mb-1.5 text-xs font-semibold tracking-wider text-neutral-500 uppercase">Mano de obra</h2>
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
                      <td colSpan={4} className="py-2 text-neutral-500">Sin mano de obra.</td>
                    </tr>
                  ) : (
                    order.labor.map((l) => (
                      <tr key={l.id} className="border-b border-neutral-200">
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

            <section className="ml-auto grid w-72 gap-1.5 text-sm">
              <div className="flex justify-between">
                <span>Subtotal repuestos</span>
                <span className="tabular-nums">{formatCurrency(order.parts_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Subtotal mano de obra</span>
                <span className="tabular-nums">{formatCurrency(order.labor_amount)}</span>
              </div>
              <div className="flex justify-between border-t-2 border-neutral-900 pt-1.5 text-base font-bold">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(order.total_amount)}</span>
              </div>
            </section>

            <p className="text-xs text-neutral-500">
              Documento no válido como factura. Garantía de mano de obra: 90 días o 3.000 km, lo que ocurra primero.
            </p>
          </>
        )}

        {/* Firmas */}
        <footer className="mt-10 grid grid-cols-2 gap-16 text-center text-xs text-neutral-600">
          <div className="border-t border-neutral-900 pt-1.5">Firma y aclaración del cliente</div>
          <div className="border-t border-neutral-900 pt-1.5">Por {WORKSHOP.name}</div>
        </footer>
      </article>
    </>
  );
}
