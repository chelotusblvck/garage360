"use client";

import { CircleCheck, Flame, OctagonAlert, Package, ShoppingCart, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { cart, useCart } from "@/components/shop/cart-store";
import { useCartDrawer } from "@/components/shop/cart-drawer";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import type { CatalogProduct } from "@/lib/sales/catalog";
import { cn } from "@/lib/utils";

/** Por debajo de este stock se avisa "Últimas unidades" (el mínimo de reposición es interno). */
const FEW_UNITS = 5;

/** Disponibilidad en lenguaje del comprador: siempre icono + texto. */
function Availability({ product }: { product: CatalogProduct }) {
  const state =
    product.stock <= 0
      ? { icon: OctagonAlert, label: "Agotado", className: "bg-status-critical/10 ring-status-critical/25", iconClass: "text-status-critical" }
      : product.stock <= FEW_UNITS
        ? {
            icon: TriangleAlert,
            label: product.stock === 1 ? "Última unidad" : `Últimas ${product.stock} u.`,
            className: "bg-status-warning/15 ring-status-warning/40",
            iconClass: "text-status-serious",
          }
        : { icon: CircleCheck, label: "En stock", className: "bg-status-good/10 ring-status-good/25", iconClass: "text-status-good" };

  return (
    <span
      className={cn(
        "inline-flex h-6 w-fit items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap text-foreground ring-1 ring-inset",
        state.className
      )}
    >
      <state.icon className={cn("size-3.5 shrink-0", state.iconClass)} aria-hidden />
      {state.label}
    </span>
  );
}

export function ProductCard({
  product,
  topSeller,
  maxPerProduct,
}: {
  product: CatalogProduct;
  topSeller: boolean;
  maxPerProduct: number;
}) {
  const { lines } = useCart();
  const { open } = useCartDrawer();
  const inCart = lines.find((l) => l.id === product.id)?.quantity ?? 0;
  const out = product.stock <= 0;
  const limit = Math.min(product.stock, maxPerProduct);

  function addToCart() {
    const quantity = cart.add(
      {
        id: product.id,
        name: product.name,
        sku: product.sku,
        price: product.price,
        image_url: product.image_url,
        stock: product.stock,
      },
      1,
      maxPerProduct
    );
    if (quantity === inCart) {
      toast.warning(`Ya tienes el máximo disponible de «${product.name}» (${limit} u.)`);
      return;
    }
    toast.success(`Agregaste «${product.name}»`, {
      description: `${quantity} en el carrito`,
      action: { label: "Ver carrito", onClick: open },
    });
  }

  return (
    <article className={cn("flex h-full flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10", out && "opacity-75")}>
      <div className="relative flex aspect-square items-center justify-center bg-muted">
        {product.image_url ? (
          // Imágenes de Supabase Storage o data URLs (modo demo).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt={product.name} loading="lazy" className="size-full object-cover" />
        ) : (
          <Package className="size-10 text-muted-foreground/50" aria-hidden />
        )}
        {topSeller && !out ? (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-medium shadow-sm">
            <Flame className="size-3 text-brand" aria-hidden />
            Más vendido
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{product.category}</p>
        <h3 className="line-clamp-2 text-sm leading-snug font-medium">{product.name}</h3>
        {product.description ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{product.description}</p>
        ) : null}
        <div className="mt-auto grid gap-2 pt-1">
          <Availability product={product} />
          <p className="text-lg font-semibold tracking-tight tabular-nums">{formatCurrency(product.price)}</p>
          <Button onClick={addToCart} disabled={out || inCart >= limit} className="h-9 w-full">
            <ShoppingCart data-icon="inline-start" />
            {out ? "Sin stock" : inCart > 0 ? `Agregar otro (${inCart})` : "Agregar al carrito"}
          </Button>
        </div>
      </div>
    </article>
  );
}
