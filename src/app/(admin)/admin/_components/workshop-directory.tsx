"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle, LogIn, Search, Store } from "lucide-react";
import { startSupportSession } from "@/app/actions/admin";
import { DiagnosticsButton } from "@/components/admin/diagnostics-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatRut } from "@/lib/format";
import { cn, normalizeText } from "@/lib/utils";
import type { WorkshopSummary } from "@/lib/workshops/types";

function searchText(w: WorkshopSummary) {
  return normalizeText(
    [w.name, w.rut ?? "", w.rut ? formatRut(w.rut) : "", w.city ?? "", w.email ?? "", w.phone ?? "", w.specialty ?? ""].join(" ")
  );
}

/** Directorio de talleres con búsqueda instantánea y acceso de soporte. */
export function WorkshopDirectory({ workshops }: { workshops: WorkshopSummary[] }) {
  const [query, setQuery] = useState("");
  const indexed = useMemo(() => workshops.map((w) => ({ w, text: searchText(w) })), [workshops]);
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);
  const rows = indexed.filter(({ text }) => terms.every((t) => text.includes(t))).map(({ w }) => w);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-1">
          <CardTitle>Directorio de talleres</CardTitle>
          <CardDescription>
            «Ingresar como taller» abre su panel en modo soporte, de solo lectura.
          </CardDescription>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nombre, RUT, comuna o email…"
            aria-label="Buscar talleres por nombre, RUT, comuna, email o especialidad"
            className="pl-8"
          />
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {query ? "Ningún taller coincide con la búsqueda." : "Aún no hay talleres registrados."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Taller</TableHead>
                <TableHead>RUT</TableHead>
                <TableHead>Comuna</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Usuarios</TableHead>
                <TableHead>Alta</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((w) => (
                <TableRow key={w.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      {w.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- logo en data URL
                        <img src={w.logo_url} alt="" className="size-8 shrink-0 rounded-lg object-cover ring-1 ring-foreground/10" />
                      ) : (
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground" aria-hidden>
                          <Store className="size-4" />
                        </span>
                      )}
                      <div className="grid min-w-0 leading-tight">
                        <span className="truncate font-medium">{w.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {[w.specialty, w.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{w.rut ? formatRut(w.rut) : "—"}</TableCell>
                  <TableCell>{w.city ?? "—"}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                        w.onboarding_completed ? "bg-status-good/10 text-status-good" : "bg-muted text-muted-foreground"
                      )}
                    >
                      <span className={cn("size-1.5 rounded-full", w.onboarding_completed ? "bg-status-good" : "bg-muted-foreground")} aria-hidden />
                      {w.onboarding_completed ? "Activo" : "Onboarding pendiente"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{w.users}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(new Date(w.created_at))}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      <DiagnosticsButton workshopId={w.id} workshopName={w.name} />
                      <form action={startSupportSession.bind(null, w.id)}>
                        <SupportButton name={w.name} />
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function SupportButton({ name }: { name: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending} aria-label={`Ingresar como ${name} (modo soporte)`}>
      {pending ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <LogIn data-icon="inline-start" />}
      Ingresar como taller
    </Button>
  );
}
