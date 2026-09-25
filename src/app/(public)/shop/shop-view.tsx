"use client";

import { useMemo, useState } from "react";
import { FilterX, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { Catalog } from "@/lib/sales/catalog";
import { cn } from "@/lib/utils";
import { applyShopFilters, SHOP_SORT_LABEL, shopFiltersToQuery, type ShopFilters, type ShopSort } from "./filters";
import { ProductCard } from "./product-card";

const TOP_SELLERS = 3;

export function ShopView({
  catalog,
  initialFilters,
  maxPerProduct,
}: {
  catalog: Catalog;
  initialFilters: ShopFilters;
  maxPerProduct: number;
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [showFilters, setShowFilters] = useState(false);

  const products = useMemo(() => applyShopFilters([...catalog.products], filters), [catalog.products, filters]);
  const topSellers = useMemo(
    () =>
      new Set(
        [...catalog.products]
          .filter((p) => p.sold > 0)
          .sort((a, b) => b.sold - a.sold)
          .slice(0, TOP_SELLERS)
          .map((p) => p.id)
      ),
    [catalog.products]
  );

  const hasFilters = Boolean(
    filters.q || filters.category || filters.min !== undefined || filters.max !== undefined || filters.stock
  );

  function update(next: Partial<ShopFilters>) {
    const merged = { ...filters, ...next };
    setFilters(merged);
    // URL compartible sin recargar (el filtrado es local e instantáneo).
    const query = shopFiltersToQuery(merged);
    window.history.replaceState(null, "", query ? `/shop?${query}` : "/shop");
  }

  const priceInput = (value: number | undefined, onChange: (v: number | undefined) => void, label: string) => (
    <Input
      type="number"
      inputMode="numeric"
      min={0}
      step={1000}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? undefined : Math.max(0, e.target.valueAsNumber || 0))}
      placeholder={label}
      aria-label={`Precio ${label.toLowerCase()}`}
      className="h-9"
    />
  );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      {/* Filtros */}
      <aside
        aria-label="Filtros"
        className={cn("grid gap-5 lg:sticky lg:top-20", !showFilters && "hidden lg:grid")}
      >
        <div className="grid gap-2">
          <h2 className="text-sm font-medium">Categorías</h2>
          <ul className="grid gap-0.5">
            <li>
              <CategoryButton active={!filters.category} onClick={() => update({ category: undefined })}>
                Todas
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">{catalog.products.length}</span>
              </CategoryButton>
            </li>
            {catalog.categories.map((c) => (
              <li key={c}>
                <CategoryButton active={filters.category === c} onClick={() => update({ category: c })}>
                  {c}
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                    {catalog.products.filter((p) => p.category === c).length}
                  </span>
                </CategoryButton>
              </li>
            ))}
          </ul>
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">Precio (CLP)</legend>
          <div className="grid grid-cols-2 gap-2">
            {priceInput(filters.min, (min) => update({ min }), "Mínimo")}
            {priceInput(filters.max, (max) => update({ max }), "Máximo")}
          </div>
        </fieldset>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.stock}
            onChange={(e) => update({ stock: e.target.checked })}
            className="size-4 accent-foreground"
          />
          Solo productos en stock
        </label>

        {hasFilters ? (
          <Button
            variant="ghost"
            className="justify-start text-muted-foreground"
            onClick={() => update({ q: undefined, category: undefined, min: undefined, max: undefined, stock: false })}
          >
            <FilterX data-icon="inline-start" />
            Limpiar filtros
          </Button>
        ) : null}
      </aside>

      {/* Resultados */}
      <section aria-label="Productos" className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={filters.q ?? ""}
              onChange={(e) => update({ q: e.target.value || undefined })}
              placeholder="Buscar repuestos, marcas o códigos…"
              aria-label="Buscar productos"
              className="h-9 pr-8 pl-8"
            />
            {filters.q ? (
              <button
                type="button"
                onClick={() => update({ q: undefined })}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Limpiar búsqueda"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          <NativeSelect
            aria-label="Ordenar"
            value={filters.sort}
            onChange={(e) => update({ sort: e.target.value as ShopSort })}
            className="min-w-44 [&_select]:h-9"
          >
            {Object.entries(SHOP_SORT_LABEL).map(([value, label]) => (
              <NativeSelectOption key={value} value={value}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button
            variant="outline"
            className="h-9 lg:hidden"
            aria-expanded={showFilters}
            onClick={() => setShowFilters((v) => !v)}
          >
            <SlidersHorizontal data-icon="inline-start" />
            Filtros
          </Button>
        </div>

        <p className="text-xs text-muted-foreground" aria-live="polite">
          {products.length === 1 ? "1 producto" : `${products.length} productos`}
          {filters.category ? ` en ${filters.category}` : ""}
        </p>

        {products.length === 0 ? (
          <div className="grid justify-items-center gap-3 rounded-xl border border-dashed p-10 text-center">
            <p className="text-sm text-muted-foreground">No encontramos productos con esos filtros.</p>
            {hasFilters ? (
              <Button
                variant="outline"
                onClick={() => update({ q: undefined, category: undefined, min: undefined, max: undefined, stock: false })}
              >
                Limpiar filtros
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
            {products.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} topSeller={topSellers.has(p.id)} maxPerProduct={maxPerProduct} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CategoryButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        active ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
