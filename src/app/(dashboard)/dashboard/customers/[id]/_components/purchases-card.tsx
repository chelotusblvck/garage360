import Link from "next/link";
import { Globe, ShoppingBag, Store } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CustomerPurchase } from "@/lib/customers/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { SALES_CHANNEL_LABEL } from "@/lib/sales/shared";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<CustomerPurchase["status"], string> = {
  pending: "Pendiente",
  paid: "Pagada",
  cancelled: "Anulada",
  refunded: "Reembolsada",
};

/** Compras del cliente en mostrador (POS) y tienda online. */
export function PurchasesCard({ purchases }: { purchases: CustomerPurchase[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingBag className="size-4 text-muted-foreground" aria-hidden />
          Compras realizadas
        </CardTitle>
        <CardDescription>Repuestos y accesorios en mostrador y tienda online.</CardDescription>
      </CardHeader>
      <CardContent>
        {purchases.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin compras registradas.</p>
        ) : (
          <ul className="divide-y">
            {purchases.map((p) => {
              const Icon = p.channel === "online" ? Globe : Store;
              return (
                <li key={p.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icon className="size-4 text-muted-foreground" aria-hidden />
                  </span>
                  <div className="grid min-w-0 flex-1">
                    <Link href={`/print/sales/${p.id}`} target="_blank" className="w-fit font-mono text-sm font-medium hover:underline">
                      {p.folio}
                    </Link>
                    <span className="truncate text-xs text-muted-foreground">
                      {SALES_CHANNEL_LABEL[p.channel]} · {formatDate(new Date(p.at))} · {p.units} u.
                    </span>
                  </div>
                  <div className="grid text-right">
                    <span className={cn("text-sm font-medium tabular-nums", p.status !== "paid" && "text-muted-foreground line-through")}>
                      {formatCurrency(p.total)}
                    </span>
                    {p.status !== "paid" ? <span className="text-xs text-muted-foreground">{STATUS_LABEL[p.status]}</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
