"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Camera, LoaderCircle, Search, SquareKanban, Table2, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WORK_ORDER_STATUS_LABEL } from "@/lib/labels";
import type { WorkOrderCounts, WorkOrderSummary } from "@/lib/orders/types";
import { ALL_STATUSES } from "@/lib/orders/workflow";
import { cn } from "@/lib/utils";
import type { WorkOrderFilters } from "@/lib/validations/schemas";
import { OrdersBoard } from "./orders-board";
import { OrdersTable } from "./orders-table";

type OrdersViewProps = {
  orders: WorkOrderSummary[];
  counts: WorkOrderCounts;
  filters: WorkOrderFilters;
};

const SEARCH_DEBOUNCE_MS = 300;

/** Orquesta filtros (en la URL) y la vista tablero/tabla. El alta es la recepción con fotos. */
export function OrdersView({ orders, counts, filters }: OrdersViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.q ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const isBoard = filters.view === "board";
  const hasFilters = Boolean(filters.q || (!isBoard && filters.status !== "all"));

  function updateFilters(next: Partial<WorkOrderFilters>) {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams();
    if (merged.q) params.set("q", merged.q);
    if (merged.view === "table") params.set("view", "table");
    if (merged.view === "table" && merged.status !== "all") params.set("status", merged.status);
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function handleSearch(value: string) {
    setQuery(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => updateFilters({ q: value.trim() || undefined }), SEARCH_DEBOUNCE_MS);
  }

  function clearFilters() {
    clearTimeout(timer.current);
    setQuery("");
    updateFilters({ q: undefined, status: "all" });
  }

  return (
    // minmax(0,1fr): el tablero (ancho mínimo fijo) hace scroll dentro de su
    // contenedor en lugar de ensanchar toda la página.
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 lg:max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar por patente, cliente o folio (OT-0034)…"
            aria-label="Buscar órdenes por patente, cliente o número de folio"
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

        <div className="flex items-center gap-2 lg:ml-auto">
          <div className="inline-flex rounded-lg bg-muted p-0.5" role="radiogroup" aria-label="Tipo de vista">
            {(
              [
                { value: "board", label: "Tablero", icon: SquareKanban },
                { value: "table", label: "Tabla", icon: Table2 },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={filters.view === option.value}
                onClick={() => updateFilters({ view: option.value })}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  filters.view === option.value && "bg-background text-foreground shadow-xs ring-1 ring-foreground/10"
                )}
              >
                <option.icon className="size-4" aria-hidden />
                {option.label}
              </button>
            ))}
          </div>
          <Link href="/dashboard/orders/new" className={buttonVariants({ size: "lg", className: "h-9 min-w-0 flex-1 px-3 sm:flex-none" })}>
            <Camera data-icon="inline-start" />
            Recepcionar moto
          </Link>
        </div>
      </div>

      {!isBoard ? (
        <nav aria-label="Filtrar por estado" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <div className="flex w-max gap-1.5">
            {(["all", ...ALL_STATUSES] as const).map((status) => {
              const active = filters.status === status;
              const count = status === "all" ? total : counts[status];
              return (
                <button
                  key={status}
                  type="button"
                  aria-pressed={active}
                  onClick={() => updateFilters({ status })}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm whitespace-nowrap ring-1 ring-foreground/10 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    active ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground"
                  )}
                >
                  {status === "all" ? "Todas" : WORK_ORDER_STATUS_LABEL[status]}
                  <span className={cn("text-xs tabular-nums", active ? "opacity-70" : "opacity-60")}>{count}</span>
                </button>
              );
            })}
          </div>
        </nav>
      ) : null}

      <div className={cn("transition-opacity", isPending && "opacity-60")} aria-busy={isPending}>
        {isBoard ? (
          orders.length === 0 && filters.q ? (
            <OrdersTable orders={[]} hasFilters onClearFilters={clearFilters} />
          ) : (
            <OrdersBoard orders={orders} />
          )
        ) : (
          <OrdersTable orders={orders} hasFilters={hasFilters} onClearFilters={clearFilters} />
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {orders.length === 1 ? "1 orden" : `${orders.length} órdenes`}
        {isBoard ? " en el tablero (canceladas solo en la vista de tabla)" : ""}
      </p>
    </div>
  );
}
