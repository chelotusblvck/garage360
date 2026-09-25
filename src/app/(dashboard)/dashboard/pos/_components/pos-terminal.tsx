"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  ArrowRightLeft,
  Banknote,
  CreditCard,
  Flame,
  ScanBarcode,
  ShoppingCart,
  Trash,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { ProductThumb } from "@/components/inventory/product-thumb";
import { QuantityStepper } from "@/components/quantity-stepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import type { Customer } from "@/lib/orders/types";
import type { CatalogProduct, Catalog } from "@/lib/sales/catalog";
import { computeTotals } from "@/lib/sales/shared";
import { cn, normalizeText } from "@/lib/utils";
import type { PosPaymentMethod } from "@/lib/validations/schemas";
import { CustomerPicker } from "./customer-picker";
import { PosCheckoutDialog } from "./pos-checkout-dialog";

export type PosLine = { product: CatalogProduct; quantity: number };
export type PosTax = { label: string; rate: number; applyByDefault: boolean };

export const POS_METHODS: { value: PosPaymentMethod; label: string; icon: LucideIcon }[] = [
  { value: "cash", label: "Efectivo", icon: Banknote },
  { value: "debit_card", label: "Débito", icon: CreditCard },
  { value: "credit_card", label: "Crédito", icon: CreditCard },
  { value: "transfer", label: "Transferencia", icon: ArrowRightLeft },
];

const MAX_RESULTS = 60;
/** "3*BRK-PAD-F01" agrega 3 unidades (como en las cajas registradoras). */
const QTY_PREFIX = /^(\d{1,3})\s*[*x]\s*(.+)$/i;

export function PosTerminal({ catalog, tax }: { catalog: Catalog; tax: PosTax }) {
  const [cart, setCart] = useState<{ product_id: string; quantity: number }[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerKey, setCustomerKey] = useState(0);
  const [applyTax, setApplyTax] = useState(tax.applyByDefault);
  const [method, setMethod] = useState<PosPaymentMethod>("cash");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutKey, setCheckoutKey] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(catalog.products.map((p) => [p.id, p])), [catalog.products]);

  // El catálogo se refresca tras cada venta: las líneas usan precio y stock actuales.
  const lines: PosLine[] = cart.flatMap((l) => {
    const product = byId.get(l.product_id);
    return product ? [{ product, quantity: l.quantity }] : [];
  });
  const totals = computeTotals(
    lines.map((l) => ({ unit_price: l.product.price, quantity: l.quantity })),
    applyTax ? tax.rate : 0
  );
  const units = lines.reduce((sum, l) => sum + l.quantity, 0);
  const overStock = lines.filter((l) => l.quantity > l.product.stock);

  const term = normalizeText(query.trim().replace(QTY_PREFIX, "$2"));
  const results = useMemo(
    () =>
      catalog.products.filter(
        (p) =>
          (!category || p.category === category) &&
          (!term || normalizeText(`${p.name} ${p.sku}`).includes(term))
      ),
    [catalog.products, category, term]
  );
  const popular = useMemo(
    () =>
      [...catalog.products]
        .filter((p) => p.sold > 0 && p.stock > 0)
        .sort((a, b) => b.sold - a.sold)
        .slice(0, 8),
    [catalog.products]
  );

  function quantityInCart(productId: string) {
    return cart.find((l) => l.product_id === productId)?.quantity ?? 0;
  }

  function add(product: CatalogProduct, quantity = 1) {
    const current = quantityInCart(product.id);
    if (product.stock <= 0) {
      toast.error(`«${product.name}» está agotado`);
      return;
    }
    if (current + quantity > product.stock) {
      toast.warning(`Solo hay ${product.stock} u. de «${product.name}»`);
    }
    const next = Math.min(current + quantity, product.stock);
    if (next === current) return;
    setCart((prev) =>
      current > 0
        ? prev.map((l) => (l.product_id === product.id ? { ...l, quantity: next } : l))
        : [...prev, { product_id: product.id, quantity: next }]
    );
  }

  function setQuantity(product: CatalogProduct, quantity: number) {
    if (!Number.isFinite(quantity)) return;
    if (quantity <= 0) {
      setCart((prev) => prev.filter((l) => l.product_id !== product.id));
      return;
    }
    const clamped = Math.min(Math.floor(quantity), Math.max(product.stock, 1));
    if (quantity > product.stock) toast.warning(`Solo hay ${product.stock} u. de «${product.name}»`);
    setCart((prev) => prev.map((l) => (l.product_id === product.id ? { ...l, quantity: clamped } : l)));
  }

  /** Enter en el buscador: SKU exacto (lector de código de barras) o único resultado. */
  function submitSearch() {
    const raw = query.trim();
    if (!raw) return;
    const match = raw.match(QTY_PREFIX);
    const quantity = match ? Number(match[1]) : 1;
    const code = (match ? match[2] : raw).trim().toUpperCase();

    const target = catalog.products.find((p) => p.sku.toUpperCase() === code) ?? (results.length === 1 ? results[0] : null);
    if (!target) {
      toast.error(results.length ? "Varios productos coinciden: elige uno de la lista" : `Sin resultados para «${raw}»`);
      return;
    }
    add(target, Math.max(quantity, 1));
    setQuery("");
  }

  function openCheckout() {
    if (!lines.length) {
      toast.error("Agrega productos al carrito");
      return;
    }
    if (overStock.length) {
      toast.error(`Stock insuficiente para «${overStock[0].product.name}»`);
      return;
    }
    setCheckoutKey((k) => k + 1);
    setCheckoutOpen(true);
  }

  function resetSale() {
    setCart([]);
    setCustomer(null);
    setCustomerKey((k) => k + 1);
    setApplyTax(tax.applyByDefault);
    setMethod("cash");
    searchRef.current?.focus();
  }

  // Atajos de teclado: F2 buscar · F9 cobrar.
  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "F2") {
      event.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    } else if (event.key === "F9" && !checkoutOpen) {
      event.preventDefault();
      openCheckout();
    }
  });
  useEffect(() => {
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  const showPopular = !term && !category && popular.length > 0;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]">
      {/* ----- Panel izquierdo: buscador y catálogo rápido ----- */}
      <section aria-label="Buscar productos" className="grid gap-4">
        <div className="grid gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
          <div className="relative">
            <ScanBarcode
              className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              ref={searchRef}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitSearch();
                } else if (e.key === "Escape") {
                  setQuery("");
                }
              }}
              placeholder="Escanea el código o busca por SKU / nombre…"
              aria-label="Buscar por SKU o nombre. Enter agrega el producto"
              className="h-11 pr-20 pl-10 text-base md:text-base"
              autoComplete="off"
              spellCheck={false}
            />
            <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border bg-muted px-1.5 font-mono text-[11px] text-muted-foreground sm:block">
              F2
            </kbd>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="group" aria-label="Filtrar por categoría">
            <CategoryChip active={category === null} onClick={() => setCategory(null)}>
              Todas
            </CategoryChip>
            {catalog.categories.map((c) => (
              <CategoryChip key={c} active={category === c} onClick={() => setCategory(category === c ? null : c)}>
                {c}
              </CategoryChip>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            <kbd className="font-mono">Enter</kbd> agrega el SKU exacto o el único resultado ·{" "}
            <span className="font-mono">3*SKU</span> agrega 3 unidades
          </p>
        </div>

        {showPopular ? (
          <div className="grid gap-2">
            <h2 className="flex items-center gap-1.5 text-sm font-medium">
              <Flame className="size-4 text-brand" aria-hidden />
              Más vendidos
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {popular.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => add(p)}
                  className="grid gap-0.5 rounded-lg border bg-card p-2.5 text-left transition-colors outline-none hover:border-foreground/30 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px"
                >
                  <span className="line-clamp-2 text-xs leading-snug font-medium">{p.name}</span>
                  <span className="text-sm font-semibold tabular-nums">{formatCurrency(p.price)}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-2">
          <h2 className="text-sm font-medium">
            {term || category ? `Resultados (${results.length})` : "Catálogo"}
          </h2>
          {results.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No hay productos que coincidan con la búsqueda.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {results.slice(0, MAX_RESULTS).map((p) => {
                const inCart = quantityInCart(p.id);
                const out = p.stock <= 0;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={out}
                      onClick={() => add(p)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border bg-card p-2.5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        out ? "cursor-not-allowed opacity-55" : "hover:border-foreground/30 hover:bg-muted/50 active:translate-y-px",
                        inCart > 0 && "border-foreground/40 bg-muted/40"
                      )}
                    >
                      <ProductThumb src={p.image_url} alt="" />
                      <span className="grid min-w-0 flex-1 gap-0.5">
                        <span className="truncate text-sm font-medium">{p.name}</span>
                        <span className="truncate font-mono text-[11px] text-muted-foreground">{p.sku}</span>
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold tabular-nums">{formatCurrency(p.price)}</span>
                          <span
                            className={cn(
                              "text-xs tabular-nums",
                              out ? "font-medium text-status-critical" : p.stock_status === "low" ? "text-status-serious" : "text-muted-foreground"
                            )}
                          >
                            {out ? "Agotado" : `${p.stock} u.`}
                          </span>
                        </span>
                      </span>
                      {inCart > 0 ? (
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground tabular-nums">
                          {inCart}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {results.length > MAX_RESULTS ? (
            <p className="text-xs text-muted-foreground">
              Mostrando {MAX_RESULTS} de {results.length}. Afina la búsqueda para ver el resto.
            </p>
          ) : null}
        </div>
      </section>

      {/* ----- Panel derecho: carrito y cobro ----- */}
      <section
        id="pos-cart"
        aria-label="Carrito y cobro"
        className="mb-20 grid scroll-mt-4 gap-0 overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 lg:sticky lg:top-4 lg:mb-0"
      >
        <div className="flex items-center justify-between gap-2 border-b p-3">
          <h2 className="flex items-center gap-2 font-medium">
            <ShoppingCart className="size-4" aria-hidden />
            Venta actual
            {units > 0 ? (
              <span className="text-xs font-normal text-muted-foreground">
                · {units === 1 ? "1 unidad" : `${units} unidades`}
              </span>
            ) : null}
          </h2>
          {lines.length ? (
            <Button variant="ghost" size="sm" onClick={() => setCart([])} className="text-muted-foreground">
              <X data-icon="inline-start" />
              Vaciar
            </Button>
          ) : null}
        </div>

        <div className="border-b p-3">
          <CustomerPicker key={customerKey} value={customer} onChange={setCustomer} />
        </div>

        {lines.length === 0 ? (
          <div className="grid justify-items-center gap-1 p-8 text-center">
            <ShoppingCart className="size-8 text-muted-foreground/60" aria-hidden />
            <p className="text-sm font-medium">El carrito está vacío</p>
            <p className="text-xs text-muted-foreground">Escanea un código o toca un producto para agregarlo.</p>
          </div>
        ) : (
          <ul className="max-h-[42svh] divide-y overflow-y-auto" aria-label="Productos en la venta">
            {lines.map(({ product, quantity }) => (
              <li key={product.id} className="grid gap-1.5 p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatCurrency(product.price)} c/u · <span className="font-mono">{product.sku}</span>
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Quitar ${product.name}`}
                    onClick={() => setQuantity(product, 0)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash />
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <QuantityStepper
                    value={quantity}
                    max={product.stock}
                    label={product.name}
                    onChange={(q) => setQuantity(product, q)}
                  />
                  <span className="font-semibold tabular-nums">{formatCurrency(product.price * quantity)}</span>
                </div>
                {quantity > product.stock ? (
                  <p role="alert" className="text-xs text-status-critical">
                    Solo quedan {product.stock} u. en stock
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-3 border-t bg-muted/30 p-3">
          <dl className="grid gap-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums">{formatCurrency(totals.subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt>
                <label className="inline-flex cursor-pointer items-center gap-2 text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={applyTax}
                    onChange={(e) => setApplyTax(e.target.checked)}
                    className="size-4 accent-foreground"
                  />
                  Sumar {tax.label} ({Math.round(tax.rate * 100)}%)
                </label>
              </dt>
              <dd className={cn("tabular-nums", !applyTax && "text-muted-foreground")}>{formatCurrency(totals.tax)}</dd>
            </div>
            <div className="mt-1 flex items-baseline justify-between border-t pt-2">
              <dt className="font-medium">Total</dt>
              <dd className="text-2xl font-semibold tracking-tight tabular-nums">{formatCurrency(totals.total)}</dd>
            </div>
          </dl>

          <fieldset className="grid gap-1.5">
            <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Método de pago</legend>
            <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Método de pago">
              {POS_METHODS.map((m) => {
                const active = method === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setMethod(m.value)}
                    className={cn(
                      "flex h-10 items-center gap-2 rounded-lg border px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      active ? "border-foreground bg-background font-medium" : "bg-background/60 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <m.icon className="size-4" aria-hidden />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Button size="lg" className="h-12 text-base" onClick={openCheckout} disabled={!lines.length}>
            Cobrar {formatCurrency(totals.total)}
            <kbd className="ml-auto rounded border border-primary-foreground/30 px-1.5 font-mono text-[11px] opacity-80">
              F9
            </kbd>
          </Button>
        </div>
      </section>

      {/* Móvil: el carrito queda abajo; barra fija con total y acceso al cobro. */}
      {lines.length ? (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t bg-background/95 p-3 backdrop-blur lg:hidden">
          <a href="#pos-cart" className="min-w-0 flex-1 text-sm">
            <span className="block text-xs text-muted-foreground">
              {units === 1 ? "1 unidad" : `${units} unidades`} · ver carrito
            </span>
            <span className="text-lg font-semibold tabular-nums">{formatCurrency(totals.total)}</span>
          </a>
          <Button size="lg" className="h-11" onClick={openCheckout}>
            Cobrar
          </Button>
        </div>
      ) : null}

      <PosCheckoutDialog
        key={checkoutKey}
        open={checkoutOpen}
        onOpenChange={(open) => {
          setCheckoutOpen(open);
          if (!open) searchRef.current?.focus();
        }}
        lines={lines}
        totals={totals}
        method={method}
        customer={customer}
        applyTax={applyTax}
        taxLabel={tax.label}
        onSold={resetSale}
      />
    </div>
  );
}

function CategoryChip({
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
        "h-7 shrink-0 rounded-full border px-3 text-xs transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        active ? "border-foreground bg-foreground text-background" : "hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}
