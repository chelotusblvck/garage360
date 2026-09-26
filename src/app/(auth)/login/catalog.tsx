import { ArrowRight, Check, Rocket, Sparkles } from "lucide-react";
import { HARDWARE_ICON } from "@/components/quotations/hardware-picker";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { HARDWARE, HARDWARE_KEYS, PLAN_KEYS, PLANS, SETUP_TYPES, SETUPS, type PlanKey } from "@/lib/workshops/plans";

/** Plan destacado en el catálogo. */
const FEATURED: PlanKey = "pro";

/** Pestaña «Catálogo & Planes»: planes, modalidades de setup y equipamiento. */
export function Catalog({ onQuote }: { onQuote: (plan: PlanKey) => void }) {
  return (
    <div className="grid gap-8">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Planes y equipamiento</h1>
        <p className="text-sm text-muted-foreground">Precios en CLP con IVA incluido. Sin permanencia: cambia de plan cuando quieras.</p>
      </div>

      <section aria-labelledby="catalog-plans" className="grid gap-3">
        <h2 id="catalog-plans" className="text-sm font-medium">
          Planes de suscripción
        </h2>
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {PLAN_KEYS.map((key) => {
            const plan = PLANS[key];
            const featured = key === FEATURED;
            return (
              <li
                key={key}
                className={cn(
                  "relative flex flex-col gap-3 rounded-xl border p-4",
                  featured && "border-foreground ring-1 ring-foreground"
                )}
              >
                {featured ? (
                  <span className="absolute -top-2.5 left-4 rounded-full bg-brand px-2 py-0.5 text-[0.7rem] font-medium text-brand-foreground">
                    Más elegido
                  </span>
                ) : null}
                <div className="grid gap-1">
                  <h3 className="font-semibold">{plan.label}</h3>
                  <p className="text-xl font-semibold tabular-nums">
                    {formatCurrency(plan.monthly)}
                    <span className="text-sm font-normal text-muted-foreground">/mes</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{plan.description}</p>
                </div>
                <ul className="grid gap-1 text-xs">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-1.5">
                      <Check className="size-3.5 shrink-0 text-status-good" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button variant={featured ? "default" : "outline"} className="mt-auto" onClick={() => onQuote(key)}>
                  Cotizar {plan.label}
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="catalog-setup" className="grid gap-3">
        <h2 id="catalog-setup" className="text-sm font-medium">
          Implementación
        </h2>
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {SETUP_TYPES.map((key) => {
            const setup = SETUPS[key];
            const Icon = key === "turnkey" ? Sparkles : Rocket;
            return (
              <li key={key} className="grid content-start gap-1.5 rounded-xl border p-4">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Icon className="size-4 text-muted-foreground" aria-hidden />
                  {setup.label}
                </span>
                <span className="text-sm font-medium tabular-nums">{setup.fee ? `${formatCurrency(setup.fee)} pago único` : "Sin costo"}</span>
                <span className="text-xs text-muted-foreground">{setup.description}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="catalog-hardware" className="grid gap-3">
        <h2 id="catalog-hardware" className="text-sm font-medium">
          Equipamiento <span className="font-normal text-muted-foreground">· opcional, pago único</span>
        </h2>
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {HARDWARE_KEYS.map((key) => {
            const item = HARDWARE[key];
            const Icon = HARDWARE_ICON[key];
            return (
              <li key={key} className="grid content-start gap-2 rounded-xl border p-4">
                <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="grid gap-0.5">
                  <h3 className="text-sm font-semibold">{item.label}</h3>
                  <p className="text-sm font-medium tabular-nums">{formatCurrency(item.price)}</p>
                </div>
                <p className="text-xs text-muted-foreground">{item.description}</p>
                <ul className="grid gap-0.5 text-xs text-muted-foreground">
                  {item.features.map((f) => (
                    <li key={f}>· {f}</li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
