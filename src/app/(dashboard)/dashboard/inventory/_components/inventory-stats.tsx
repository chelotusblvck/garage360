import Link from "next/link";
import { Boxes, OctagonAlert, TriangleAlert, Wallet, type LucideIcon } from "lucide-react";
import { formatCompactCurrency, formatNumber } from "@/lib/format";
import type { InventoryStats as Stats } from "@/lib/inventory/types";
import { cn } from "@/lib/utils";

function StatTile({
  label,
  value,
  detail,
  icon: Icon,
  iconClass,
  href,
  active,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  iconClass?: string;
  href?: string;
  active?: boolean;
}) {
  const content = (
    <>
      <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        {label}
        <Icon className={cn("size-4", iconClass ?? "text-muted-foreground")} aria-hidden />
      </span>
      <span className="text-2xl font-semibold tracking-tight">{value}</span>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </>
  );
  const className = cn(
    "grid gap-1 rounded-xl bg-card p-3.5 ring-1 ring-foreground/10 transition-colors",
    href && "hover:bg-muted/50",
    active && "ring-2 ring-foreground/60"
  );

  return href ? (
    <Link href={href} className={className} aria-current={active ? "true" : undefined}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

export function InventoryStats({ stats, activeStatus }: { stats: Stats; activeStatus: string }) {
  return (
    <section aria-label="Resumen de inventario" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        label="Productos activos"
        value={formatNumber(stats.activeProducts)}
        detail={`${formatNumber(stats.totalUnits)} unidades en stock`}
        icon={Boxes}
      />
      <StatTile
        label="Valor del inventario"
        value={formatCompactCurrency(stats.valueAtCost)}
        detail="A precio de compra"
        icon={Wallet}
      />
      <StatTile
        label="Stock bajo"
        value={formatNumber(stats.lowCount)}
        detail={activeStatus === "low" ? "Mostrando solo estos" : "Ver productos a reponer"}
        icon={TriangleAlert}
        iconClass="text-status-serious"
        href={activeStatus === "low" ? "/dashboard/inventory" : "/dashboard/inventory?status=low"}
        active={activeStatus === "low"}
      />
      <StatTile
        label="Agotados"
        value={formatNumber(stats.outCount)}
        detail={activeStatus === "out" ? "Mostrando solo estos" : "Ver productos sin stock"}
        icon={OctagonAlert}
        iconClass="text-status-critical"
        href={activeStatus === "out" ? "/dashboard/inventory" : "/dashboard/inventory?status=out"}
        active={activeStatus === "out"}
      />
    </section>
  );
}
