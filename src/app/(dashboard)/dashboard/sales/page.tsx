import type { Metadata } from "next";
import Link from "next/link";
import { ScanBarcode } from "lucide-react";
import { getSalesHistory } from "@/app/actions/pos";
import { PageHeader } from "@/components/dashboard/page-header";
import { LiveRefresh } from "@/components/live-refresh";
import { buttonVariants } from "@/components/ui/button";
import { addDays, todayKey } from "@/lib/datetime";
import { salesHistoryFiltersSchema } from "@/lib/validations/schemas";
import { SalesSummaryTiles } from "./_components/sales-summary";
import { SalesView } from "./_components/sales-view";

export const metadata: Metadata = { title: "Ventas" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Por defecto: últimos 30 días. */
const DEFAULT_RANGE_DAYS = 30;

export default async function SalesPage({ searchParams }: PageProps<"/dashboard/sales">) {
  const params = await searchParams;
  const today = todayKey();
  const filters = salesHistoryFiltersSchema.parse({
    from: first(params.from) || addDays(today, -(DEFAULT_RANGE_DAYS - 1)),
    to: first(params.to) || today,
    channel: first(params.channel),
    payment_method: first(params.payment_method),
    q: first(params.q) || undefined,
  });

  const history = await getSalesHistory(filters);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Ventas"
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3">
            Mostrador (POS) y tienda online
            <LiveRefresh />
          </span>
        }
        actions={
          <Link href="/dashboard/pos" className={buttonVariants()}>
            <ScanBarcode data-icon="inline-start" />
            Nueva venta
          </Link>
        }
      />
      <SalesSummaryTiles summary={history.summary} />
      <SalesView sales={history.sales} filters={filters} />
    </div>
  );
}
