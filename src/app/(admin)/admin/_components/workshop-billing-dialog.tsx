"use client";

import { useCallback, useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, CreditCard, KeyRound, LoaderCircle, Pencil, Play, Plus, Receipt } from "lucide-react";
import {
  changeWorkshopPlan,
  getWorkshopAccount,
  reactivateWorkshop,
  recordWorkshopPayment,
  regenerateActivationLink,
  suspendWorkshop,
} from "@/app/actions/billing";
import { BillingStatusBadge, formatDueDate } from "@/components/admin/billing-status-badge";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { FieldErrors } from "@/lib/action-result";
import {
  BILLING_METHOD_LABEL,
  BILLING_METHODS,
  PAYMENT_CONCEPT,
  PAYMENT_CONCEPTS,
  nextDueAfterPayment,
  suggestedAmount,
  withTax,
  type BillingMethod,
  type PaymentConcept,
} from "@/lib/billing/shared";
import type { WorkshopAccount } from "@/lib/billing/types";
import { daysBetween, todayKey } from "@/lib/datetime";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PLAN_KEYS, PLANS, SETUP_TYPES, SETUPS, type PlanKey, type SetupType } from "@/lib/workshops/plans";
import { ActivationLink } from "./activation-link";

/** Botón «Facturación» + ficha de cobro del taller (solo en /admin). */
export function WorkshopBillingButton({ workshopId, workshopName }: { workshopId: string; workshopName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)} aria-label={`Facturación y cobro de ${workshopName}`}>
        <Receipt data-icon="inline-start" />
        Facturación
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92svh] grid-rows-[auto_minmax(0,1fr)] sm:max-w-4xl">
          {open ? <BillingPanel workshopId={workshopId} workshopName={workshopName} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

type Panel = "payment" | "suspend" | "plan" | null;

function BillingPanel({ workshopId, workshopName }: { workshopId: string; workshopName: string }) {
  const router = useRouter();
  const [account, setAccount] = useState<WorkshopAccount | null>(null);
  const [failed, setFailed] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [link, setLink] = useState<{ path: string; email: string } | null>(null);
  const [loading, startLoading] = useTransition();
  const [busy, startBusy] = useTransition();

  const load = useCallback(() => {
    startLoading(async () => {
      const next = await getWorkshopAccount(workshopId);
      setAccount(next);
      setFailed(next === null);
    });
  }, [workshopId]);

  useEffect(() => {
    load();
  }, [load]);

  /** Tras una escritura: recarga la ficha y el directorio (badge de estado, plan). */
  function done(message: string) {
    toast.success(message);
    setPanel(null);
    load();
    router.refresh();
  }

  if (!account) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Facturación y Cobro · {workshopName}</DialogTitle>
          <DialogDescription>{failed ? "No se pudo cargar la ficha del taller." : "Cargando…"}</DialogDescription>
        </DialogHeader>
        <div className="grid place-items-center py-12 text-muted-foreground">
          {failed ? null : <LoaderCircle className="size-6 animate-spin" aria-label="Cargando" />}
        </div>
      </>
    );
  }

  const w = account.workshop;
  const today = todayKey();
  const dueIn = w.next_due_at ? daysBetween(today, w.next_due_at) : null;

  return (
    <>
      <DialogHeader className="pr-8">
        <DialogTitle className="flex flex-wrap items-center gap-2">
          Facturación y Cobro · {w.name}
          <BillingStatusBadge status={account.status} />
          {loading ? <LoaderCircle className="size-4 animate-spin text-muted-foreground" aria-label="Actualizando" /> : null}
        </DialogTitle>
        <DialogDescription>
          {w.next_due_at
            ? `Próximo vencimiento: ${formatDueDate(w.next_due_at)} (${dueIn! >= 0 ? `en ${dueIn} días` : `hace ${-dueIn!} días`})`
            : "Sin pagos registrados: la suscripción aún no tiene vencimiento."}
        </DialogDescription>
      </DialogHeader>

      <div className="-mx-4 grid min-h-0 content-start gap-4 overflow-y-auto px-4 pb-1">
        {w.suspended_at ? (
          <p className="rounded-lg bg-foreground px-3 py-2 text-sm text-background">
            <span className="font-medium">Suspendido</span> desde el {formatDueDate(w.suspended_at.slice(0, 10))}
            {w.suspension_reason ? ` · ${w.suspension_reason}` : ""}. Su staff solo ve la pantalla de suspensión.
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Plan e implementación */}
          <section className="grid content-start gap-2 rounded-xl border p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Plan e implementación</h3>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPanel(panel === "plan" ? null : "plan")}>
                <Pencil data-icon="inline-start" />
                Cambiar
              </Button>
            </div>
            <p className="text-2xl font-semibold tracking-tight">
              {PLANS[w.plan].label} <span className="text-base font-normal text-muted-foreground">{formatCurrency(PLANS[w.plan].monthly)}/mes</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {SETUPS[w.setup_type].label}
              {w.setup_type === "turnkey" ? ` · setup ${formatCurrency(w.setup_fee)}` : ""}
            </p>
            {panel === "plan" ? (
              <PlanForm
                key={`${w.plan}-${w.setup_type}`}
                plan={w.plan}
                setup={w.setup_type}
                busy={busy}
                onCancel={() => setPanel(null)}
                onSubmit={(plan, setup_type) =>
                  startBusy(async () => {
                    const r = await changeWorkshopPlan(w.id, { plan, setup_type });
                    if (r.ok) done("Plan actualizado");
                    else toast.error(r.error);
                  })
                }
              />
            ) : null}
          </section>

          {/* Cobro */}
          <section className="grid content-start gap-2 rounded-xl border p-4">
            <h3 className="text-sm font-medium">Cobro</h3>
            <p className="text-sm text-muted-foreground">
              Registra una mensualidad (+1 mes), anualidad (+1 año) o el setup VIP. El vencimiento se actualiza solo.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => setPanel(panel === "payment" ? null : "payment")}>
                <Plus data-icon="inline-start" />
                Registrar pago
              </Button>
              {w.suspended_at ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    startBusy(async () => {
                      const r = await reactivateWorkshop(w.id);
                      if (r.ok) done("Taller reactivado");
                      else toast.error(r.error);
                    })
                  }
                >
                  <Play data-icon="inline-start" />
                  Reactivar acceso
                </Button>
              ) : (
                <Button type="button" variant="outline" className="text-status-critical" onClick={() => setPanel(panel === "suspend" ? null : "suspend")}>
                  <Ban data-icon="inline-start" />
                  Suspender taller por mora
                </Button>
              )}
            </div>
          </section>
        </div>

        {panel === "payment" ? (
          <PaymentForm
            account={account}
            busy={busy}
            onCancel={() => setPanel(null)}
            onSubmit={(values, setErrors) =>
              startBusy(async () => {
                const r = await recordWorkshopPayment(w.id, values);
                if (r.ok) done(`Pago registrado · ${formatCurrency(r.data.amount)}`);
                else {
                  setErrors(r.fieldErrors ?? {});
                  toast.error(r.error);
                }
              })
            }
          />
        ) : null}

        {panel === "suspend" ? (
          <SuspendForm
            busy={busy}
            onCancel={() => setPanel(null)}
            onSubmit={(reason, setErrors) =>
              startBusy(async () => {
                const r = await suspendWorkshop(w.id, { reason });
                if (r.ok) done("Taller suspendido");
                else {
                  setErrors(r.fieldErrors ?? {});
                  toast.error(r.error);
                }
              })
            }
          />
        ) : null}

        {account.pendingInvite ? (
          <section className="grid gap-2 rounded-xl border border-dashed p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">
                <KeyRound className="mr-1.5 inline size-4 text-muted-foreground" aria-hidden />
                Administrador pendiente de activar: <span className="font-medium">{account.pendingInvite.name}</span> ·{" "}
                <span className="font-mono text-xs">{account.pendingInvite.email}</span>
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  startBusy(async () => {
                    const r = await regenerateActivationLink(w.id);
                    if (r.ok) setLink({ path: r.data.activationPath, email: r.data.email });
                    else toast.error(r.error);
                  })
                }
              >
                Generar nuevo enlace
              </Button>
            </div>
            {link ? <ActivationLink path={link.path} email={link.email} workshopName={w.name} /> : null}
          </section>
        ) : null}

        <section className="grid gap-2">
          <h3 className="text-sm font-medium">Historial de transacciones</h3>
          {account.payments.length === 0 ? (
            <p className="rounded-xl border py-8 text-center text-sm text-muted-foreground">Sin pagos registrados.</p>
          ) : (
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right">Neto</TableHead>
                    <TableHead className="text-right">IVA</TableHead>
                    <TableHead className="text-right">Total CLP</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {account.payments.map((p) => {
                    const { net, tax } = withTax(p.amount);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="whitespace-nowrap tabular-nums">{formatDueDate(p.paid_at)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {PAYMENT_CONCEPT[p.concept].label}
                          {p.next_due_at && p.concept !== "setup" ? (
                            <span className="block text-xs text-muted-foreground">vence {formatDueDate(p.next_due_at)}</span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(net)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(tax)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatCurrency(p.amount)}</TableCell>
                        <TableCell>{BILLING_METHOD_LABEL[p.method]}</TableCell>
                        <TableCell className="max-w-56 truncate text-muted-foreground" title={p.notes ?? undefined}>
                          {p.notes ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function PlanForm({
  plan: initialPlan,
  setup: initialSetup,
  busy,
  onCancel,
  onSubmit,
}: {
  plan: PlanKey;
  setup: SetupType;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (plan: PlanKey, setup: SetupType) => void;
}) {
  const uid = useId();
  const [plan, setPlan] = useState(initialPlan);
  const [setup, setSetup] = useState(initialSetup);
  const unchanged = plan === initialPlan && setup === initialSetup;
  return (
    <div className="mt-1 grid gap-3 rounded-lg bg-muted/50 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Plan" htmlFor={`${uid}-plan`}>
          <NativeSelect id={`${uid}-plan`} value={plan} onChange={(e) => setPlan(e.target.value as PlanKey)} className="w-full">
            {PLAN_KEYS.map((k) => (
              <option key={k} value={k}>
                {PLANS[k].label} · {formatCurrency(PLANS[k].monthly)}/mes
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Modalidad" htmlFor={`${uid}-setup`}>
          <NativeSelect id={`${uid}-setup`} value={setup} onChange={(e) => setSetup(e.target.value as SetupType)} className="w-full">
            {SETUP_TYPES.map((k) => (
              <option key={k} value={k}>
                {SETUPS[k].label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      {setup === "turnkey" && initialSetup === "diy" ? (
        <p className="text-xs text-muted-foreground">
          Pasa a Llave en Mano: el setup de {formatCurrency(SETUPS.turnkey.fee)} queda por cobrar (regístralo con «Registrar pago»).
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" size="sm" disabled={busy || unchanged} onClick={() => onSubmit(plan, setup)}>
          Guardar cambio
        </Button>
      </div>
    </div>
  );
}

function PaymentForm({
  account,
  busy,
  onCancel,
  onSubmit,
}: {
  account: WorkshopAccount;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (values: Record<string, unknown>, setErrors: (e: FieldErrors) => void) => void;
}) {
  const uid = useId();
  const w = account.workshop;
  const [concept, setConcept] = useState<PaymentConcept>("monthly");
  const [amount, setAmount] = useState(() => suggestedAmount("monthly", w.plan, w.setup_fee));
  const [method, setMethod] = useState<BillingMethod>("transfer");
  const [paidAt, setPaidAt] = useState(todayKey);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  const nextDue = paidAt ? nextDueAfterPayment(w.next_due_at, paidAt, concept) : w.next_due_at;
  const { net, tax } = withTax(Number.isFinite(amount) ? amount : 0);

  function pickConcept(next: PaymentConcept) {
    setConcept(next);
    setAmount(suggestedAmount(next, w.plan, w.setup_fee));
  }

  return (
    <section aria-label="Registrar pago" className="grid gap-3 rounded-xl border bg-muted/30 p-4">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <CreditCard className="size-4 text-muted-foreground" aria-hidden />
        Registrar pago
      </h3>
      <div role="radiogroup" aria-label="Concepto" className="flex flex-wrap gap-1 rounded-lg bg-muted p-0.5">
        {PAYMENT_CONCEPTS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={concept === c}
            onClick={() => pickConcept(c)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              concept === c ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {PAYMENT_CONCEPT[c].label}
            <span className="ml-1 text-xs text-muted-foreground">
              {c === "monthly" ? "+1 mes" : c === "annual" ? "+1 año" : "pago único"}
            </span>
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Monto (CLP, IVA incluido)" htmlFor={`${uid}-amount`} error={errors.amount?.[0]} className="sm:col-span-2">
          <Input
            id={`${uid}-amount`}
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={Number.isFinite(amount) ? amount : ""}
            onChange={(e) => setAmount(e.target.valueAsNumber)}
          />
        </Field>
        <Field label="Método" htmlFor={`${uid}-method`} error={errors.method?.[0]}>
          <NativeSelect id={`${uid}-method`} value={method} onChange={(e) => setMethod(e.target.value as BillingMethod)} className="w-full">
            {BILLING_METHODS.map((m) => (
              <option key={m} value={m}>
                {BILLING_METHOD_LABEL[m]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Fecha de pago" htmlFor={`${uid}-date`} error={errors.paid_at?.[0]}>
          <Input id={`${uid}-date`} type="date" max={todayKey()} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </Field>
        <Field label="Notas" htmlFor={`${uid}-notes`} error={errors.notes?.[0]} hint="N° de transferencia, factura, etc." className="sm:col-span-4">
          <Textarea id={`${uid}-notes`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-background px-3 py-2 text-sm">
        <span className="tabular-nums text-muted-foreground">
          Neto {formatCurrency(net)} + IVA {formatCurrency(tax)} ={" "}
          <span className="font-semibold text-foreground">{formatCurrency(Number.isFinite(amount) ? amount : 0)}</span>
        </span>
        <span className="text-muted-foreground">
          Vencimiento: {w.next_due_at ? formatDueDate(w.next_due_at) : "—"} →{" "}
          <span className="font-medium text-foreground">{nextDue ? formatDueDate(nextDue) : "—"}</span>
        </span>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="button"
          disabled={busy}
          onClick={() => onSubmit({ concept, amount, method, paid_at: paidAt, notes }, setErrors)}
        >
          {busy ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
          Registrar pago
        </Button>
      </div>
    </section>
  );
}

function SuspendForm({
  busy,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (reason: string, setErrors: (e: FieldErrors) => void) => void;
}) {
  const uid = useId();
  const [reason, setReason] = useState("Mensualidad impaga");
  const [errors, setErrors] = useState<FieldErrors>({});
  return (
    <section aria-label="Suspender taller" className="grid gap-3 rounded-xl border border-status-critical/30 bg-status-critical/5 p-4">
      <p className="text-sm">
        <span className="font-medium">Suspender el acceso:</span> el staff del taller verá una pantalla de bloqueo en lugar del
        panel. Los datos no se tocan y puedes reactivarlo en cualquier momento. El modo soporte sigue disponible.
      </p>
      <Field label="Motivo (lo verá el taller)" htmlFor={`${uid}-reason`} error={errors.reason?.[0]}>
        <Input id={`${uid}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" variant="destructive" disabled={busy} onClick={() => onSubmit(reason, setErrors)}>
          <Ban data-icon="inline-start" />
          Suspender taller
        </Button>
      </div>
    </section>
  );
}
