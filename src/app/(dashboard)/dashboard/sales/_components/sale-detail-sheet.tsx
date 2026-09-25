"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { getSaleDetail } from "@/app/actions/pos";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { FULFILLMENT_LABEL, PAYMENT_METHOD_LABEL, SALES_CHANNEL_LABEL } from "@/lib/sales/shared";
import { saleChange } from "@/lib/sales/ticket";
import type { Sale, SaleDetail } from "@/lib/sales/types";

export function SaleDetailSheet({
  sale,
  open,
  onOpenChange,
}: {
  sale: Sale | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {sale ? <SaleDetailBody key={sale.id} sale={sale} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function SaleDetailBody({ sale }: { sale: Sale }) {
  const [detail, setDetail] = useState<SaleDetail | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSaleDetail(sale.id).then((result) => {
      if (!cancelled) setDetail(result);
    });
    return () => {
      cancelled = true;
    };
  }, [sale.id]);

  const change = saleChange(sale);
  const row = "flex justify-between gap-3";

  return (
    <>
      <SheetHeader className="border-b pr-12">
        <SheetTitle className="font-mono">{sale.folio}</SheetTitle>
        <SheetDescription>
          {SALES_CHANNEL_LABEL[sale.channel]} · {formatDateTime(new Date(sale.paid_at ?? sale.created_at))}
        </SheetDescription>
      </SheetHeader>

      <div className="grid gap-5 p-4 text-sm">
        <section className="grid gap-1" aria-label="Cliente">
          <h3 className="text-xs font-medium text-muted-foreground">Cliente</h3>
          <p className="font-medium">{sale.customer.name ?? "Consumidor final"}</p>
          {sale.customer.email || sale.customer.phone ? (
            <p className="text-muted-foreground">{[sale.customer.phone, sale.customer.email].filter(Boolean).join(" · ")}</p>
          ) : null}
          {sale.fulfillment ? (
            <p>
              {FULFILLMENT_LABEL[sale.fulfillment]}
              {sale.shipping_address
                ? `: ${sale.shipping_address.street}, ${sale.shipping_address.city} (${sale.shipping_address.postal_code})`
                : ""}
            </p>
          ) : null}
          {sale.notes ? <p className="text-muted-foreground italic">“{sale.notes}”</p> : null}
        </section>

        <section className="grid gap-2" aria-label="Productos">
          <h3 className="text-xs font-medium text-muted-foreground">Productos</h3>
          {detail ? (
            <ul className="divide-y rounded-lg ring-1 ring-foreground/10">
              {detail.items.map((item) => (
                <li key={item.product_id} className="flex items-start justify-between gap-3 p-2.5">
                  <span className="min-w-0">
                    <span className="block truncate">{item.product_name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {item.quantity} × {formatCurrency(item.unit_price)} · <span className="font-mono">{item.sku}</span>
                    </span>
                  </span>
                  <span className="font-medium tabular-nums">{formatCurrency(item.line_total)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="grid gap-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          )}
        </section>

        <dl className="grid gap-1">
          <div className={row}>
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular-nums">{formatCurrency(sale.subtotal)}</dd>
          </div>
          {sale.tax > 0 ? (
            <div className={row}>
              <dt className="text-muted-foreground">IVA</dt>
              <dd className="tabular-nums">{formatCurrency(sale.tax)}</dd>
            </div>
          ) : null}
          <div className={`${row} border-t pt-2 text-base font-semibold`}>
            <dt>Total</dt>
            <dd className="tabular-nums">{formatCurrency(sale.total)}</dd>
          </div>
          <div className={row}>
            <dt className="text-muted-foreground">Pago</dt>
            <dd>{sale.payment_method ? PAYMENT_METHOD_LABEL[sale.payment_method] : "—"}</dd>
          </div>
          {sale.amount_tendered !== null && change !== null ? (
            <div className={row}>
              <dt className="text-muted-foreground">Recibido / vuelto</dt>
              <dd className="tabular-nums">
                {formatCurrency(sale.amount_tendered)} / {formatCurrency(change)}
              </dd>
            </div>
          ) : null}
          {sale.seller_name ? (
            <div className={row}>
              <dt className="text-muted-foreground">Atendió</dt>
              <dd>{sale.seller_name}</dd>
            </div>
          ) : null}
        </dl>

        <Link href={`/print/sales/${sale.id}`} target="_blank" className={buttonVariants({ variant: "outline" })}>
          <Printer data-icon="inline-start" />
          Ver / imprimir ticket
        </Link>
      </div>
    </>
  );
}
