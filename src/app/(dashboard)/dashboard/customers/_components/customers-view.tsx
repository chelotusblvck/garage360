"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bike, ChevronRight, MapPin, Phone, Search, UserPlus, Users, X } from "lucide-react";
import { CustomerFormSheet } from "@/components/customers/customer-form-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { matchesCustomerSearch } from "@/lib/customers/shared";
import type { CustomerSummary } from "@/lib/customers/types";
import { formatDate, formatPlate, formatRelativeDays, formatRut } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  customers: CustomerSummary[];
  initialQuery: string;
  openNew: boolean;
};

const MAX_MOTOS_SHOWN = 2;

export function CustomersView({ customers, initialQuery, openNew }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query);
  const [sheetOpen, setSheetOpen] = useState(openNew);

  const visible = useMemo(() => {
    const q = deferredQuery.trim();
    return q ? customers.filter((c) => matchesCustomerSearch(c.search, q)) : customers;
  }, [customers, deferredQuery]);

  function handleSearch(value: string) {
    setQuery(value);
    // Mantiene ?q= en la URL (compartible / al volver atrás) sin recargar datos.
    const url = new URL(window.location.href);
    if (value.trim()) url.searchParams.set("q", value.trim());
    else url.searchParams.delete("q");
    url.searchParams.delete("new");
    window.history.replaceState(null, "", url);
  }

  const shell = "overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-lg">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Cliente, RUT, patente o modelo (ej: Panigale, JKL·12)…"
            aria-label="Buscar clientes por nombre, RUT, teléfono, patente o modelo de moto"
            className="h-9 pr-8 pl-8"
            autoFocus={Boolean(initialQuery)}
          />
          {query ? (
            <button
              type="button"
              onClick={() => handleSearch("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Limpiar búsqueda"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        <Button size="lg" className="h-9 px-3 sm:ml-auto" onClick={() => setSheetOpen(true)}>
          <UserPlus data-icon="inline-start" />
          Nuevo cliente
        </Button>
      </div>

      {visible.length === 0 ? (
        <div className={cn(shell, "flex flex-col items-center gap-3 px-4 py-16 text-center")}>
          <span className="flex size-11 items-center justify-center rounded-xl bg-muted">
            <Users className="size-5 text-muted-foreground" aria-hidden />
          </span>
          <div className="grid gap-1">
            <p className="font-medium">{query ? "Ningún cliente coincide" : "Todavía no hay clientes"}</p>
            <p className="text-sm text-muted-foreground">
              {query ? "Prueba con el RUT, la patente o el modelo de la moto." : "Registra el primer cliente del taller."}
            </p>
          </div>
          {query ? (
            <Button variant="outline" size="sm" onClick={() => handleSearch("")}>
              Limpiar búsqueda
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          {/* Escritorio: tabla */}
          <div className={cn(shell, "hidden md:block")}>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="pl-4">Cliente</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Motos</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Visitas</TableHead>
                  <TableHead className="pr-4">Última visita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("a")) return;
                      router.push(`/dashboard/customers/${c.id}`);
                    }}
                  >
                    <TableCell className="max-w-64 pl-4">
                      <Link
                        href={`/dashboard/customers/${c.id}`}
                        className="block truncate font-medium hover:underline hover:underline-offset-4"
                      >
                        {c.name}
                      </Link>
                      <span className="font-mono text-xs text-muted-foreground">{c.rut ? formatRut(c.rut) : "Sin RUT"}</span>
                    </TableCell>
                    <TableCell className="max-w-56">
                      <p className="truncate">{c.phone ?? <span className="text-muted-foreground">Sin teléfono</span>}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.city ?? "—"}</p>
                    </TableCell>
                    <TableCell className="max-w-80">
                      <MotoChips motorcycles={c.motorcycles} />
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums lg:table-cell">{c.order_count}</TableCell>
                    <TableCell className="pr-4">
                      <LastVisit at={c.last_visit_at} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Móvil: tarjetas */}
          <ul className="grid gap-2 md:hidden">
            {visible.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/dashboard/customers/${c.id}`}
                  className="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10 active:bg-muted/60"
                >
                  <div className="grid min-w-0 flex-1 gap-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-medium">{c.name}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {c.last_visit_at ? formatRelativeDays(new Date(c.last_visit_at)) : "Sin visitas"}
                      </span>
                    </div>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {c.rut ? <span className="font-mono">{formatRut(c.rut)}</span> : null}
                      {c.phone ? (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="size-3" aria-hidden />
                          {c.phone}
                        </span>
                      ) : null}
                      {c.city ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" aria-hidden />
                          {c.city}
                        </span>
                      ) : null}
                    </p>
                    <MotoChips motorcycles={c.motorcycles} />
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        {visible.length === customers.length
          ? `${customers.length} clientes`
          : `${visible.length} de ${customers.length} clientes`}
      </p>

      <CustomerFormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open && openNew) handleSearch(query);
        }}
        customer={null}
      />
    </div>
  );
}

function MotoChips({ motorcycles }: { motorcycles: CustomerSummary["motorcycles"] }) {
  if (motorcycles.length === 0) {
    return <span className="text-xs text-muted-foreground">Sin motos registradas</span>;
  }
  const extra = motorcycles.length - MAX_MOTOS_SHOWN;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={`${motorcycles.length} motos`}>
      {motorcycles.slice(0, MAX_MOTOS_SHOWN).map((m) => (
        <li
          key={m.plate}
          className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-muted/60 px-1.5 py-0.5 text-xs ring-1 ring-foreground/10"
        >
          <Bike className="size-3 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">
            {m.brand} {m.model}
          </span>
          <span className="font-mono text-muted-foreground">{formatPlate(m.plate)}</span>
        </li>
      ))}
      {extra > 0 ? <li className="self-center text-xs text-muted-foreground">+{extra}</li> : null}
    </ul>
  );
}

function LastVisit({ at }: { at: string | null }) {
  if (!at) return <span className="text-sm text-muted-foreground">Sin visitas</span>;
  const date = new Date(at);
  return (
    <div className="grid">
      <span className="text-sm">{formatRelativeDays(date)}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{formatDate(date)}</span>
    </div>
  );
}
