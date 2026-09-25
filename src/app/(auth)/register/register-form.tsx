"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { register } from "../actions";
import { FormField, FormMessage } from "../_components/form-field";

export function RegisterForm() {
  const [state, action, pending] = useActionState(register, null);
  const errors = state?.fieldErrors;

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <FormField label="Nombre" name="name" autoComplete="name" required errors={errors?.name} />
      <FormField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        errors={errors?.email}
      />
      <FormField
        label="Teléfono (opcional)"
        name="phone"
        type="tel"
        autoComplete="tel"
        errors={errors?.phone}
      />
      <FormField
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        errors={errors?.password}
      />
      <FormField
        label="Repetir contraseña"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        errors={errors?.confirmPassword}
      />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </Button>
    </form>
  );
}
