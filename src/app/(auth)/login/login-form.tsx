"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { login } from "../actions";
import { FormField, FormMessage } from "../_components/form-field";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, null);

  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <FormMessage state={state} />
      <FormField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="taller@ejemplo.com"
        required
        errors={state?.fieldErrors?.email}
      />
      <FormField
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        errors={state?.fieldErrors?.password}
      />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
