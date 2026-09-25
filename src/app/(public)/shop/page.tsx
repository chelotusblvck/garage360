import type { Metadata } from "next";
import { connection } from "next/server";
import { getShopCatalog } from "@/app/actions/ecommerce";
import { SHOP } from "@/lib/business";
import { shopFiltersSchema } from "./filters";
import { ShopView } from "./shop-view";

export const metadata: Metadata = {
  title: "Tienda de repuestos",
  description: "Repuestos, lubricantes y accesorios para tu moto con stock en tiempo real.",
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
  // Stock y precios al momento de la visita.
  await connection();
  const [catalog, params] = await Promise.all([getShopCatalog(), searchParams]);
  const filters = shopFiltersSchema.parse({
    q: first(params.q),
    category: first(params.category),
    min: first(params.min),
    max: first(params.max),
    sort: first(params.sort),
    stock: first(params.stock),
  });

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 md:py-10">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Tienda de repuestos</h1>
        <p className="text-sm text-muted-foreground">
          Stock actualizado desde el taller · Retiro sin cargo en {SHOP.pickupAddress}
        </p>
      </div>
      <ShopView catalog={catalog} initialFilters={filters} maxPerProduct={SHOP.maxUnitsPerProduct} />
    </div>
  );
}
