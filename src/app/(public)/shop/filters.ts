import { z } from "zod";
import type { CatalogProduct } from "@/lib/sales/catalog";
import { normalizeText } from "@/lib/utils";

export const SHOP_SORT_LABEL = {
  popular: "Más vendidos",
  price_asc: "Menor precio",
  price_desc: "Mayor precio",
  name: "Nombre (A–Z)",
} as const;

export type ShopSort = keyof typeof SHOP_SORT_LABEL;

const price = z.coerce.number().int().nonnegative().max(100_000_000).optional().catch(undefined);

/** Filtros de la tienda (vienen de la URL; valores inválidos se ignoran). */
export const shopFiltersSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  category: z.string().trim().max(60).optional().catch(undefined),
  min: price,
  max: price,
  sort: z.enum(Object.keys(SHOP_SORT_LABEL) as [ShopSort, ...ShopSort[]]).catch("popular").default("popular"),
  /** "1" = solo productos con stock. */
  stock: z
    .string()
    .optional()
    .transform((v) => v === "1"),
});

export type ShopFilters = z.output<typeof shopFiltersSchema>;

export function applyShopFilters(products: CatalogProduct[], f: ShopFilters): CatalogProduct[] {
  const term = f.q ? normalizeText(f.q) : "";
  const filtered = products.filter(
    (p) =>
      (!term || normalizeText(`${p.name} ${p.sku} ${p.category} ${p.description ?? ""}`).includes(term)) &&
      (!f.category || p.category === f.category) &&
      (f.min === undefined || p.price >= f.min) &&
      (f.max === undefined || p.price <= f.max) &&
      (!f.stock || p.stock > 0)
  );

  const byName = (a: CatalogProduct, b: CatalogProduct) => a.name.localeCompare(b.name, "es");
  const sorters: Record<ShopSort, (a: CatalogProduct, b: CatalogProduct) => number> = {
    popular: (a, b) => b.sold - a.sold || byName(a, b),
    price_asc: (a, b) => a.price - b.price || byName(a, b),
    price_desc: (a, b) => b.price - a.price || byName(a, b),
    name: byName,
  };
  // Los agotados van al final en cualquier orden.
  return filtered.sort((a, b) => Number(a.stock <= 0) - Number(b.stock <= 0) || sorters[f.sort](a, b));
}

export function shopFiltersToQuery(f: ShopFilters): string {
  const params = new URLSearchParams();
  if (f.q) params.set("q", f.q);
  if (f.category) params.set("category", f.category);
  if (f.min !== undefined) params.set("min", String(f.min));
  if (f.max !== undefined) params.set("max", String(f.max));
  if (f.sort !== "popular") params.set("sort", f.sort);
  if (f.stock) params.set("stock", "1");
  return params.toString();
}
