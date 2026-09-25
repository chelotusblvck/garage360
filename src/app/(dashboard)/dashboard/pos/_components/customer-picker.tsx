"use client";

import { useRef, useState } from "react";
import { LoaderCircle, Search, UserRound, X } from "lucide-react";
import { searchCustomers } from "@/app/actions/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Customer } from "@/lib/orders/types";

/** Cliente de la venta: "Consumidor final" o un cliente del taller. */
export function CustomerPicker({
  value,
  onChange,
}: {
  value: Customer | null;
  onChange: (customer: Customer | null) => void;
}) {
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Customer[] | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function search(term: string) {
    setQuery(term);
    clearTimeout(timer.current);
    if (term.trim().length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      setResults(await searchCustomers(term));
      setLoading(false);
    }, 300);
  }

  function close() {
    clearTimeout(timer.current);
    setSearching(false);
    setQuery("");
    setResults(null);
    setLoading(false);
  }

  if (!searching) {
    return (
      <div className="flex items-center gap-2">
        <UserRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{value ? value.name : "Consumidor final"}</p>
          <p className="truncate text-xs text-muted-foreground">
            {value ? [value.phone, value.email].filter(Boolean).join(" · ") || "Cliente del taller" : "Sin datos del cliente"}
          </p>
        </div>
        {value ? (
          <Button variant="ghost" size="icon-sm" aria-label="Quitar cliente" onClick={() => onChange(null)}>
            <X />
          </Button>
        ) : null}
        <Button variant="outline" size="sm" onClick={() => setSearching(true)}>
          {value ? "Cambiar" : "Asignar cliente"}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          autoFocus
          value={query}
          onChange={(e) => search(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && close()}
          placeholder="Nombre, teléfono o email…"
          aria-label="Buscar cliente"
          className="pr-8 pl-8"
        />
        {loading ? (
          <LoaderCircle className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Buscando" />
        ) : (
          <button
            type="button"
            onClick={close}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Cancelar búsqueda"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {results ? (
        results.length ? (
          <ul className="max-h-44 divide-y overflow-y-auto rounded-lg border" aria-label="Clientes encontrados">
            {results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(c);
                    close();
                  }}
                  className="grid w-full px-3 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted"
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[c.phone, c.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Sin coincidencias. La venta puede seguir como consumidor final.</p>
        )
      ) : null}
    </div>
  );
}
