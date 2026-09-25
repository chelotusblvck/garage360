import { Package, ReceiptText, Store, Wallet, type LucideIcon } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/sales/shared";
import type { SalesSummary } from "@/lib/sales/types";
import type { PaymentMethod } from "@/lib/validations/schemas";

function Tile({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: LucideIcon }) {
  return (
    <div className="grid gap-1 rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
      <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        {label}
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
      <span className="truncate text-xs text-muted-foreground">{detail}</span>
    </div>
  );
}

export function SalesSummaryTiles({ summary }: { summary: SalesSummary }) {
  const topMethod = (Object.entries(summary.byPaymentMethod) as [PaymentMethod, number][]).sort((a, b) => b[1] - a[1])[0];

  return (
    <section aria-label="Resumen del período" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile
        label="Ingresos"
        value={formatCurrency(summary.revenue)}
        detail={topMethod ? `Más usado: ${PAYMENT_METHOD_LABEL[topMethod[0]]}` : "Sin ventas en el período"}
        icon={Wallet}
      />
      <Tile
        label="Ventas"
        value={formatNumber(summary.count)}
        detail={`Ticket promedio ${formatCurrency(summary.averageTicket)}`}
        icon={ReceiptText}
      />
      <Tile
        label="Mostrador / E-commerce"
        value={`${formatNumber(summary.byChannel.pos.count)} / ${formatNumber(summary.byChannel.online.count)}`}
        detail={`${formatCurrency(summary.byChannel.pos.revenue)} · ${formatCurrency(summary.byChannel.online.revenue)}`}
        icon={Store}
      />
      <Tile
        label="Unidades vendidas"
        value={formatNumber(summary.units)}
        detail="Descontadas del inventario"
        icon={Package}
      />
    </section>
  );
}
