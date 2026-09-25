"use client";

import { useOptimistic, useState } from "react";
import Link from "next/link";
import { EllipsisVertical, HardHat } from "lucide-react";
import { WORK_ORDER_STATUS_STYLE } from "@/components/orders/work-order-status-badge";
import { useStatusChange } from "@/components/orders/use-status-change";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCompactCurrency, formatCurrency, formatRelativeDays, formatPlate } from "@/lib/format";
import { WORK_ORDER_STATUS_LABEL } from "@/lib/labels";
import type { WorkOrderSummary } from "@/lib/orders/types";
import { BOARD_COLUMNS, canTransition, nextStatuses } from "@/lib/orders/workflow";
import { cn } from "@/lib/utils";
import type { WorkOrderStatus } from "@/lib/validations/schemas";

/** Las entregadas se acumulan: el tablero muestra solo las más recientes. */
const DELIVERED_LIMIT = 6;

type Move = { id: string; status: WorkOrderStatus };

export function OrdersBoard({ orders }: { orders: WorkOrderSummary[] }) {
  const { change, confirmDialog } = useStatusChange();
  const [board, moveOptimistic] = useOptimistic(orders, (state: WorkOrderSummary[], move: Move) =>
    state.map((o) => (o.id === move.id ? { ...o, status: move.status } : o))
  );
  const [dragging, setDragging] = useState<WorkOrderSummary | null>(null);
  const [overColumn, setOverColumn] = useState<WorkOrderStatus | null>(null);

  function move(order: WorkOrderSummary, to: WorkOrderStatus) {
    if (!canTransition(order.status, to)) return;
    void change(order, to, () => moveOptimistic({ id: order.id, status: to }));
  }

  return (
    <>
      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6">
        <div className="grid min-w-[72rem] grid-cols-5 gap-3" role="list" aria-label="Tablero de órdenes por estado">
          {BOARD_COLUMNS.map((status) => {
            const all = board.filter((o) => o.status === status);
            const cards =
              status === "delivered"
                ? [...all].sort((a, b) => (b.delivered_at ?? "").localeCompare(a.delivered_at ?? "")).slice(0, DELIVERED_LIMIT)
                : all;
            const total = all.reduce((sum, o) => sum + o.total_amount, 0);
            const style = WORK_ORDER_STATUS_STYLE[status];
            const canDrop = dragging ? canTransition(dragging.status, status) : false;

            return (
              <section
                key={status}
                role="listitem"
                aria-label={`${WORK_ORDER_STATUS_LABEL[status]}: ${all.length} órdenes`}
                onDragOver={(e) => {
                  if (!canDrop) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setOverColumn(status);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverColumn(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setOverColumn(null);
                  if (dragging && canDrop) move(dragging, status);
                  setDragging(null);
                }}
                className={cn(
                  "flex min-h-72 flex-col rounded-xl bg-muted/50 p-2 ring-1 ring-foreground/5 transition-all",
                  dragging && !canDrop && dragging.status !== status && "opacity-45",
                  canDrop && "ring-2 ring-dashed ring-foreground/25",
                  overColumn === status && "bg-muted ring-foreground/50"
                )}
              >
                <header className="flex items-center gap-2 px-1.5 pt-1 pb-2.5">
                  <span className={cn("size-2 rounded-full", style.accentClass)} aria-hidden />
                  <h2 className="text-sm font-medium">{WORK_ORDER_STATUS_LABEL[status]}</h2>
                  <span className="rounded-full bg-background px-1.5 text-xs font-medium tabular-nums ring-1 ring-foreground/10">
                    {all.length}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums" title={formatCurrency(total)}>
                    {total > 0 ? formatCompactCurrency(total) : ""}
                  </span>
                </header>

                <ul className="flex flex-1 flex-col gap-2">
                  {cards.map((order) => (
                    <BoardCard
                      key={order.id}
                      order={order}
                      isDragging={dragging?.id === order.id}
                      onDragStart={() => setDragging(order)}
                      onDragEnd={() => {
                        setDragging(null);
                        setOverColumn(null);
                      }}
                      onMove={(to) => move(order, to)}
                    />
                  ))}
                  {cards.length === 0 ? (
                    <li className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                      {canDrop ? "Soltar aquí" : "Sin órdenes"}
                    </li>
                  ) : null}
                </ul>

                {status === "delivered" && all.length > DELIVERED_LIMIT ? (
                  <Link
                    href="/dashboard/orders?view=table&status=delivered"
                    className="mt-2 rounded-md px-1.5 py-1 text-center text-xs text-muted-foreground hover:bg-background hover:text-foreground"
                  >
                    Ver las {all.length} entregadas
                  </Link>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>
      {confirmDialog}
    </>
  );
}

function BoardCard({
  order,
  isDragging,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  order: WorkOrderSummary;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (to: WorkOrderStatus) => void;
}) {
  const targets = nextStatuses(order.status);

  return (
    <li
      draggable={targets.length > 0}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", order.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "group relative rounded-lg bg-card p-3 text-sm shadow-xs ring-1 ring-foreground/10 transition-shadow hover:ring-foreground/25",
        targets.length > 0 && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      {/* Enlace que cubre toda la tarjeta (el menú queda por encima). */}
      <Link
        href={`/dashboard/orders/${order.id}`}
        className="absolute inset-0 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label={`Abrir ${order.folio}: ${order.motorcycle.brand} ${order.motorcycle.model}, ${order.customer.name}`}
        draggable={false}
      />

      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-medium">{order.folio}</span>
        <span className="text-xs text-muted-foreground">· {formatRelativeDays(new Date(order.created_at))}</span>
        {targets.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="relative z-10 ml-auto -mr-1 opacity-60 group-hover:opacity-100"
                  aria-label={`Mover ${order.folio} a otro estado`}
                />
              }
            >
              <EllipsisVertical />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Mover a…</DropdownMenuLabel>
                {targets.map((to) => {
                  const Icon = WORK_ORDER_STATUS_STYLE[to].icon;
                  return (
                    <DropdownMenuItem key={to} onClick={() => onMove(to)}>
                      <Icon className={WORK_ORDER_STATUS_STYLE[to].iconClass} />
                      {WORK_ORDER_STATUS_LABEL[to]}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <p className="mt-1.5 truncate font-medium">
        {order.motorcycle.brand} {order.motorcycle.model}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <span className="rounded border bg-muted/60 px-1.5 font-mono text-xs tracking-wide">{formatPlate(order.motorcycle.plate)}</span>
        <span className="truncate text-xs text-muted-foreground">{order.customer.name}</span>
      </div>
      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{order.intake_reason}</p>

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t pt-2">
        <span
          className={cn(
            "flex min-w-0 items-center gap-1 text-xs",
            order.mechanic ? "text-muted-foreground" : "text-muted-foreground/70 italic"
          )}
        >
          <HardHat className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{order.mechanic?.name ?? "Sin asignar"}</span>
        </span>
        <span className="shrink-0 font-semibold tabular-nums">{formatCurrency(order.total_amount)}</span>
      </div>
    </li>
  );
}
