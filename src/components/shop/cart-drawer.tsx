"use client";

import { createContext, use, useState } from "react";
import Link from "next/link";
import { ShoppingBag, ShoppingCart, Trash } from "lucide-react";
import { ProductThumb } from "@/components/inventory/product-thumb";
import { QuantityStepper } from "@/components/quantity-stepper";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SHOP } from "@/lib/business";
import { formatCurrency } from "@/lib/format";
import { cart, useCart } from "./cart-store";

const CartDrawerContext = createContext<{ open: () => void }>({ open: () => {} });

/** Abre el carrito lateral desde cualquier componente de la tienda. */
export const useCartDrawer = () => use(CartDrawerContext);

export function CartDrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <CartDrawerContext value={{ open: () => setIsOpen(true) }}>
      {children}
      <CartDrawer open={isOpen} onOpenChange={setIsOpen} />
    </CartDrawerContext>
  );
}

/** Botón del header con contador de unidades. */
export function CartButton() {
  const { count } = useCart();
  const { open } = useCartDrawer();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={open}
      aria-label={count ? `Carrito: ${count} ${count === 1 ? "unidad" : "unidades"}` : "Carrito vacío"}
      className="relative"
    >
      <ShoppingCart />
      {count > 0 ? (
        <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-foreground tabular-nums">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Button>
  );
}

function CartDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { lines, count, subtotal } = useCart();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b pr-12">
          <SheetTitle>Tu carrito</SheetTitle>
          <SheetDescription>
            {count ? `${count} ${count === 1 ? "unidad" : "unidades"}` : "Todavía no agregaste productos"}
          </SheetDescription>
        </SheetHeader>

        {lines.length === 0 ? (
          <div className="grid flex-1 content-center justify-items-center gap-3 p-8 text-center">
            <ShoppingBag className="size-10 text-muted-foreground/60" aria-hidden />
            <p className="text-sm text-muted-foreground">Explora el catálogo y agrega repuestos o accesorios.</p>
            <Link href="/shop" onClick={() => onOpenChange(false)} className={buttonVariants({ variant: "outline" })}>
              Ver catálogo
            </Link>
          </div>
        ) : (
          <ul className="flex-1 divide-y overflow-y-auto" aria-label="Productos en el carrito">
            {lines.map((line) => (
              <li key={line.id} className="flex gap-3 p-4">
                <ProductThumb src={line.image_url} alt="" className="size-14" />
                <div className="grid min-w-0 flex-1 gap-1.5">
                  <div className="flex items-start gap-2">
                    <p className="line-clamp-2 flex-1 text-sm leading-snug font-medium">{line.name}</p>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Quitar ${line.name}`}
                      onClick={() => cart.remove(line.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <QuantityStepper
                      size="sm"
                      value={line.quantity}
                      max={Math.min(line.stock, SHOP.maxUnitsPerProduct)}
                      label={line.name}
                      onChange={(q) => cart.setQuantity(line.id, q, SHOP.maxUnitsPerProduct)}
                    />
                    <span className="text-sm font-semibold tabular-nums">{formatCurrency(line.price * line.quantity)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {lines.length ? (
          <SheetFooter className="border-t bg-muted/30">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="text-xl font-semibold tabular-nums">{formatCurrency(subtotal)}</span>
            </div>
            <p className="text-xs text-muted-foreground">Precios finales. El envío se coordina al confirmar.</p>
            <Link
              href="/shop/checkout"
              onClick={() => onOpenChange(false)}
              className={buttonVariants({ size: "lg", className: "h-11 text-base" })}
            >
              Proceder al pago
            </Link>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Seguir comprando
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
