"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, CircleCheck, Inbox, LoaderCircle, X } from "lucide-react";
import { approveQuotation, rejectQuotation } from "@/app/actions/admin";
import { useConfirm } from "@/components/confirm-dialog";
import { QuoteBreakdown } from "@/components/quotations/quote-breakdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { quotationRef } from "@/lib/quotations/summary";
import { QUOTATION_STATUS_LABEL, type Quotation } from "@/lib/quotations/types";
import { cn } from "@/lib/utils";
import { HARDWARE, PLANS, SETUPS } from "@/lib/workshops/plans";
import { ActivationLink } from "./activation-link";

type Created = { name: string; adminEmail: string; activationPath: string };

/** Cotizaciones del formulario público de /login: aprobar (crea el taller) o rechazar. */
export function QuotationsInbox({ quotations, isDemo }: { quotations: Quotation[]; isDemo: boolean }) {
  const [filter, setFilter] = useState<"pending" | "processed">("pending");
  const [reviewing, setReviewing] = useState<Quotation | null>(null);
  const pending = quotations.filter((q) => q.status === "pending");
  const rows = filter === "pending" ? pending : quotations.filter((q) => q.status !== "pending");

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-1">
          <CardTitle>Cotizaciones recibidas</CardTitle>
          <CardDescription>Solicitudes del catálogo público de /login. Al aprobar se crea el taller y su enlace de activación.</CardDescription>
        </div>
        <div role="radiogroup" aria-label="Filtrar cotizaciones" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm">
          {(
            [
              ["pending", `Pendientes (${pending.length})`],
              ["processed", "Procesadas"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                "h-7 rounded-md px-3 font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                filter === value ? "bg-background shadow-sm ring-1 ring-foreground/10" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="grid justify-items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <Inbox className="size-6" aria-hidden />
            {filter === "pending" ? "No hay cotizaciones pendientes." : "Aún no se procesa ninguna cotización."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prospecto</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Equipamiento</TableHead>
                <TableHead className="text-right">Inicial</TableHead>
                <TableHead className="text-right">Mensual</TableHead>
                <TableHead>Recibida</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((q) => (
                <TableRow key={q.id}>
                  <TableCell>
                    <div className="grid leading-tight">
                      <span className="font-medium">{q.workshop_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {q.contact_name} · {q.email} · {q.phone}
                        {q.comuna ? ` · ${q.comuna}` : ""}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="grid leading-tight">
                      <span>{PLANS[q.plan_type].label}</span>
                      <span className="text-xs text-muted-foreground">Setup {SETUPS[q.setup_type].short}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {q.selected_hardware.length
                      ? q.selected_hardware.map((h) => `${h.qty} × ${HARDWARE[h.sku].label}`).join(", ")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatCurrency(q.estimated_total_clp)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(q.monthly_clp)}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap text-muted-foreground">{formatDateTime(new Date(q.created_at))}</TableCell>
                  <TableCell className="text-right">
                    {q.status === "pending" ? (
                      <Button size="sm" onClick={() => setReviewing(q)}>
                        Revisar
                      </Button>
                    ) : (
                      <Badge variant={q.status === "approved" ? "secondary" : "outline"}>{QUOTATION_STATUS_LABEL[q.status]}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={reviewing !== null} onOpenChange={(open) => !open && setReviewing(null)}>
        <DialogContent className="max-h-[92svh] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-2xl">
          {reviewing ? <ReviewBody key={reviewing.id} quotation={reviewing} isDemo={isDemo} onDone={() => setReviewing(null)} /> : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ReviewBody({ quotation: q, isDemo, onDone }: { quotation: Quotation; isDemo: boolean; onDone: () => void }) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [created, setCreated] = useState<Created | null>(null);
  const [approving, startApprove] = useTransition();
  const [rejecting, startReject] = useTransition();
  const busy = approving || rejecting;

  function approve() {
    startApprove(async () => {
      const result = await approveQuotation(q.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.data.name} creado`);
      setCreated(result.data);
      router.refresh();
    });
  }

  async function reject() {
    const ok = await confirm({
      title: `¿Rechazar la cotización de ${q.workshop_name}?`,
      description: "Queda en «Procesadas» y no se crea el taller.",
      confirmLabel: "Rechazar",
      destructive: true,
    });
    if (!ok) return;
    startReject(async () => {
      const result = await rejectQuotation(q.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Cotización rechazada");
      router.refresh();
      onDone();
    });
  }

  if (created) {
    return (
      <>
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2">
            <CircleCheck className="size-5 text-status-good" aria-hidden />
            {created.name} creado
          </DialogTitle>
          <DialogDescription>
            Cotización aprobada. Comparte el enlace con {q.contact_name}: al abrirlo crea su contraseña y entra directo al onboarding.
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-4 grid min-h-0 content-start gap-3 overflow-y-auto px-4 py-1">
          <ActivationLink path={created.activationPath} email={created.adminEmail} workshopName={created.name} />
          {isDemo ? (
            <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Modo demo:</span> abre el enlace en otra ventana (o en incógnito) para
              activar la cuenta al instante.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" onClick={onDone}>
            Listo
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader className="pr-8">
        <DialogTitle>{q.workshop_name}</DialogTitle>
        <DialogDescription>
          Cotización N° <span className="font-mono">{quotationRef(q.id)}</span> · recibida el {formatDateTime(new Date(q.created_at))}
        </DialogDescription>
      </DialogHeader>
      <div className="-mx-4 grid min-h-0 content-start gap-4 overflow-y-auto px-4 py-1">
        <dl className="grid gap-x-6 gap-y-3 rounded-xl border p-4 text-sm sm:grid-cols-2">
          <Summary label="Taller" value={[q.workshop_name, q.comuna].filter(Boolean).join(" · ")} />
          <Summary label="Administrador (contacto)" value={`${q.contact_name} · ${q.email}`} />
          <Summary label="Teléfono" value={q.phone} />
          <Summary label="Plan · setup" value={`${PLANS[q.plan_type].label} · ${SETUPS[q.setup_type].label}`} />
        </dl>
        <QuoteBreakdown plan={q.plan_type} setup={q.setup_type} hardware={q.selected_hardware} />
        <p className="text-xs text-muted-foreground">
          Al aprobar se crea el taller con el plan y la modalidad cotizados (onboarding pendiente) y {q.email} queda invitado como
          administrador. El equipamiento se coordina y cobra aparte.
        </p>
      </div>
      <DialogFooter className="sm:justify-between">
        <Button type="button" variant="outline" onClick={reject} disabled={busy}>
          {rejecting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <X data-icon="inline-start" />}
          Rechazar
        </Button>
        <Button type="button" onClick={approve} disabled={busy}>
          {approving ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Check data-icon="inline-start" />}
          Aprobar y crear taller
        </Button>
      </DialogFooter>
      {confirmDialog}
    </>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value || "—"}</dd>
    </div>
  );
}
