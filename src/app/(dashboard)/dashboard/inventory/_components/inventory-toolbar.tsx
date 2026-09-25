"use client";

import { useRef, useState } from "react";
import { FilterX, LoaderCircle, PackagePlus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { STOCK_FILTER_LABEL } from "@/lib/inventory/constants";
import type { ProductFilters } from "@/lib/validations/schemas";

type ToolbarProps = {
  filters: ProductFilters;
  categories: string[];
  isPending: boolean;
  onFiltersChange: (next: Partial<ProductFilters>) => void;
  onAdd: () => void;
};

const SEARCH_DEBOUNCE_MS = 300;

export function InventoryToolbar({ filters, categories, isPending, onFiltersChange, onAdd }: ToolbarProps) {
  const [query, setQuery] = useState(filters.q ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const hasFilters = Boolean(filters.q || filters.category || filters.status !== "all");

  function handleSearch(value: string) {
    setQuery(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () => onFiltersChange({ q: value.trim() || undefined }),
      SEARCH_DEBOUNCE_MS
    );
  }

  function clearAll() {
    clearTimeout(timer.current);
    setQuery("");
    onFiltersChange({ q: undefined, category: undefined, status: "all" });
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative flex-1 lg:max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar por nombre o SKU…"
          aria-label="Buscar productos por nombre o SKU"
          className="h-9 pr-8 pl-8"
        />
        {isPending ? (
          <LoaderCircle className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Buscando" />
        ) : query ? (
          <button
            type="button"
            onClick={() => handleSearch("")}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Limpiar búsqueda"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          aria-label="Filtrar por categoría"
          value={filters.category ?? ""}
          onChange={(e) => onFiltersChange({ category: e.target.value || undefined })}
          className="min-w-44 [&_select]:h-9"
        >
          <NativeSelectOption value="">Todas las categorías</NativeSelectOption>
          {categories.map((c) => (
            <NativeSelectOption key={c} value={c}>
              {c}
            </NativeSelectOption>
          ))}
        </NativeSelect>

        <NativeSelect
          aria-label="Filtrar por estado de stock"
          value={filters.status}
          onChange={(e) => onFiltersChange({ status: e.target.value as ProductFilters["status"] })}
          className="min-w-40 [&_select]:h-9"
        >
          {Object.entries(STOCK_FILTER_LABEL).map(([value, label]) => (
            <NativeSelectOption key={value} value={value}>
              {label}
            </NativeSelectOption>
          ))}
        </NativeSelect>

        {hasFilters ? (
          <Button variant="ghost" onClick={clearAll} className="h-9 text-muted-foreground">
            <FilterX data-icon="inline-start" />
            Limpiar
          </Button>
        ) : null}
      </div>

      <Button size="lg" onClick={onAdd} className="h-9 px-3 lg:ml-auto">
        <PackagePlus data-icon="inline-start" />
        Añadir producto
      </Button>
    </div>
  );
}
