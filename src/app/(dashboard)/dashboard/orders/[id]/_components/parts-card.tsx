"use client";

import { useRef, useState, useTransition } from "react";
import { LoaderCircle, PackagePlus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { addOrderItem, removeOrderItem, searchProductsForOrder } from "@/app/actions/orders";
import { useConfirm } from "@/components/confirm-dialog";
import { ProductThumb } from "@/components/inventory/product-thumb";
import { StockStatusBadge } from "@/components/inventory/stock-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import type { Product } from "@/lib/inventory/types";
import type { WorkOrderPart } from "@/lib/orders/types";
import { cn } from "@/lib/utils";

type PartsCardProps = {
  orderId: string;
  parts: WorkOrderPart[];
  subtotal: number;
  editable: boolean;
};

export function PartsCard({ orderId, parts, subtotal, editable }: PartsCardProps) {
  const [confirm, confirmDialog] = useConfirm();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function remove(part: WorkOrderPart) {
    const ok = await confirm({
      title: `¿Quitar ${part.product_name}?`,
      description: `Se devolverán ${part.quantity} u. al inventario y quedará registrado en el historial de movimientos.`,
      confirmLabel: "Quitar y devolver al stock",
      destructive: true,
    });
    if (!ok) return;
    setRemovingId(part.id);
    startTransition(async () => {
      const result = await removeOrderItem(orderId, part.id);
      setRemovingId(null);
      if (!result.ok) toast.error(result.error);
      else toast.success(`${part.quantity} u. de ${part.product_name} devueltas al stock`);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Repuestos asignados</CardTitle>
        <CardDescription>Se descuentan del inventario al asignarlos (insumo de taller).</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {editable ? <PartPicker orderId={orderId} /> : null}

        {parts.length === 0 ? (
          <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            Sin repuestos asignados.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="pl-3">Repuesto</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">P. unitario</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  {editable ? <TableHead className="w-10 pr-3"><span className="sr-only">Acciones</span></TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {parts.map((part) => (
                  <TableRow key={part.id} className={cn(removingId === part.id && "opacity-50")}>
                    <TableCell className="max-w-64 pl-3">
                      <p className="truncate font-medium">{part.product_name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{part.sku}</p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{part.quantity}</TableCell>
                    <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">
                      {formatCurrency(part.unit_price)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatCurrency(part.line_total)}</TableCell>
                    {editable ? (
                      <TableCell className="pr-3">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => remove(part)}
                          disabled={removingId !== null}
                          aria-label={`Quitar ${part.product_name} y devolver al stock`}
                        >
                          {removingId === part.id ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={2} className="pl-3 text-muted-foreground sm:hidden">Subtotal repuestos</TableCell>
                  <TableCell colSpan={3} className="hidden pl-3 text-muted-foreground sm:table-cell">Subtotal repuestos</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(subtotal)}</TableCell>
                  {editable ? <TableCell /> : null}
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </CardContent>
      {confirmDialog}
    </Card>
  );
}

/** Buscador rápido de repuestos del inventario + alta en la OT. */
function PartPicker({ orderId }: { orderId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [isAdding, startAdding] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  const requestId = useRef(0);

  async function runSearch(value: string) {
    const id = ++requestId.current;
    setSearching(true);
    const found = await searchProductsForOrder(value);
    if (id !== requestId.current) return; // llegó una búsqueda más nueva
    setResults(found);
    setSearching(false);
  }

  function onSearch(value: string) {
    setQuery(value);
    clearTimeout(timer.current);
    if (!value.trim()) {
      setResults(null);
      setSearching(false);
      return;
    }
    // Marca los resultados como desactualizados de inmediato: no se puede
    // elegir un repuesto de la búsqueda anterior mientras llega la nueva.
    setSearching(true);
    timer.current = setTimeout(() => runSearch(value), 250);
  }

  function pick(product: Product) {
    setSelected(product);
    setQuantity("1");
    setUnitPrice(String(product.price));
  }

  const qty = Number(quantity);
  const price = unitPrice === "" ? null : Number(unitPrice);
  const qtyError =
    !Number.isInteger(qty) || qty < 1
      ? "Cantidad inválida"
      : selected && qty > selected.stock
        ? `Solo hay ${selected.stock} u. en stock`
        : null;
  const priceError = price !== null && (Number.isNaN(price) || price < 0) ? "Precio inválido" : null;

  function add() {
    if (!selected || qtyError || priceError) return;
    startAdding(async () => {
      const result = await addOrderItem(orderId, selected.id, qty, price);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${qty} u. de ${selected.name} asignadas · stock actualizado`);
      setSelected(null);
      // Refresca el stock mostrado en los resultados.
      if (query.trim()) void runSearch(query);
      inputRef.current?.focus();
    });
  }

  if (selected) {
    return (
      <div className="grid gap-3 rounded-lg bg-muted/50 p-3 ring-1 ring-foreground/10">
        <div className="flex items-center gap-3">
          <ProductThumb src={selected.image_url} alt={selected.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{selected.name}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {selected.sku} · stock {selected.stock} u.
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={() => setSelected(null)} aria-label="Cancelar selección">
            <X />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[6rem_10rem_1fr] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="part-qty">Cantidad</Label>
            <Input
              id="part-qty"
              type="number"
              inputMode="numeric"
              min={1}
              max={selected.stock}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              aria-invalid={qtyError ? true : undefined}
              autoFocus
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="part-price">Precio unitario</Label>
            <Input
              id="part-price"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              aria-invalid={priceError ? true : undefined}
            />
          </div>
          <Button onClick={add} disabled={Boolean(qtyError || priceError) || isAdding} className="col-span-2 h-9 sm:col-span-1">
            {isAdding ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <PackagePlus data-icon="inline-start" />}
            Asignar {Number.isInteger(qty) && qty > 0 && price !== null ? `· ${formatCurrency(qty * price)}` : ""}
          </Button>
        </div>
        {qtyError || priceError ? (
          <p role="alert" className="text-xs text-destructive">
            {qtyError ?? priceError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Buscar repuesto por nombre o SKU para agregar…"
        aria-label="Buscar repuesto del inventario"
        className="h-9 pl-8"
        autoComplete="off"
      />
      {searching ? (
        <LoaderCircle className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Buscando" />
      ) : null}

      {results ? (
        <ul
          className={cn(
            "mt-2 max-h-72 overflow-y-auto rounded-lg bg-popover ring-1 ring-foreground/10 transition-opacity",
            searching && "pointer-events-none opacity-50"
          )}
          aria-label="Repuestos encontrados"
          aria-busy={searching}
        >
          {results.length === 0 ? (
            <li className="p-3 text-sm text-muted-foreground">No se encontraron repuestos.</li>
          ) : (
            results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => pick(p)}
                  disabled={p.stock === 0 || searching}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ProductThumb src={p.image_url} alt="" className="size-8" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    <span className="block font-mono text-xs text-muted-foreground">
                      {p.sku} · {p.stock} u.
                    </span>
                  </span>
                  <span className="hidden sm:inline">
                    <StockStatusBadge status={p.stock_status} />
                  </span>
                  <span className="text-sm font-medium tabular-nums">{formatCurrency(p.price)}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
