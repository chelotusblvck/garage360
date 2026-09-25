import Link from "next/link";
import { STOCK_STATUS_STYLE, StockStatusBadge } from "@/components/inventory/stock-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { LowStockProduct } from "@/lib/data/metrics";

export function LowStockTable({ products }: { products: LowStockProduct[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Alertas de stock</CardTitle>
        <CardDescription>Repuestos en o por debajo del stock mínimo</CardDescription>
        <CardAction>
          <Link href="/dashboard/inventory?status=low" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Ir a inventario
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        {products.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Todos los productos están por encima del mínimo.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Producto</TableHead>
                <TableHead className="w-32">Stock / mín.</TableHead>
                <TableHead className="w-32 pr-4">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => {
                const pct = p.min_stock > 0 ? Math.min(100, (p.stock / p.min_stock) * 100) : 100;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="max-w-0 pl-4">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{p.sku}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm tabular-nums">
                        <span className="font-medium">{p.stock}</span>
                        <span className="text-muted-foreground"> / {p.min_stock}</span>
                      </p>
                      <div className="mt-1 h-1 w-20 overflow-hidden rounded-full bg-muted" aria-hidden>
                        <div
                          className={`h-full rounded-full ${STOCK_STATUS_STYLE[p.stock_status].barClass}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="pr-4">
                      <StockStatusBadge status={p.stock_status} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
