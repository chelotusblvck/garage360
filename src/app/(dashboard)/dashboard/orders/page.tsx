import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getWorkOrderCounts, getWorkOrders } from "@/app/actions/orders";
import { PageHeader } from "@/components/dashboard/page-header";
import { workOrderFiltersSchema } from "@/lib/validations/schemas";
import { OrdersView } from "./_components/orders-view";

export const metadata: Metadata = { title: "Órdenes de trabajo" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function OrdersPage({ searchParams }: PageProps<"/dashboard/orders">) {
  const params = await searchParams;
  // Enlaces antiguos (?new=1): el alta ahora es la recepción con fotos.
  if (first(params.new) === "1") {
    const plate = first(params.plate);
    redirect(plate ? `/dashboard/orders/new?plate=${encodeURIComponent(plate)}` : "/dashboard/orders/new");
  }
  const filters = workOrderFiltersSchema.parse({
    q: first(params.q) || undefined,
    status: first(params.status),
    view: first(params.view),
  });
  const isBoard = filters.view === "board";

  const [orders, counts] = await Promise.all([
    // El tablero muestra todos los estados salvo "cancelada".
    getWorkOrders(isBoard ? { ...filters, status: "all" } : filters),
    getWorkOrderCounts(),
  ]);
  const visible = isBoard ? orders.filter((o) => o.status !== "cancelled") : orders;

  const inShop = counts.open + counts.in_progress + counts.waiting_parts + counts.completed;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <PageHeader
        title="Órdenes de trabajo"
        description={`${inShop} motos en el taller · ${counts.waiting_parts} esperando repuestos · ${counts.completed} listas para entregar`}
      />
      <OrdersView
        orders={visible}
        counts={counts}
        filters={filters}
      />
    </div>
  );
}
