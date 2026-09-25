"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { adjustStock, getStockMovements } from "@/app/actions/inventory";
import { Field, fieldAria } from "@/components/forms/field";
import { ProductThumb } from "@/components/inventory/product-thumb";
import { StockStatusBadge } from "@/components/inventory/stock-status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ActionResult } from "@/lib/action-result";
import { formatDateTime } from "@/lib/format";
import { getStockStatus, MOVEMENT_REASON_LABEL } from "@/lib/inventory/constants";
import type { Product, StockMovement } from "@/lib/inventory/types";
import { cn } from "@/lib/utils";
import {
  REASONS_BY_TYPE,
  stockAdjustmentSchema,
  type StockAdjustmentInput,
  type StockAdjustmentValues,
  type StockMovementType,
} from "@/lib/validations/schemas";

export type StockDialogSection = "adjust" | "history";

type StockDialogProps = {
  product: Product | null;
  section: StockDialogSection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function StockDialog({ product, section, open, onOpenChange }: StockDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        {product ? <StockDialogBody key={product.id} product={product} section={section} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function StockDialogBody({ product: initial, section }: { product: Product; section: StockDialogSection }) {
  const [product, setProduct] = useState(initial);
  const [history, setHistory] = useState<ActionResult<StockMovement[]> | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const historyRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    getStockMovements(initial.id).then((result) => {
      if (!cancelled) setHistory(result);
    });
    return () => {
      cancelled = true;
    };
  }, [initial.id, historyVersion]);

  useEffect(() => {
    if (section === "history") {
      historyRef.current?.scrollIntoView({ block: "start" });
    }
  }, [section]);

  return (
    <>
      <DialogHeader className="border-b p-4 pr-12">
        <div className="flex items-center gap-3">
          <ProductThumb src={product.image_url} alt={product.name} className="size-12" />
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate leading-snug">{product.name}</DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {product.sku} · {product.category}
            </DialogDescription>
          </div>
          <div className="grid justify-items-end gap-1">
            <p className="text-2xl leading-none font-semibold tabular-nums">
              {product.stock}
              <span className="ml-1 text-sm font-normal text-muted-foreground">u.</span>
            </p>
            <StockStatusBadge status={product.stock_status} />
          </div>
        </div>
      </DialogHeader>

      <AdjustForm
        product={product}
        autoFocus={section === "adjust"}
        onAdjusted={(updated) => {
          setProduct(updated);
          setHistoryVersion((v) => v + 1);
        }}
      />

      <section ref={historyRef} aria-labelledby="stock-history-title" className="border-t p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 id="stock-history-title" className="font-medium">
            Historial de movimientos
          </h3>
          <span className="text-xs text-muted-foreground">Últimos 25</span>
        </div>
        <MovementsTable history={history} />
      </section>
    </>
  );
}

function AdjustForm({
  product,
  autoFocus,
  onAdjusted,
}: {
  product: Product;
  autoFocus: boolean;
  onAdjusted: (product: Product) => void;
}) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  const form = useForm<StockAdjustmentValues, unknown, StockAdjustmentInput>({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: { type: "in", reason: "purchase", quantity: undefined as unknown as number, note: "" },
  });
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = form;

  const [type, quantity] = useWatch({ control, name: ["type", "quantity"] });
  const qty = typeof quantity === "number" && Number.isInteger(quantity) && quantity > 0 ? quantity : 0;
  const nextStock = product.stock + (type === "in" ? qty : -qty);
  const insufficient = type === "out" && nextStock < 0;

  function selectType(next: StockMovementType) {
    setValue("type", next);
    setValue("reason", REASONS_BY_TYPE[next][0], { shouldValidate: form.formState.isSubmitted });
  }

  const onSubmit = handleSubmit(async (values) => {
    const result = await adjustStock(product.id, values.quantity, values.type, values.reason, values.note);
    if (!result.ok) {
      const message = result.fieldErrors?.quantity?.[0];
      if (message) setError("quantity", { message });
      toast.error(result.error);
      return;
    }
    const sign = values.type === "in" ? "+" : "−";
    toast.success(`Stock actualizado: ${sign}${values.quantity} u. · ${product.name}`);
    // "" vacía el input numérico (undefined dejaría el valor anterior en el DOM).
    reset({ type: values.type, reason: values.reason, quantity: "" as unknown as number, note: "" });
    onAdjusted(result.data);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 p-4">
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Tipo de movimiento</legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          {(
            [
              { value: "in", label: "Entrada", hint: "Suma unidades", icon: ArrowDownToLine },
              { value: "out", label: "Salida / merma", hint: "Resta unidades", icon: ArrowUpFromLine },
            ] as const
          ).map((option) => {
            const active = type === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => selectType(option.value)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active ? "border-foreground bg-muted/60" : "hover:bg-muted/40"
                )}
              >
                <option.icon className={cn("size-4 shrink-0", active ? "text-foreground" : "text-muted-foreground")} aria-hidden />
                <span className="grid">
                  <span className="text-sm font-medium">{option.label}</span>
                  <span className="text-xs text-muted-foreground">{option.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <Field label="Cantidad" htmlFor={id("quantity")} error={errors.quantity?.message}>
          <Input
            {...fieldAria(id("quantity"), errors.quantity?.message)}
            {...register("quantity", { valueAsNumber: true })}
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            placeholder="0"
            autoFocus={autoFocus}
          />
        </Field>
        <Field label="Motivo" htmlFor={id("reason")} error={errors.reason?.message}>
          <NativeSelect
            {...fieldAria(id("reason"), errors.reason?.message)}
            {...register("reason")}
            className="w-full"
          >
            {REASONS_BY_TYPE[type ?? "in"].map((reason) => (
              <NativeSelectOption key={reason} value={reason}>
                {MOVEMENT_REASON_LABEL[reason]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <Field
        label="Detalle (opcional)"
        htmlFor={id("note")}
        error={errors.note?.message}
        hint="Ej: Remito #1234 de Distribuidora Sur, pastilla con fisura, conteo del sábado…"
      >
        <Input
          {...fieldAria(id("note"), errors.note?.message, true)}
          {...register("note")}
          maxLength={200}
          placeholder="Justificación del movimiento"
        />
      </Field>

      <div className="flex flex-col gap-3 rounded-lg bg-muted/50 p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm" aria-live="polite">
          <span className="text-muted-foreground">Stock resultante</span>
          <span className="font-medium tabular-nums">{product.stock}</span>
          <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
          <span className={cn("font-semibold tabular-nums", insufficient && "text-destructive")}>
            {insufficient ? "Insuficiente" : nextStock}
          </span>
          {!insufficient && qty > 0 ? (
            <StockStatusBadge status={getStockStatus(nextStock, product.min_stock)} className="ml-1" />
          ) : null}
        </p>
        <Button type="submit" disabled={isSubmitting || insufficient}>
          {isSubmitting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
          {type === "in" ? "Registrar entrada" : "Registrar salida"}
        </Button>
      </div>
    </form>
  );
}

function MovementsTable({ history }: { history: ActionResult<StockMovement[]> | null }) {
  if (!history) {
    return (
      <div className="grid gap-2" aria-busy="true" aria-label="Cargando historial">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  }
  if (!history.ok) {
    return <p className="text-sm text-destructive">{history.error}</p>;
  }
  if (history.data.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Sin movimientos registrados.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="pl-3">Fecha</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead className="text-right">Cantidad</TableHead>
            <TableHead className="text-right">Saldo</TableHead>
            <TableHead className="hidden pr-3 sm:table-cell">Usuario</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.data.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="pl-3 font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                {formatDateTime(new Date(m.created_at))}
              </TableCell>
              <TableCell className="max-w-56">
                <p className="truncate text-sm">{MOVEMENT_REASON_LABEL[m.reason]}</p>
                {m.note ? <p className="truncate text-xs text-muted-foreground" title={m.note}>{m.note}</p> : null}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right font-medium tabular-nums",
                  m.quantity > 0 ? "text-delta-up" : "text-foreground"
                )}
              >
                {m.quantity > 0 ? `+${m.quantity}` : `−${Math.abs(m.quantity)}`}
              </TableCell>
              <TableCell className="text-right text-muted-foreground tabular-nums">{m.stock_after}</TableCell>
              <TableCell className="hidden pr-3 text-xs text-muted-foreground sm:table-cell">
                {m.created_by_name ?? (m.reason === "sale" || m.reason === "sale_reversal" ? "Sistema de ventas" : "Sistema")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
