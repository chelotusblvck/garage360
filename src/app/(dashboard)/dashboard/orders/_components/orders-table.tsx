"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, ClipboardList, HardHat } from "lucide-react";
import { WorkOrderStatusBadge } from "@/components/orders/work-order-status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate, formatRelativeDays, formatPlate } from "@/lib/format";
import type { WorkOrderSummary } from "@/lib/orders/types";
import { cn } from "@/lib/utils";

export function OrdersTable({
  orders,
  hasFilters,
  onClearFilters,
}: {
  orders: WorkOrderSummary[];
  hasFilters: boolean;
  onClearFilters: () => void;
}) {
  const router = useRouter();
  const shell = "overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10";

  if (orders.length === 0) {
    return (
      <div className={cn(shell, "flex flex-col items-center gap-3 px-4 py-16 text-center")}>
        <span className="flex size-11 items-center justify-center rounded-xl bg-muted">
          <ClipboardList className="size-5 text-muted-foreground" aria-hidden />
        </span>
        <div className="grid gap-1">
          <p className="font-medium">{hasFilters ? "No hay órdenes que coincidan" : "Todavía no hay órdenes"}</p>
          <p className="text-sm text-muted-foreground">
            {hasFilters ? "Prueba con otro folio, patente o cliente." : "Registra el primer ingreso al taller."}
          </p>
        </div>
        {hasFilters ? (
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            Quitar filtros
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className={cn(shell, "hidden md:block")}>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="pl-4">Folio</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Moto</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden lg:table-cell">Mecánico</TableHead>
              <TableHead className="hidden xl:table-cell">Ingreso</TableHead>
              <TableHead className="pr-4 text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => (
              <TableRow
                key={o.id}
                className="cursor-pointer"
                onClick={() => router.push(`/dashboard/orders/${o.id}`)}
              >
                <TableCell className="pl-4">
                  <Link
                    href={`/dashboard/orders/${o.id}`}
                    className="font-mono text-sm font-medium hover:underline hover:underline-offset-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {o.folio}
                  </Link>
                </TableCell>
                <TableCell>
                  <WorkOrderStatusBadge status={o.status} />
                </TableCell>
                <TableCell className="max-w-56">
                  <p className="truncate font-medium">
                    {o.motorcycle.brand} {o.motorcycle.model}
                  </p>
                  <span className="rounded border bg-muted/60 px-1.5 font-mono text-xs tracking-wide">
                    {formatPlate(o.motorcycle.plate)}
                  </span>
                </TableCell>
                <TableCell className="max-w-48">
                  <p className="truncate">{o.customer.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{o.customer.phone ?? "Sin teléfono"}</p>
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {o.mechanic?.name ?? <span className="italic opacity-70">Sin asignar</span>}
                </TableCell>
                <TableCell className="hidden text-muted-foreground xl:table-cell">
                  <span title={formatDate(new Date(o.created_at))}>{formatRelativeDays(new Date(o.created_at))}</span>
                </TableCell>
                <TableCell className="pr-4 text-right font-semibold tabular-nums">
                  {formatCurrency(o.total_amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className={cn(shell, "divide-y md:hidden")}>
        {orders.map((o) => (
          <li key={o.id}>
            <Link href={`/dashboard/orders/${o.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 p-3">
              <span className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium">{o.folio}</span>
                <WorkOrderStatusBadge status={o.status} />
              </span>
              <span className="row-span-2 flex items-center gap-1 self-center font-semibold tabular-nums">
                {formatCurrency(o.total_amount)}
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </span>
              <span className="truncate text-sm">
                {o.motorcycle.brand} {o.motorcycle.model} ·{" "}
                <span className="font-mono text-xs">{formatPlate(o.motorcycle.plate)}</span>
              </span>
              <span className="col-span-2 flex items-center gap-2 truncate text-xs text-muted-foreground">
                {o.customer.name}
                <span aria-hidden>·</span>
                <HardHat className="size-3 shrink-0" aria-hidden />
                {o.mechanic?.name ?? "Sin asignar"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
