"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { updateWorkOrderDetails } from "@/app/actions/orders";
import { Field, fieldAria } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { Mechanic } from "@/lib/orders/types";
import {
  workOrderDetailsSchema,
  type WorkOrderDetailsInput,
  type WorkOrderDetailsValues,
} from "@/lib/validations/schemas";

type Props = {
  orderId: string;
  intakeReason: string;
  diagnosis: string | null;
  mechanic: Mechanic | null;
  mechanics: Mechanic[];
  editable: boolean;
};

export function DiagnosisCard({ orderId, intakeReason, diagnosis, mechanic, mechanics, editable }: Props) {
  const form = useForm<WorkOrderDetailsValues, unknown, WorkOrderDetailsInput>({
    resolver: zodResolver(workOrderDetailsSchema),
    defaultValues: { diagnosis: diagnosis ?? "", mechanic_id: mechanic?.id ?? null },
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = form;

  const onSubmit = handleSubmit(async (values) => {
    const result = await updateWorkOrderDetails(orderId, values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Diagnóstico guardado");
    reset({ diagnosis: values.diagnosis ?? "", mechanic_id: values.mechanic_id });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Motivo de ingreso y diagnóstico</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-1.5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Reporte del cliente</p>
          <blockquote className="rounded-lg border-l-2 border-foreground/20 bg-muted/40 px-3 py-2 text-sm whitespace-pre-line">
            {intakeReason}
          </blockquote>
        </div>

        {editable ? (
          <form onSubmit={onSubmit} noValidate className="grid gap-4">
            <Field
              label="Diagnóstico técnico"
              htmlFor="wo-diagnosis"
              error={errors.diagnosis?.message}
              hint="Hallazgos, trabajos a realizar y recomendaciones. Aparece en el comprobante."
            >
              <Textarea
                {...fieldAria("wo-diagnosis", errors.diagnosis?.message, true)}
                {...register("diagnosis")}
                rows={4}
                placeholder="Ej: Cadena estirada fuera de tolerancia. Se reemplaza kit de arrastre."
              />
            </Field>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <Field label="Mecánico asignado" htmlFor="wo-mechanic" error={errors.mechanic_id?.message} className="sm:w-64">
                <NativeSelect
                  {...fieldAria("wo-mechanic", errors.mechanic_id?.message)}
                  {...register("mechanic_id", { setValueAs: (v) => (v ? v : null) })}
                  className="w-full"
                >
                  <NativeSelectOption value="">Sin asignar</NativeSelectOption>
                  {mechanics.map((m) => (
                    <NativeSelectOption key={m.id} value={m.id}>
                      {m.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Button type="submit" variant="outline" disabled={!isDirty || isSubmitting}>
                {isSubmitting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
                Guardar cambios
              </Button>
            </div>
          </form>
        ) : (
          <div className="grid gap-1.5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Diagnóstico técnico</p>
            <p className="text-sm whitespace-pre-line">{diagnosis || "Sin diagnóstico registrado."}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
