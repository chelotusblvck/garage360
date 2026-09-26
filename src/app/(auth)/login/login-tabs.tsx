"use client";

import { useRef, useState } from "react";
import { FileText, LayoutGrid, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanKey } from "@/lib/workshops/plans";
import { Catalog } from "./catalog";
import { QuotationForm } from "./quotation-form";
import type { LoginTab } from "./tabs";

const TABS: { value: LoginTab; label: string; icon: typeof LogIn }[] = [
  { value: "ingresar", label: "Ingresar", icon: LogIn },
  { value: "catalogo", label: "Catálogo & Planes", icon: LayoutGrid },
  { value: "cotizar", label: "Solicitar cotización", icon: FileText },
];

/**
 * /login con pestañas: ingreso del staff, catálogo público y cotización de
 * alta. La pestaña queda en la URL (?tab=…) para compartir el enlace directo.
 */
export function LoginTabs({ initialTab, login }: { initialTab: LoginTab; login: React.ReactNode }) {
  const [tab, setTab] = useState<LoginTab>(initialTab);
  const [quotePlan, setQuotePlan] = useState<PlanKey>("pro");
  // key del formulario: «Cotizar X» desde el catálogo lo reinicia con ese plan.
  const [quoteKey, setQuoteKey] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function select(next: LoginTab) {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "ingresar") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  }

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + TABS.length) % TABS.length;
    select(TABS[next].value);
    tabRefs.current[next]?.focus();
  }

  return (
    // data-wide: el layout de (auth) ensancha la columna para el catálogo.
    <div data-wide className="grid gap-6">
      <div role="tablist" aria-label="Opciones de acceso" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
        {TABS.map((t, i) => {
          const active = t.value === tab;
          return (
            <button
              key={t.value}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`login-tab-${t.value}`}
              aria-selected={active}
              aria-controls={`login-panel-${t.value}`}
              tabIndex={active ? 0 : -1}
              onClick={() => select(t.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "flex min-h-9 items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-center text-xs font-medium leading-tight transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-sm",
                active ? "bg-background text-foreground shadow-sm ring-1 ring-foreground/10" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="hidden size-4 shrink-0 sm:block" aria-hidden />
              {t.label}
            </button>
          );
        })}
      </div>

      {TABS.map((t) => (
        <div
          key={t.value}
          role="tabpanel"
          id={`login-panel-${t.value}`}
          aria-labelledby={`login-tab-${t.value}`}
          hidden={t.value !== tab}
          className="@container"
        >
          {t.value === "ingresar" ? <div className="mx-auto w-full max-w-sm">{login}</div> : null}
          {t.value === "catalogo" ? (
            <Catalog
              onQuote={(plan) => {
                setQuotePlan(plan);
                setQuoteKey((k) => k + 1);
                select("cotizar");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          ) : null}
          {/* Montado aunque esté oculto: cambiar de pestaña no borra lo escrito. */}
          {t.value === "cotizar" ? <QuotationForm key={quoteKey} initialPlan={quotePlan} /> : null}
        </div>
      ))}
    </div>
  );
}
