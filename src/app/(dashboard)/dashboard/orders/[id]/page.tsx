import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Gauge, HardHat, Lock, Mail, Phone, User } from "lucide-react";
import { getCustomerProfile, getWorkOrderPhotos } from "@/app/actions/customers";
import { getMechanics, getWorkOrderDetail } from "@/app/actions/orders";
import { StatusSelect } from "@/components/orders/status-select";
import { WorkOrderStatusBadge } from "@/components/orders/work-order-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDateTime, formatKm, formatNumber, formatRelativeDays, formatPlate } from "@/lib/format";
import { WORK_ORDER_STATUS_LABEL } from "@/lib/labels";
import { isEditable } from "@/lib/orders/workflow";
import { CheckInSuccess } from "./_components/check-in-success";
import { DiagnosisCard } from "./_components/diagnosis-card";
import { LaborCard } from "./_components/labor-card";
import { OrderDocuments } from "./_components/order-documents";
import { PartsCard } from "./_components/parts-card";
import { ReceptionCard } from "./_components/reception-card";

export async function generateMetadata({ params }: PageProps<"/dashboard/orders/[id]">): Promise<Metadata> {
  const { id } = await params;
  const order = await getWorkOrderDetail(id);
  return { title: order ? `${order.folio} · ${formatPlate(order.motorcycle.plate)}` : "Orden no encontrada" };
}

export default async function WorkOrderPage({ params, searchParams }: PageProps<"/dashboard/orders/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [order, mechanics, photos] = await Promise.all([getWorkOrderDetail(id), getMechanics(), getWorkOrderPhotos(id)]);
  if (!order) notFound();
  const profile = await getCustomerProfile(order.customer.id);
  const receptionPhotos = photos.filter((p) => p.stage === "reception");

  const editable = isEditable(order.status);
  const { motorcycle: moto, customer } = order;

  return (
    <div className="grid gap-6">
      <div className="grid gap-4">
        {query.recepcion === "1" ? (
          <CheckInSuccess order={order} photoCount={receptionPhotos.length} />
        ) : null}
        <Link
          href="/dashboard/orders"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Órdenes de trabajo
        </Link>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-2xl font-semibold tracking-tight">{order.folio}</h1>
              <WorkOrderStatusBadge status={order.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {moto.brand} {moto.model} · <span className="font-mono">{formatPlate(moto.plate)}</span> · {customer.name} · ingresó{" "}
              {formatRelativeDays(new Date(order.created_at))}
              {order.appointment_code ? (
                <>
                  {" · "}
                  <Link href="/dashboard/appointments?view=list" className="underline-offset-4 hover:underline">
                    desde la cita <span className="font-mono">MO-{order.appointment_code}</span>
                  </Link>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusSelect order={order} />
            <OrderDocuments order={order} customerRut={profile?.rut ?? null} photos={receptionPhotos} />
          </div>
        </div>

        {!editable ? (
          <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            <Lock className="size-4 shrink-0" aria-hidden />
            Orden {WORK_ORDER_STATUS_LABEL[order.status].toLowerCase()}: repuestos y mano de obra quedan en solo lectura.
            {order.status === "cancelled" ? " Puedes reabrirla desde el selector de estado." : ""}
          </p>
        ) : null}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="grid gap-4 lg:col-span-2">
          <ReceptionCard photos={photos} km={order.km_at_intake} fuel={order.fuel_level} />
          <DiagnosisCard
            // Solo se reinicia si cambian sus propios datos (no al agregar repuestos).
            key={`${order.diagnosis ?? ""}|${order.mechanic?.id ?? ""}|${order.status}`}
            orderId={order.id}
            intakeReason={order.intake_reason}
            diagnosis={order.diagnosis}
            mechanic={order.mechanic}
            mechanics={mechanics}
            editable={editable}
          />
          <PartsCard orderId={order.id} parts={order.parts} subtotal={order.parts_amount} editable={editable} />
          <LaborCard orderId={order.id} labor={order.labor} subtotal={order.labor_amount} editable={editable} />
        </div>

        <aside className="grid gap-4 lg:sticky lg:top-20">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Repuestos ({order.parts.reduce((s, p) => s + p.quantity, 0)} u.)</dt>
                  <dd className="tabular-nums">{formatCurrency(order.parts_amount)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">
                    Mano de obra ({formatNumber(order.labor.reduce((s, l) => s + l.hours, 0))} h)
                  </dt>
                  <dd className="tabular-nums">{formatCurrency(order.labor_amount)}</dd>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-4 border-t pt-3">
                  <dt className="font-medium">Total OT</dt>
                  <dd className="text-2xl font-semibold tracking-tight tabular-nums">{formatCurrency(order.total_amount)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Moto</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div>
                <p className="font-medium">
                  {moto.brand} {moto.model}
                </p>
                <p className="text-muted-foreground">Año {moto.year}</p>
              </div>
              <dl className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Patente</dt>
                  <dd className="w-fit rounded border bg-muted/60 px-1.5 font-mono tracking-wide">{formatPlate(moto.plate)}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Gauge className="size-3" aria-hidden /> Km al ingreso
                  </dt>
                  <dd className="tabular-nums">{order.km_at_intake !== null ? formatKm(order.km_at_intake) : "—"}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">VIN</dt>
                  <dd className="font-mono text-xs">{moto.vin ?? "No registrado"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Cliente</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <User className="size-4 text-muted-foreground" aria-hidden />
                {customer.name}
              </p>
              {customer.phone ? (
                <a href={`tel:${customer.phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-2 hover:underline">
                  <Phone className="size-4 text-muted-foreground" aria-hidden />
                  {customer.phone}
                </a>
              ) : null}
              {customer.email ? (
                <a href={`mailto:${customer.email}`} className="flex items-center gap-2 truncate hover:underline">
                  <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  {customer.email}
                </a>
              ) : null}
              <p className="flex items-center gap-2 border-t pt-2 text-muted-foreground">
                <HardHat className="size-4" aria-hidden />
                Mecánico: <span className="text-foreground">{order.mechanic?.name ?? "Sin asignar"}</span>
              </p>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Historial</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="grid gap-2 text-sm">
                <li className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Recepción</span>
                  <span className="tabular-nums">{formatDateTime(new Date(order.created_at))}</span>
                </li>
                {order.completed_at ? (
                  <li className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Lista para entrega</span>
                    <span className="tabular-nums">{formatDateTime(new Date(order.completed_at))}</span>
                  </li>
                ) : null}
                {order.delivered_at ? (
                  <li className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Entregada</span>
                    <span className="tabular-nums">{formatDateTime(new Date(order.delivered_at))}</span>
                  </li>
                ) : null}
                <li className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Última actualización</span>
                  <span className="tabular-nums">{formatDateTime(new Date(order.updated_at))}</span>
                </li>
              </ol>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
