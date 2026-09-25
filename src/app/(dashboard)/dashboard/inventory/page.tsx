import type { Metadata } from "next";
import {
  getInventoryStats,
  getProductCategories,
  getProducts,
} from "@/app/actions/inventory";
import { PageHeader } from "@/components/dashboard/page-header";
import { LiveRefresh } from "@/components/live-refresh";
import { productFiltersSchema } from "@/lib/validations/schemas";
import { InventoryStats } from "./_components/inventory-stats";
import { InventoryView } from "./_components/inventory-view";

export const metadata: Metadata = { title: "Inventario" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function InventoryPage({ searchParams }: PageProps<"/dashboard/inventory">) {
  const params = await searchParams;
  const filters = productFiltersSchema.parse({
    q: first(params.q) || undefined,
    category: first(params.category) || undefined,
    status: first(params.status),
  });

  const [products, stats, categories] = await Promise.all([
    getProducts(filters),
    getInventoryStats(),
    getProductCategories(),
  ]);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Inventario"
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3">
            Repuestos y accesorios: stock, precios y alertas de reposición
            <LiveRefresh />
          </span>
        }
      />
      <InventoryStats stats={stats} activeStatus={filters.status} />
      <InventoryView products={products} categories={categories} filters={filters} />
    </div>
  );
}
