"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addLaborItem, removeLaborItem } from "@/app/actions/orders";
import { useConfirm } from "@/components/confirm-dialog";
import { fieldAria } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { WorkOrderLabor } from "@/lib/orders/types";
import { cn } from "@/lib/utils";
import { laborItemSchema, type LaborItemInput, type LaborItemValues } from "@/lib/validations/schemas";

const formatHours = (h: number) => `${formatNumber(h)} h`;

export function LaborCard({
  orderId,
  labor,
  subtotal,
  editable,
  hourlyRate,
}: {
  orderId: string;
  labor: WorkOrderLabor[];
  subtotal: number;
  editable: boolean;
  /** Valor hora sugerido del taller (onboarding). */
  hourlyRate: number;
}) {
  const [confirm, confirmDialog] = useConfirm();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function remove(item: WorkOrderLabor) {
    const ok = await confirm({
      title: "¿Quitar este trabajo?",
      description: `«${item.description}» · ${formatCurrency(item.line_total)}`,
      confirmLabel: "Quitar",
      destructive: true,
    });
    if (!ok) return;
    setRemovingId(item.id);
    startTransition(async () => {
      const result = await removeLaborItem(orderId, item.id);
      setRemovingId(null);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mano de obra y servicios</CardTitle>
        <CardDescription>Horas trabajadas por el valor hora del taller.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {labor.length === 0 ? (
          <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            Sin mano de obra registrada.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="pl-3">Trabajo</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Valor hora</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  {editable ? <TableHead className="w-10 pr-3"><span className="sr-only">Acciones</span></TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {labor.map((item) => (
                  <TableRow key={item.id} className={cn(removingId === item.id && "opacity-50")}>
                    <TableCell className="max-w-72 pl-3 whitespace-normal">{item.description}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatHours(item.hours)}</TableCell>
                    <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">
                      {formatCurrency(item.hourly_rate)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatCurrency(item.line_total)}</TableCell>
                    {editable ? (
                      <TableCell className="pr-3">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => remove(item)}
                          disabled={removingId !== null}
                          aria-label={`Quitar ${item.description}`}
                        >
                          {removingId === item.id ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={2} className="pl-3 text-muted-foreground sm:hidden">Subtotal mano de obra</TableCell>
                  <TableCell colSpan={3} className="hidden pl-3 text-muted-foreground sm:table-cell">Subtotal mano de obra</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(subtotal)}</TableCell>
                  {editable ? <TableCell /> : null}
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}

        {editable ? <LaborForm orderId={orderId} hourlyRate={hourlyRate} /> : null}
      </CardContent>
      {confirmDialog}
    </Card>
  );
}

function LaborForm({ orderId, hourlyRate }: { orderId: string; hourlyRate: number }) {
  const form = useForm<LaborItemValues, unknown, LaborItemInput>({
    resolver: zodResolver(laborItemSchema),
    defaultValues: { description: "", hours: 1, hourly_rate: hourlyRate },
  });
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = form;
  const [hours, rate] = useWatch({ control, name: ["hours", "hourly_rate"] });
  const preview = Number.isFinite(hours) && Number.isFinite(rate) && hours > 0 ? hours * rate : null;

  const onSubmit = handleSubmit(async (values) => {
    const result = await addLaborItem(orderId, values.description, values.hours, values.hourly_rate);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Mano de obra agregada");
    reset({ description: "", hours: 1, hourly_rate: values.hourly_rate });
  });

  const firstError = errors.description?.message ?? errors.hours?.message ?? errors.hourly_rate?.message;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-2 rounded-lg bg-muted/40 p-3 ring-1 ring-foreground/5">
      <div className="grid gap-3 sm:grid-cols-[1fr_5.5rem_8rem_auto] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="labor-description">Trabajo realizado</Label>
          <Input
            {...fieldAria("labor-description", errors.description?.message)}
            {...register("description")}
            placeholder="Ej: Cambio de kit de arrastre"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:contents">
          <div className="grid gap-1.5">
            <Label htmlFor="labor-hours">Horas</Label>
            <Input
              {...fieldAria("labor-hours", errors.hours?.message)}
              {...register("hours", { valueAsNumber: true })}
              type="number"
              inputMode="decimal"
              min={0.25}
              step={0.25}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="labor-rate">Valor hora</Label>
            <Input
              {...fieldAria("labor-rate", errors.hourly_rate?.message)}
              {...register("hourly_rate", { valueAsNumber: true })}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
            />
          </div>
        </div>
        <Button type="submit" disabled={isSubmitting} className="h-9">
          {isSubmitting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Plus data-icon="inline-start" />}
          Agregar {preview !== null ? `· ${formatCurrency(preview)}` : ""}
        </Button>
      </div>
      {firstError ? (
        <p role="alert" className="text-xs text-destructive">
          {firstError}
        </p>
      ) : null}
    </form>
  );
}
