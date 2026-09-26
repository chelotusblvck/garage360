"use client";

import { useRef, useState } from "react";
import { Inbox, Store } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "talleres", label: "Talleres", icon: Store },
  { value: "cotizaciones", label: "Cotizaciones recibidas", icon: Inbox },
] as const;

type AdminTab = (typeof TABS)[number]["value"];

/** Pestañas de la consola: directorio de talleres y cotizaciones (?tab=cotizaciones). */
export function AdminTabs({
  initialTab,
  pendingQuotations,
  workshops,
  quotations,
}: {
  initialTab: AdminTab;
  pendingQuotations: number;
  workshops: React.ReactNode;
  quotations: React.ReactNode;
}) {
  const [tab, setTab] = useState<AdminTab>(initialTab);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function select(next: AdminTab) {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "talleres") url.searchParams.delete("tab");
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
    <div className="grid gap-4">
      <div role="tablist" aria-label="Secciones de la consola" className="flex w-fit gap-1 rounded-xl bg-muted p-1">
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
              id={`admin-tab-${t.value}`}
              aria-selected={active}
              aria-controls={`admin-panel-${t.value}`}
              tabIndex={active ? 0 : -1}
              onClick={() => select(t.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "flex h-8 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                active ? "bg-background text-foreground shadow-sm ring-1 ring-foreground/10" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="size-4" aria-hidden />
              {t.label}
              {t.value === "cotizaciones" && pendingQuotations > 0 ? (
                <span className="rounded-full bg-brand px-1.5 text-xs text-brand-foreground tabular-nums">
                  {pendingQuotations}
                  <span className="sr-only"> pendientes</span>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id="admin-panel-talleres" aria-labelledby="admin-tab-talleres" hidden={tab !== "talleres"}>
        {workshops}
      </div>
      <div role="tabpanel" id="admin-panel-cotizaciones" aria-labelledby="admin-tab-cotizaciones" hidden={tab !== "cotizaciones"}>
        {quotations}
      </div>
    </div>
  );
}
