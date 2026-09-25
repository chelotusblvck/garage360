"use client";

import { useState } from "react";
import { CircleCheck, LoaderCircle, Mail, Printer } from "lucide-react";
import { toast } from "sonner";
import { processPosSale } from "@/app/actions/pos";
import { broadcastSalesChange } from "@/components/live-refresh";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import type { Customer } from "@/lib/orders/types";
import { PAYMENT_METHOD_LABEL } from "@/lib/sales/shared";
import { saleChange, ticketMailto } from "@/lib/sales/ticket";
import type { SaleDetail } from "@/lib/sales/types";
import { cn } from "@/lib/utils";
import type { PosPaymentMethod } from "@/lib/validations/schemas";
import type { PosLine } from "./pos-terminal";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lines: PosLine[];
  totals: { subtotal: number; tax: number; total: number };
  method: PosPaymentMethod;
  customer: Customer | null;
  applyTax: boolean;
  taxLabel: string;
  /** La venta quedó registrada: el terminal limpia el carrito. */
  onSold: () => void;
};

/** Billetes sugeridos para cobrar en efectivo (monto exacto + redondeos hacia arriba). */
function cashSuggestions(total: number) {
  const steps = [1_000, 5_000, 10_000, 20_000, 50_000];
  const values = new Set<number>([total]);
  for (const step of steps) values.add(Math.ceil(total / step) * step);
  return [...values].sort((a, b) => a - b).slice(0, 5);
}

export function PosCheckoutDialog({ open, onOpenChange, ...props }: Props) {
  const [sale, setSale] = useState<SaleDetail | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        {sale ? (
          <SaleDone sale={sale} fallbackEmail={props.customer?.email ?? ""} onClose={() => onOpenChange(false)} />
        ) : (
          <ConfirmSale
            {...props}
            onCancel={() => onOpenChange(false)}
            onDone={(result) => {
              setSale(result);
              props.onSold();
              broadcastSalesChange();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ConfirmSale({
  lines,
  totals,
  method,
  customer,
  applyTax,
  taxLabel,
  onCancel,
  onDone,
}: Omit<Props, "open" | "onOpenChange" | "onSold"> & { onCancel: () => void; onDone: (sale: SaleDetail) => void }) {
  const [tendered, setTendered] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCash = method === "cash";
  const received = tendered.trim() === "" ? totals.total : Number(tendered.replace(",", "."));
  const invalidCash = isCash && (!Number.isFinite(received) || received < totals.total);
  const change = isCash && !invalidCash ? received - totals.total : 0;
  const units = lines.reduce((sum, l) => sum + l.quantity, 0);

  async function confirm() {
    if (invalidCash || submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await processPosSale(
      lines.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
      method,
      customer?.id ?? null,
      { applyTax, amountTendered: isCash ? received : null }
    );
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success(`Venta ${result.data.folio} registrada`);
    onDone(result.data);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void confirm();
      }}
    >
      <DialogHeader className="border-b p-4 pr-12">
        <DialogTitle>Confirmar cobro</DialogTitle>
        <DialogDescription>
          {units === 1 ? "1 unidad" : `${units} unidades`} · {customer ? customer.name : "Consumidor final"}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 p-4">
        <dl className="grid gap-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular-nums">{formatCurrency(totals.subtotal)}</dd>
          </div>
          {applyTax ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{taxLabel}</dt>
              <dd className="tabular-nums">{formatCurrency(totals.tax)}</dd>
            </div>
          ) : null}
          <div className="flex items-baseline justify-between border-t pt-2">
            <dt className="font-medium">Total a cobrar</dt>
            <dd className="text-3xl font-semibold tracking-tight tabular-nums">{formatCurrency(totals.total)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Método de pago</dt>
            <dd className="font-medium">{PAYMENT_METHOD_LABEL[method]}</dd>
          </div>
        </dl>

        {isCash ? (
          <div className="grid gap-2 rounded-lg bg-muted/50 p-3 ring-1 ring-foreground/10">
            <Label htmlFor="pos-tendered">Efectivo recibido</Label>
            <Input
              id="pos-tendered"
              autoFocus
              inputMode="decimal"
              value={tendered}
              onChange={(e) => setTendered(e.target.value.replace(/[^\d.,]/g, ""))}
              placeholder={`${totals.total} (exacto)`}
              aria-invalid={invalidCash || undefined}
              aria-describedby="pos-change"
              className="h-10 text-lg tabular-nums md:text-lg"
            />
            <div className="flex flex-wrap gap-1.5">
              {cashSuggestions(totals.total).map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTendered(String(value))}
                  className="tabular-nums"
                >
                  {value === totals.total ? "Exacto" : formatCurrency(value)}
                </Button>
              ))}
            </div>
            <p
              id="pos-change"
              aria-live="polite"
              className={cn(
                "flex items-baseline justify-between pt-1 text-sm",
                invalidCash ? "text-status-critical" : "text-foreground"
              )}
            >
              {invalidCash ? (
                <>Falta {formatCurrency(Math.max(0, totals.total - (Number.isFinite(received) ? received : 0)))}</>
              ) : (
                <>
                  <span className="text-muted-foreground">Vuelto</span>
                  <span className="text-2xl font-semibold tabular-nums">{formatCurrency(change)}</span>
                </>
              )}
            </p>
          </div>
        ) : (
          <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground ring-1 ring-foreground/10">
            {method === "transfer"
              ? "Verifica que la transferencia se haya acreditado antes de confirmar."
              : "Cobra con el posnet y confirma cuando la operación esté aprobada."}
          </p>
        )}

        {error ? (
          <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      <DialogFooter className="m-0 rounded-b-xl">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Volver
        </Button>
        <Button type="submit" disabled={invalidCash || submitting} autoFocus={!isCash}>
          {submitting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
          Confirmar venta
        </Button>
      </DialogFooter>
    </form>
  );
}

function SaleDone({ sale, fallbackEmail, onClose }: { sale: SaleDetail; fallbackEmail: string; onClose: () => void }) {
  const [email, setEmail] = useState(sale.customer.email ?? fallbackEmail);
  const change = saleChange(sale);
  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  return (
    <>
      <div className="grid justify-items-center gap-2 border-b p-6 text-center">
        <CircleCheck className="size-10 text-status-good" aria-hidden />
        <DialogTitle className="text-lg">Venta registrada</DialogTitle>
        <DialogDescription>
          Ticket <span className="font-mono font-semibold text-foreground">{sale.folio}</span> ·{" "}
          {sale.payment_method ? PAYMENT_METHOD_LABEL[sale.payment_method] : ""} · {formatCurrency(sale.total)}
        </DialogDescription>
        {change !== null ? (
          <div className="mt-2 grid w-full gap-0.5 rounded-lg bg-muted/60 p-3 ring-1 ring-foreground/10">
            <span className="text-xs text-muted-foreground">
              Recibido {formatCurrency(sale.amount_tendered ?? 0)} · entregar vuelto
            </span>
            <span className="text-3xl font-semibold tracking-tight tabular-nums">{formatCurrency(change)}</span>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 p-4">
        <Button
          variant="outline"
          onClick={() => window.open(`/print/sales/${sale.id}?print=1`, "_blank", "noopener")}
          className="h-10"
        >
          <Printer data-icon="inline-start" />
          Imprimir ticket
        </Button>
        <form
          className="grid gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!validEmail) return;
            window.location.href = ticketMailto(sale, email.trim());
          }}
        >
          <Label htmlFor="pos-ticket-email">Enviar ticket por email</Label>
          <div className="flex gap-2">
            <Input
              id="pos-ticket-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@email.com"
              className="h-9"
            />
            <Button type="submit" variant="outline" className="h-9" disabled={!validEmail}>
              <Mail data-icon="inline-start" />
              Enviar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Se abre tu cliente de correo con el ticket listo para enviar.</p>
        </form>
      </div>

      <DialogFooter className="m-0 rounded-b-xl">
        <Button autoFocus onClick={onClose} className="h-10 sm:min-w-40">
          Nueva venta
        </Button>
      </DialogFooter>
    </>
  );
}
