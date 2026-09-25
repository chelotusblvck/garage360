"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Product } from "@/lib/inventory/types";
import type { ProductFilters } from "@/lib/validations/schemas";
import { InventoryTable } from "./inventory-table";
import { InventoryToolbar } from "./inventory-toolbar";
import { ProductFormSheet } from "./product-form-sheet";
import { StockDialog, type StockDialogSection } from "./stock-dialog";

type InventoryViewProps = {
  products: Product[];
  categories: string[];
  filters: ProductFilters;
};

/** Orquesta filtros (en la URL), tabla y modales del inventario. */
export function InventoryView({ products, categories, filters }: InventoryViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [toolbarKey, setToolbarKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const [stockOpen, setStockOpen] = useState(false);
  const [stockTarget, setStockTarget] = useState<Product | null>(null);
  const [stockSection, setStockSection] = useState<StockDialogSection>("adjust");

  const hasFilters = Boolean(filters.q || filters.category || filters.status !== "all");

  function updateFilters(next: Partial<ProductFilters>) {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams();
    if (merged.q) params.set("q", merged.q);
    if (merged.category) params.set("category", merged.category);
    if (merged.status !== "all") params.set("status", merged.status);
    const query = params.toString();

    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  return (
    <div className="grid gap-4">
      <InventoryToolbar
        // Remonta el buscador cuando los filtros se limpian desde la tabla.
        key={toolbarKey}
        filters={filters}
        categories={categories}
        isPending={isPending}
        onFiltersChange={updateFilters}
        onAdd={() => {
          setEditing(null);
          setFormOpen(true);
        }}
      />

      <InventoryTable
        products={products}
        isPending={isPending}
        hasFilters={hasFilters}
        onClearFilters={() => {
          setToolbarKey((k) => k + 1);
          updateFilters({ q: undefined, category: undefined, status: "all" });
        }}
        onEdit={(product) => {
          setEditing(product);
          setFormOpen(true);
        }}
        onStock={(product, section) => {
          setStockTarget(product);
          setStockSection(section);
          setStockOpen(true);
        }}
      />

      <p className="text-xs text-muted-foreground">
        {products.length === 1 ? "1 producto" : `${products.length} productos`}
        {hasFilters ? " con los filtros aplicados" : ""}
      </p>

      <ProductFormSheet open={formOpen} onOpenChange={setFormOpen} product={editing} categories={categories} />
      <StockDialog open={stockOpen} onOpenChange={setStockOpen} product={stockTarget} section={stockSection} />
    </div>
  );
}
