"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { searchCustomers } from "@/app/actions/orders";
import { Field, fieldAria } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Customer } from "@/lib/orders/types";

/** Buscador de clientes existentes (nombre, teléfono o email). */
export function CustomerSearch({
  inputId,
  error,
  selected,
  onSelect,
}: {
  inputId: string;
  error?: string;
  selected: Customer | null;
  onSelect: (customer: Customer | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Customer[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function search(value: string) {
    setQuery(value);
    clearTimeout(timer.current);
    if (value.trim().length < 2) {
      setResults(null);
      return;
    }
    timer.current = setTimeout(async () => setResults(await searchCustomers(value)), 300);
  }

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-muted/60 p-3 text-sm ring-1 ring-foreground/10">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{selected.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[selected.phone, selected.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Elegir otro cliente" onClick={() => onSelect(null)}>
          <X />
        </Button>
      </div>
    );
  }

  return (
    <Field label="Buscar cliente" htmlFor={inputId} error={error}>
      <Input
        {...fieldAria(inputId, error)}
        value={query}
        onChange={(e) => search(e.target.value)}
        placeholder="Nombre, teléfono o email"
        autoComplete="off"
        className="h-11"
      />
      {results ? (
        <ul className="max-h-56 overflow-y-auto rounded-lg ring-1 ring-foreground/10" aria-label="Clientes encontrados">
          {results.length === 0 ? (
            <li className="p-3 text-sm text-muted-foreground">Sin resultados. Usa «Nuevo» para registrarlo.</li>
          ) : (
            results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelect(c)}
                  className="grid w-full px-3 py-2.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <span className="text-sm font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {[c.phone, c.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </Field>
  );
}
