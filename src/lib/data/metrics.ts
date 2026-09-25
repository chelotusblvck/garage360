import "server-only";
import { getAppointmentRepository } from "@/lib/appointments/repository";
import {
  addDays,
  addMonths,
  formatMonthKey,
  startOfMonth,
  toDateKey,
  todayKey,
  toTimeKey,
  zonedToUtc,
} from "@/lib/datetime";
import { LOCALE } from "@/lib/format";
import { getInventoryRepository } from "@/lib/inventory/repository";
import { getSalesRepository } from "@/lib/sales/repository";
import { summarizeSales } from "@/lib/sales/shared";
import { getWorkOrderRepository } from "@/lib/orders/repository";
import type { Product } from "@/lib/inventory/types";
import type {
  AppointmentStatus,
  ServiceType,
  WorkOrderStatus,
} from "@/lib/validations/schemas";

export type MonthlyRevenue = {
  /** Etiqueta corta del mes (eje X). */
  month: string;
  /** Nombre completo para tooltip. */
  monthLong: string;
  /** OTs entregadas. */
  workshop: number;
  /** Ventas de mostrador (POS). */
  pos: number;
  /** Ventas de la tienda online. */
  ecommerce: number;
};

export type TodayAppointment = {
  id: string;
  time: string;
  clientName: string;
  motorcycle: string;
  plate: string;
  serviceType: ServiceType;
  status: AppointmentStatus;
  workOrderId: string | null;
};

export type LowStockProduct = Pick<Product, "id" | "name" | "sku" | "category" | "stock" | "min_stock" | "stock_status">;

export type DashboardMetrics = {
  periodLabel: string;
  previousPeriodLabel: string;
  revenueByMonth: MonthlyRevenue[];
  servicesThisMonth: { type: ServiceType; count: number }[];
  todayAppointments: TodayAppointment[];
  lowStockProducts: LowStockProduct[];
  stockAlerts: { low: number; out: number };
  workOrdersByStatus: Partial<Record<WorkOrderStatus, number>>;
  /** Ventas directas (POS + online) cobradas hoy. */
  salesToday: { count: number; revenue: number };
};

const REVENUE_MONTHS = 6;

const monthShort = new Intl.DateTimeFormat(LOCALE, { month: "short", timeZone: "UTC" });
const monthLong = new Intl.DateTimeFormat(LOCALE, { month: "long", timeZone: "UTC" });
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const monthDate = (key: string) => new Date(`${key.slice(0, 7)}-15T12:00:00Z`);

/** Ingresos cobrados por mes (hora del taller) y canal, últimos N meses. */
async function getRevenueByMonth(today: string): Promise<MonthlyRevenue[]> {
  const months = Array.from({ length: REVENUE_MONTHS }, (_, i) =>
    addMonths(startOfMonth(today), i - (REVENUE_MONTHS - 1))
  );
  const entries = await getSalesRepository().revenue(zonedToUtc(months[0]).toISOString());

  const rows = new Map<string, MonthlyRevenue>(
    months.map((key) => [
      key.slice(0, 7),
      {
        month: capitalize(monthShort.format(monthDate(key)).replace(".", "")),
        monthLong: capitalize(monthLong.format(monthDate(key))),
        workshop: 0,
        pos: 0,
        ecommerce: 0,
      },
    ])
  );
  for (const entry of entries) {
    const row = rows.get(toDateKey(new Date(entry.at)).slice(0, 7));
    if (!row) continue;
    const series = entry.channel === "online" ? "ecommerce" : entry.channel;
    row[series] += entry.amount;
  }
  return [...rows.values()];
}

/**
 * Métricas del dashboard. Ingresos, stock, órdenes y agenda salen de sus
 * repositorios (Supabase si está configurado, demo si no), así que una venta
 * en el POS o la tienda se refleja en la próxima carga.
 *
 * TODO(supabase): servicesThisMonth → `appointments` agrupado por service_type del mes.
 */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const inventory = getInventoryRepository();
  const today = todayKey();
  const [lowStockProducts, stats, workOrdersByStatus, appointments, revenueByMonth, salesToday] = await Promise.all([
    inventory.lowStock(6),
    inventory.stats(),
    getWorkOrderRepository().counts(),
    getAppointmentRepository().list({
      from: zonedToUtc(today).toISOString(),
      to: zonedToUtc(addDays(today, 1)).toISOString(),
      status: "all",
      service: "all",
    }),
    getRevenueByMonth(today),
    getSalesRepository()
      .history({ from: today, to: today, channel: "all", payment_method: "all" })
      .then((sales) => summarizeSales(sales)),
  ]);

  const todayAppointments: TodayAppointment[] = appointments
    .filter((a) => a.status !== "cancelled")
    .map((a) => ({
      id: a.id,
      time: toTimeKey(new Date(a.starts_at)),
      clientName: a.contact.name ?? a.customer.name,
      motorcycle: `${a.motorcycle.brand} ${a.motorcycle.model}`,
      plate: a.motorcycle.plate,
      serviceType: a.service_type,
      status: a.status,
      workOrderId: a.work_order?.id ?? null,
    }));

  return {
    todayAppointments,
    lowStockProducts,
    stockAlerts: { low: stats.lowCount, out: stats.outCount },
    periodLabel: formatMonthKey(today).toLowerCase(),
    previousPeriodLabel: monthLong.format(monthDate(addMonths(today, -1))),
    revenueByMonth,
    salesToday: { count: salesToday.count, revenue: salesToday.revenue },
    servicesThisMonth: [
      { type: "maintenance", count: 46 },
      { type: "inspection", count: 28 },
      { type: "repair", count: 19 },
    ],
    workOrdersByStatus,
  };
}
