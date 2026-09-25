"use client";

import { useId } from "react";
import { useForm, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { addCustomerMotorcycle } from "@/app/actions/customers";
import { Field, fieldAria } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { MOTORCYCLE_BRANDS } from "@/lib/customers/shared";
import { formatPlate } from "@/lib/format";
import {
  customerMotorcycleSchema,
  type CustomerMotorcycleInput,
  type CustomerMotorcycleValues,
} from "@/lib/validations/schemas";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
};

export function MotorcycleFormSheet({ open, onOpenChange, customerId }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b pr-12">
          <SheetTitle>Agregar moto</SheetTitle>
          <SheetDescription>Queda asociada al cliente y disponible para citas y OTs.</SheetDescription>
        </SheetHeader>
        <MotorcycleForm customerId={customerId} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

const DEFAULTS: CustomerMotorcycleValues = {
  plate: "",
  brand: "",
  model: "",
  year: undefined as unknown as number,
  color: "",
  vin: "",
  current_km: 0,
  notes: "",
};

function MotorcycleForm({ customerId, onDone }: { customerId: string; onDone: () => void }) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CustomerMotorcycleValues, unknown, CustomerMotorcycleInput>({
    resolver: zodResolver(customerMotorcycleSchema),
    defaultValues: DEFAULTS,
  });

  const onSubmit = handleSubmit(async (values) => {
    const result = await addCustomerMotorcycle(customerId, values);
    if (!result.ok) {
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0] && field !== "_form") setError(field as Path<CustomerMotorcycleValues>, { message: messages[0] });
      }
      toast.error(result.error);
      return;
    }
    toast.success(`${result.data.brand} ${result.data.model} · ${formatPlate(result.data.plate)} agregada`);
    onDone();
  });

  const brandsId = id("brands");

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="grid flex-1 content-start gap-4 overflow-y-auto p-4 sm:grid-cols-6">
        <Field label="Patente" htmlFor={id("plate")} error={errors.plate?.message} hint="Moto: AB·123 o JKL·12" className="sm:col-span-3">
          <Input
            {...fieldAria(id("plate"), errors.plate?.message, true)}
            {...register("plate")}
            placeholder="AB·123"
            autoComplete="off"
            autoFocus
            className="font-mono uppercase"
          />
        </Field>
        <Field label="Kilometraje actual" htmlFor={id("km")} error={errors.current_km?.message} className="sm:col-span-3">
          <Input
            {...fieldAria(id("km"), errors.current_km?.message)}
            {...register("current_km", { valueAsNumber: true })}
            type="number"
            inputMode="numeric"
            min={0}
          />
        </Field>
        <Field label="Marca" htmlFor={id("brand")} error={errors.brand?.message} className="sm:col-span-2">
          <Input {...fieldAria(id("brand"), errors.brand?.message)} {...register("brand")} list={brandsId} placeholder="Ducati" autoComplete="off" />
          <datalist id={brandsId}>
            {MOTORCYCLE_BRANDS.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </Field>
        <Field label="Modelo" htmlFor={id("model")} error={errors.model?.message} className="sm:col-span-3">
          <Input {...fieldAria(id("model"), errors.model?.message)} {...register("model")} placeholder="Panigale V4" autoComplete="off" />
        </Field>
        <Field label="Año" htmlFor={id("year")} error={errors.year?.message} className="sm:col-span-1">
          <Input
            {...fieldAria(id("year"), errors.year?.message)}
            {...register("year", { valueAsNumber: true })}
            type="number"
            inputMode="numeric"
            placeholder="2023"
          />
        </Field>
        <Field label="Color" htmlFor={id("color")} error={errors.color?.message} className="sm:col-span-3">
          <Input {...fieldAria(id("color"), errors.color?.message)} {...register("color")} placeholder="Rojo Ducati" autoComplete="off" />
        </Field>
        <Field label="VIN (opcional)" htmlFor={id("vin")} error={errors.vin?.message} className="sm:col-span-3">
          <Input
            {...fieldAria(id("vin"), errors.vin?.message)}
            {...register("vin")}
            placeholder="17 caracteres"
            maxLength={17}
            className="font-mono uppercase"
          />
        </Field>
        <Field label="Observaciones" htmlFor={id("notes")} error={errors.notes?.message} className="sm:col-span-6">
          <Textarea
            {...fieldAria(id("notes"), errors.notes?.message)}
            {...register("notes")}
            rows={3}
            placeholder="Accesorios, modificaciones, preferencias del cliente…"
          />
        </Field>
      </div>

      <div className="flex justify-end gap-2 border-t bg-muted/40 p-4">
        <Button type="button" variant="outline" onClick={onDone} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
          Agregar moto
        </Button>
      </div>
    </form>
  );
}
