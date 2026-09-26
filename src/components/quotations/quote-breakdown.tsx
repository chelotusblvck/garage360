import { SALES_TAX } from "@/lib/business";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PLANS, SETUPS, quoteTotals, type HardwareLine, type PlanKey, type SetupType } from "@/lib/workshops/plans";

const TAX_LABEL = `${SALES_TAX.label} (${Math.round(SALES_TAX.rate * 100)} %)`;

/** Desglose de una cotización: pago inicial (setup + equipamiento) y mensualidad, con IVA. */
export function QuoteBreakdown({
  plan,
  setup,
  hardware,
  className,
}: {
  plan: PlanKey;
  setup: SetupType;
  hardware: HardwareLine[];
  className?: string;
}) {
  const t = quoteTotals(plan, setup, hardware);
  return (
    <section aria-label="Desglose de la cotización" className={cn("grid gap-4 rounded-xl bg-muted/60 p-4 text-sm", className)}>
      <div className="grid gap-1.5">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Pago inicial</p>
        <Row label={`Setup · ${SETUPS[setup].label}`} value={t.setupFee ? formatCurrency(t.setupFee) : "Sin costo"} />
        {t.lines.map((l) => (
          <Row key={l.sku} label={`${l.qty} × ${l.label}`} value={formatCurrency(l.subtotal)} />
        ))}
        {t.lines.length === 0 ? <Row label="Equipamiento" value="Sin equipos" muted /> : null}
        <Row label="Neto" value={formatCurrency(t.initial.net)} muted className="mt-1 border-t border-foreground/10 pt-2" />
        <Row label={TAX_LABEL} value={formatCurrency(t.initial.tax)} muted />
        <div className="flex items-baseline justify-between gap-4">
          <span className="font-medium">Total inicial</span>
          <span className="text-lg font-semibold tabular-nums">{formatCurrency(t.initial.total)}</span>
        </div>
      </div>

      <div className="grid gap-1.5 border-t border-foreground/10 pt-3">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Mensualidad recurrente</p>
        <Row label={`Plan ${PLANS[plan].label}`} value={formatCurrency(t.monthly.total)} />
        <Row label="Neto" value={formatCurrency(t.monthly.net)} muted />
        <Row label={TAX_LABEL} value={formatCurrency(t.monthly.tax)} muted />
        <div className="flex items-baseline justify-between gap-4">
          <span className="font-medium">Total mensual</span>
          <span className="text-lg font-semibold tabular-nums">
            {formatCurrency(t.monthly.total)}
            <span className="text-sm font-normal text-muted-foreground">/mes</span>
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Precios en CLP con IVA incluido. Valores referenciales sujetos a confirmación.</p>
    </section>
  );
}

function Row({ label, value, muted, className }: { label: string; value: string; muted?: boolean; className?: string }) {
  return (
    <div className={cn("flex justify-between gap-4", muted && "text-muted-foreground", className)}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
