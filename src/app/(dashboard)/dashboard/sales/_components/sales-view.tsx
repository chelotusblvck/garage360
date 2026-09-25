"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Globe, LoaderCircle, Search, Store, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, SALES_CHANNEL_LABEL } from "@/lib/sales/shared";
import type { Sale } from "@/lib/sales/types";
import { cn } from "@/lib/utils";
import { paymentMethodSchema, type SalesHistoryFilters } from "@/lib/validations/schemas";
import { SaleDetailSheet } from "./sale-detail-sheet";

const SEARCH_DEBOUNCE_MS = 300;

export function SalesView({ sales, filters }: { sales: Sale[]; filters: SalesHistoryFilters }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.q ?? "");
  const [selected, setSelected] = useState<Sale | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function update(next: Partial<SalesHistoryFilters>) {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams();
    if (merged.from) params.set("from", merged.from);
    if (merged.to) params.set("to", merged.to);
    if (merged.channel !== "all") params.set("channel", merged.channel);
    if (merged.payment_method !== "all") params.set("payment_method", merged.payment_method);
    if (merged.q) params.set("q", merged.q);
    startTransition(() => router.replace(`${pathname}?${params}`, { scroll: false }));
  }

  function search(value: string) {
    setQuery(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => update({ q: value.trim() || undefined }), SEARCH_DEBOUNCE_MS);
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="relative flex-1 xl:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => search(e.target.value)}
            placeholder="Folio (V-000123) o cliente…"
            aria-label="Buscar por folio o cliente"
            className="h-9 pr-8 pl-8"
          />
          {isPending ? (
            <LoaderCircle className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Cargando" />
          ) : query ? (
            <button
              type="button"
              onClick={() => search("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Limpiar búsqueda"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Desde
            <Input
              type="date"
              value={filters.from ?? ""}
              max={filters.to}
              onChange={(e) => e.target.value && update({ from: e.target.value })}
              className="h-9 w-auto"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Hasta
            <Input
              type="date"
              value={filters.to ?? ""}
              min={filters.from}
              onChange={(e) => e.target.value && update({ to: e.target.value })}
              className="h-9 w-auto"
            />
          </label>
          <NativeSelect
            aria-label="Filtrar por canal"
            value={filters.channel}
            onChange={(e) => update({ channel: e.target.value as SalesHistoryFilters["channel"] })}
            className="min-w-40 [&_select]:h-9"
          >
            <NativeSelectOption value="all">Todos los canales</NativeSelectOption>
            <NativeSelectOption value="pos">{SALES_CHANNEL_LABEL.pos}</NativeSelectOption>
            <NativeSelectOption value="online">{SALES_CHANNEL_LABEL.online}</NativeSelectOption>
          </NativeSelect>
          <NativeSelect
            aria-label="Filtrar por método de pago"
            value={filters.payment_method}
            onChange={(e) => update({ payment_method: e.target.value as SalesHistoryFilters["payment_method"] })}
            className="min-w-48 [&_select]:h-9"
          >
            <NativeSelectOption value="all">Todos los medios de pago</NativeSelectOption>
            {paymentMethodSchema.options
              .filter((m) => m !== "card")
              .map((m) => (
                <NativeSelectOption key={m} value={m}>
                  {PAYMENT_METHOD_LABEL[m]}
                </NativeSelectOption>
              ))}
          </NativeSelect>
        </div>
      </div>

      <div className={cn("overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 transition-opacity", isPending && "opacity-60")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Folio</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Pago</TableHead>
              <TableHead className="text-right">Unid.</TableHead>
              <TableHead className="pr-4 text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No hay ventas con los filtros aplicados.
                </TableCell>
              </TableRow>
            ) : (
              sales.map((sale) => {
                const ChannelIcon = sale.channel === "pos" ? Store : Globe;
                return (
                  <TableRow
                    key={sale.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelected(sale);
                      setDetailOpen(true);
                    }}
                  >
                    <TableCell className="pl-4">
                      <button
                        type="button"
                        className="font-mono text-xs font-semibold underline-offset-2 outline-none hover:underline focus-visible:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(sale);
                          setDetailOpen(true);
                        }}
                      >
                        {sale.folio}
                      </button>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                      {formatDateTime(new Date(sale.paid_at ?? sale.created_at))}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <ChannelIcon className="size-3.5 text-muted-foreground" aria-hidden />
                        {SALES_CHANNEL_LABEL[sale.channel]}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-48 truncate">
                      {sale.customer.name ?? <span className="text-muted-foreground">Consumidor final</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {sale.payment_method ? PAYMENT_METHOD_LABEL[sale.payment_method] : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{sale.units}</TableCell>
                    <TableCell className="pr-4 text-right font-medium tabular-nums">
                      {sale.status === "paid" ? (
                        formatCurrency(sale.total)
                      ) : (
                        <span className="text-muted-foreground line-through">{formatCurrency(sale.total)}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        {sales.length === 1 ? "1 venta" : `${sales.length} ventas`} en el período
        {sales.length >= 500 ? " (se muestran las 500 más recientes)" : ""}
      </p>

      <SaleDetailSheet sale={selected} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}
