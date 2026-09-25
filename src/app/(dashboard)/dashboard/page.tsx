import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import {
  CalendarClock,
  Camera,
  ClipboardList,
  OctagonAlert,
  ScanBarcode,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { LiveRefresh } from "@/components/live-refresh";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardMetrics } from "@/lib/data/metrics";
import { formatCurrency, formatLongDate, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { KpiCard } from "./_components/kpi-card";
import { LowStockTable } from "./_components/low-stock-table";
import { RevenueChart } from "./_components/revenue-chart";
import { ServicesChart } from "./_components/services-chart";
import { TodayAppointments } from "./_components/today-appointments";

export const metadata: Metadata = { title: "Métricas" };

export default async function DashboardPage() {
  // Render por request: la agenda y los KPIs dependen de "hoy".
  await connection();
  const m = await getDashboardMetrics();

  // --- KPIs derivados -------------------------------------------------------
  const [previous, current] = m.revenueByMonth.slice(-2);
  const revenue = current.workshop + current.pos + current.ecommerce;
  const previousRevenue = previous.workshop + previous.pos + previous.ecommerce;
  const revenueDelta = previousRevenue > 0 ? (revenue - previousRevenue) / previousRevenue : 0;
  const directShare = revenue > 0 ? (current.pos + current.ecommerce) / revenue : 0;

  const maintenanceToday = m.todayAppointments.filter((a) => a.serviceType === "maintenance");
  const pendingToday = maintenanceToday.filter((a) => a.status === "scheduled").length;

  const outOfStock = m.stockAlerts.out;
  const stockAlerts = m.stockAlerts.low + m.stockAlerts.out;

  const wo = m.workOrdersByStatus;
  const openOrders = (wo.open ?? 0) + (wo.in_progress ?? 0) + (wo.waiting_parts ?? 0);

  const totalServices = m.servicesThisMonth.reduce((sum, s) => sum + s.count, 0);
  const DeltaIcon = revenueDelta >= 0 ? TrendingUp : TrendingDown;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Métricas"
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3">
            Resumen de {m.periodLabel}
            <LiveRefresh />
          </span>
        }
        actions={
          <>
            <Link href="/dashboard/pos" className={buttonVariants({ variant: "outline" })}>
              <ScanBarcode data-icon="inline-start" />
              Nueva venta
            </Link>
            <Link href="/dashboard/appointments?new=1" className={buttonVariants({ variant: "outline" })}>
              <CalendarClock data-icon="inline-start" />
              Nueva cita
            </Link>
            <Link href="/dashboard/orders/new" className={buttonVariants()}>
              <Camera data-icon="inline-start" />
              Recepcionar moto
            </Link>
          </>
        }
      />

      {/* KPIs */}
      <section aria-label="Indicadores clave" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Ingresos del mes"
          value={formatCurrency(revenue)}
          icon={Wallet}
          footer={
            <>
              <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 font-medium",
                    revenueDelta >= 0 ? "text-delta-up" : "text-status-critical"
                  )}
                >
                  <DeltaIcon className="size-3.5" aria-hidden />
                  {formatPercent(revenueDelta)}
                </span>
                vs. {m.previousPeriodLabel} · {formatPercent(directShare).replace("+", "")} ventas directas
              </span>
              <span className="mt-1 block">
                Hoy: {formatCurrency(m.salesToday.revenue)} en{" "}
                {m.salesToday.count === 1 ? "1 venta" : `${m.salesToday.count} ventas`} (POS + online)
              </span>
            </>
          }
        />
        <KpiCard
          title="Mantenimientos hoy"
          value={String(maintenanceToday.length)}
          icon={CalendarClock}
          footer={
            <>
              {pendingToday} por confirmar · {m.todayAppointments.length} citas en total
            </>
          }
        />
        <KpiCard
          title="Alertas de stock bajo"
          value={String(stockAlerts)}
          icon={OctagonAlert}
          tone={outOfStock > 0 ? "critical" : "default"}
          footer={
            outOfStock > 0 ? (
              <span className="inline-flex items-center gap-1">
                <OctagonAlert className="size-3.5 text-status-critical" aria-hidden />
                <span className="font-medium text-foreground">{outOfStock} sin stock</span>
                · reponer pronto
              </span>
            ) : (
              "Todos los productos sobre el mínimo"
            )
          }
        />
        <KpiCard
          title="Órdenes de trabajo abiertas"
          value={String(openOrders)}
          icon={ClipboardList}
          footer={
            <>
              {wo.in_progress ?? 0} en proceso · {wo.waiting_parts ?? 0} esperando repuestos
            </>
          }
        />
      </section>

      {/* Gráficos */}
      <section aria-label="Gráficos" className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ingresos por canal</CardTitle>
            <CardDescription>Taller, mostrador y e-commerce · últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart data={m.revenueByMonth} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Servicios del mes</CardTitle>
            <CardDescription>Por tipo de servicio</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-between gap-4">
            <div>
              <p className="text-3xl font-semibold tracking-tight">{totalServices}</p>
              <p className="text-xs text-muted-foreground">servicios realizados en {m.periodLabel}</p>
            </div>
            <ServicesChart data={m.servicesThisMonth} />
          </CardContent>
        </Card>
      </section>

      {/* Operación del día */}
      <section aria-label="Operación" className="grid gap-4 lg:grid-cols-2">
        <TodayAppointments appointments={m.todayAppointments} dateLabel={formatLongDate(new Date())} />
        <LowStockTable products={m.lowStockProducts} />
      </section>
    </div>
  );
}
