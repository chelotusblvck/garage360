import "server-only";
import { getInventoryRepository } from "@/lib/inventory/repository";
import type { Product } from "@/lib/inventory/types";
import { getSalesRepository } from "./repository";

/** Producto vendible, sin datos internos (costo, mínimos, auditoría). */
export type CatalogProduct = Pick<
  Product,
  "id" | "name" | "sku" | "description" | "category" | "price" | "stock" | "stock_status" | "image_url"
> & {
  /** Unidades vendidas en los últimos 90 días (POS + online). */
  sold: number;
};

export type Catalog = { products: CatalogProduct[]; categories: string[] };

/** Catálogo activo con popularidad, ordenado por nombre. */
export async function loadCatalog(): Promise<Catalog> {
  const [products, popularity] = await Promise.all([
    getInventoryRepository().list({ status: "all" }),
    getSalesRepository().popularity(90),
  ]);

  const active = products
    .filter((p) => p.is_active)
    .map<CatalogProduct>((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      description: p.description,
      category: p.category,
      price: p.price,
      stock: p.stock,
      stock_status: p.stock_status,
      image_url: p.image_url,
      sold: popularity[p.id] ?? 0,
    }));

  return {
    products: active,
    categories: [...new Set(active.map((p) => p.category))].sort((a, b) => a.localeCompare(b, "es")),
  };
}
