"use client";

import { useOptimistic, useTransition } from "react";
import { ArrowUpDown, EyeOff, History, Minus, PackageSearch, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { adjustStock } from "@/app/actions/inventory";
import { ProductThumb } from "@/components/inventory/product-thumb";
import { StockStatusBadge } from "@/components/inventory/stock-status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/format";
import { getStockStatus } from "@/lib/inventory/constants";
import type { Product } from "@/lib/inventory/types";
import { cn } from "@/lib/utils";

type StockSection = "adjust" | "history";

type InventoryTableProps = {
  products: Product[];
  isPending: boolean;
  hasFilters: boolean;
  onEdit: (product: Product) => void;
  onStock: (product: Product, section: StockSection) => void;
  onClearFilters: () => void;
};

type OptimisticDelta = { id: string; delta: number };

export function InventoryTable({
  products,
  isPending,
  hasFilters,
  onEdit,
  onStock,
  onClearFilters,
}: InventoryTableProps) {
  const [, startTransition] = useTransition();
  const [rows, applyDelta] = useOptimistic(products, (state: Product[], { id, delta }: OptimisticDelta) =>
    state.map((p) =>
      p.id === id
        ? { ...p, stock: p.stock + delta, stock_status: getStockStatus(p.stock + delta, p.min_stock) }
        : p
    )
  );

  /** Ajuste rápido ±1 con actualización optimista. */
  function quickAdjust(product: Product, delta: 1 | -1) {
    startTransition(async () => {
      applyDelta({ id: product.id, delta });
      const result = await adjustStock(
        product.id,
        1,
        delta > 0 ? "in" : "out",
        "adjustment",
        delta > 0 ? "Ajuste rápido (+1)" : "Ajuste rápido (−1)"
      );
      if (!result.ok) toast.error(result.error);
    });
  }

  const shell = cn(
    "overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 transition-opacity",
    isPending && "opacity-60"
  );

  if (rows.length === 0) {
    return (
      <div className={shell}>
        <EmptyState hasFilters={hasFilters} onClearFilters={onClearFilters} />
      </div>
    );
  }

  return (
    <>
      {/* Escritorio / tablet */}
      <div className={cn(shell, "hidden md:block")} aria-busy={isPending}>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-14 pl-4">
                <span className="sr-only">Imagen</span>
              </TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="hidden xl:table-cell">Categoría</TableHead>
              <TableHead className="text-right">Precio venta</TableHead>
              <TableHead className="text-center">Stock actual</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Stock mín.</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="pr-4 text-right">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="pl-4">
                  <ProductThumb src={p.image_url} alt={p.name} />
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{p.sku}</TableCell>
                <TableCell className="max-w-72 min-w-44">
                  <ProductName product={p} onEdit={onEdit} />
                  <span className="text-xs text-muted-foreground xl:hidden">{p.category}</span>
                </TableCell>
                <TableCell className="hidden text-muted-foreground xl:table-cell">{p.category}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatCurrency(p.price)}</TableCell>
                <TableCell>
                  <StockStepper product={p} onAdjust={quickAdjust} className="justify-center" />
                </TableCell>
                <TableCell className="hidden text-right text-muted-foreground tabular-nums lg:table-cell">
                  {p.min_stock}
                </TableCell>
                <TableCell>
                  <StockStatusBadge status={p.stock_status} />
                </TableCell>
                <TableCell className="pr-4">
                  <RowActions product={p} onEdit={onEdit} onStock={onStock} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Móvil: tarjetas */}
      <ul className={cn(shell, "divide-y md:hidden")} aria-busy={isPending}>
        {rows.map((p) => (
          <li key={p.id} className="grid grid-cols-[minmax(0,1fr)] gap-3 p-3">
            <div className="flex items-start gap-3">
              <ProductThumb src={p.image_url} alt={p.name} />
              <div className="min-w-0 flex-1">
                <ProductName product={p} onEdit={onEdit} />
                <p className="truncate text-xs text-muted-foreground">
                  <span className="font-mono">{p.sku}</span> · {p.category}
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(p.price)}</p>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <StockStepper product={p} onAdjust={quickAdjust} />
                <span className="text-xs text-muted-foreground">mín. {p.min_stock}</span>
              </div>
              <StockStatusBadge status={p.stock_status} />
            </div>
            <RowActions product={p} onEdit={onEdit} onStock={onStock} labelled />
          </li>
        ))}
      </ul>
    </>
  );
}

function ProductName({ product, onEdit }: { product: Product; onEdit: (p: Product) => void }) {
  return (
    <>
      <button
        type="button"
        onClick={() => onEdit(product)}
        className="block max-w-full truncate text-left font-medium hover:underline hover:underline-offset-4"
        title={product.name}
      >
        {product.name}
      </button>
      {!product.is_active ? (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <EyeOff className="size-3" aria-hidden /> Oculto en tienda
        </span>
      ) : null}
    </>
  );
}

function StockStepper({
  product,
  onAdjust,
  className,
}: {
  product: Product;
  onAdjust: (product: Product, delta: 1 | -1) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        variant="outline"
        size="icon-xs"
        onClick={() => onAdjust(product, -1)}
        disabled={product.stock === 0}
        aria-label={`Restar 1 unidad a ${product.name}`}
      >
        <Minus />
      </Button>
      <span className="w-9 text-center text-sm font-semibold tabular-nums" aria-live="polite">
        {product.stock}
      </span>
      <Button
        variant="outline"
        size="icon-xs"
        onClick={() => onAdjust(product, 1)}
        aria-label={`Sumar 1 unidad a ${product.name}`}
      >
        <Plus />
      </Button>
    </div>
  );
}

const ACTIONS = [
  { key: "edit", label: "Editar producto", short: "Editar", icon: Pencil },
  { key: "adjust", label: "Ajustar stock", short: "Ajustar", icon: ArrowUpDown },
  { key: "history", label: "Ver historial de movimientos", short: "Historial", icon: History },
] as const;

function RowActions({
  product,
  onEdit,
  onStock,
  labelled = false,
}: {
  product: Product;
  onEdit: (product: Product) => void;
  onStock: (product: Product, section: StockSection) => void;
  /** Botones con texto (móvil) en lugar de iconos con tooltip. */
  labelled?: boolean;
}) {
  const run = (key: (typeof ACTIONS)[number]["key"]) =>
    key === "edit" ? onEdit(product) : onStock(product, key);

  if (labelled) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {ACTIONS.map((a) => (
          <Button key={a.key} variant="outline" size="sm" onClick={() => run(a.key)} aria-label={a.label}>
            <a.icon data-icon="inline-start" />
            {a.short}
          </Button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex justify-end gap-0.5">
      {ACTIONS.map((a) => (
        <Tooltip key={a.key}>
          <TooltipTrigger
            render={<Button variant="ghost" size="icon-sm" onClick={() => run(a.key)} aria-label={a.label} />}
          >
            <a.icon />
          </TooltipTrigger>
          <TooltipContent>{a.label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

function EmptyState({ hasFilters, onClearFilters }: { hasFilters: boolean; onClearFilters: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl bg-muted">
        <PackageSearch className="size-5 text-muted-foreground" aria-hidden />
      </span>
      <div className="grid gap-1">
        <p className="font-medium">
          {hasFilters ? "No hay productos que coincidan" : "Todavía no hay productos"}
        </p>
        <p className="text-sm text-muted-foreground">
          {hasFilters
            ? "Prueba con otra búsqueda o quita los filtros."
            : "Crea el primer repuesto con «Añadir producto»."}
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
