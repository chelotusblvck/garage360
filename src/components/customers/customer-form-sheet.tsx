"use client";

import { useId } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { createCustomer, updateCustomer } from "@/app/actions/customers";
import { Field, fieldAria } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SANTIAGO_COMUNAS } from "@/lib/customers/shared";
import type { CustomerProfile } from "@/lib/customers/types";
import { formatRut } from "@/lib/format";
import { isValidRut } from "@/lib/rut";
import { customerSchema, type CustomerInput, type CustomerValues } from "@/lib/validations/schemas";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` = alta de cliente. */
  customer: CustomerProfile | null;
};

export function CustomerFormSheet({ open, onOpenChange, customer }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b pr-12">
          <SheetTitle>{customer ? "Editar cliente" : "Nuevo cliente"}</SheetTitle>
          <SheetDescription>
            {customer ? customer.name : "Ficha del cliente: datos de contacto, RUT y domicilio."}
          </SheetDescription>
        </SheetHeader>
        <CustomerForm key={customer?.id ?? "new"} customer={customer} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

function CustomerForm({ customer, onDone }: { customer: CustomerProfile | null; onDone: () => void }) {
  const router = useRouter();
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CustomerValues, unknown, CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: customer?.name ?? "",
      rut: customer?.rut ? formatRut(customer.rut) : "",
      phone: customer?.phone ?? "",
      email: customer?.email ?? "",
      address: customer?.address ?? "",
      city: customer?.city ?? "",
    },
  });

  const rutField = register("rut");

  const onSubmit = handleSubmit(async (values) => {
    const result = customer ? await updateCustomer(customer.id, values) : await createCustomer(values);
    if (!result.ok) {
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0] && field !== "_form") setError(field as Path<CustomerValues>, { message: messages[0] });
      }
      toast.error(result.error);
      return;
    }
    toast.success(customer ? "Ficha actualizada" : `${result.data.name} registrado`);
    onDone();
    if (!customer) router.push(`/dashboard/customers/${result.data.id}`);
  });

  const comunasId = id("comunas");

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="grid flex-1 content-start gap-4 overflow-y-auto p-4 sm:grid-cols-2">
        <Field label="Nombre y apellido" htmlFor={id("name")} error={errors.name?.message} className="sm:col-span-2">
          <Input {...fieldAria(id("name"), errors.name?.message)} {...register("name")} autoComplete="off" autoFocus={!customer} />
        </Field>
        <Field label="RUT (opcional)" htmlFor={id("rut")} error={errors.rut?.message} hint="Con dígito verificador: 12.345.678-5">
          <Input
            {...fieldAria(id("rut"), errors.rut?.message, true)}
            {...rutField}
            onBlur={(e) => {
              void rutField.onBlur(e);
              // Da formato con puntos y guion al salir del campo si es válido.
              if (isValidRut(e.target.value)) setValue("rut", formatRut(e.target.value));
            }}
            placeholder="12.345.678-5"
            inputMode="text"
            autoComplete="off"
            className="font-mono"
          />
        </Field>
        <Field label="Teléfono / WhatsApp" htmlFor={id("phone")} error={errors.phone?.message}>
          <Input {...fieldAria(id("phone"), errors.phone?.message)} {...register("phone")} type="tel" placeholder="+56 9 1234 5678" />
        </Field>
        <Field label="Email (opcional)" htmlFor={id("email")} error={errors.email?.message} className="sm:col-span-2">
          <Input {...fieldAria(id("email"), errors.email?.message)} {...register("email")} type="email" autoComplete="off" />
        </Field>
        <Field label="Dirección" htmlFor={id("address")} error={errors.address?.message} className="sm:col-span-2">
          <Input
            {...fieldAria(id("address"), errors.address?.message)}
            {...register("address")}
            placeholder="Av. Providencia 1650, depto. 302"
            autoComplete="off"
          />
        </Field>
        <Field label="Comuna" htmlFor={id("city")} error={errors.city?.message}>
          <Input
            {...fieldAria(id("city"), errors.city?.message)}
            {...register("city")}
            list={comunasId}
            placeholder="Providencia"
            autoComplete="off"
          />
          <datalist id={comunasId}>
            {SANTIAGO_COMUNAS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
      </div>

      <div className="flex justify-end gap-2 border-t bg-muted/40 p-4">
        <Button type="button" variant="outline" onClick={onDone} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
          {customer ? "Guardar cambios" : "Crear cliente"}
        </Button>
      </div>
    </form>
  );
}
