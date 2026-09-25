"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { activateAccount } from "../actions";
import { FormField, FormMessage } from "../_components/form-field";

export function ActivateForm({ token, email, name }: { token: string; email: string; name: string }) {
  const [state, action, pending] = useActionState(activateAccount, null);

  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <div className="grid gap-1.5">
        <Label htmlFor="activate-email">Email</Label>
        <Input id="activate-email" value={email} readOnly disabled className="font-mono" />
      </div>
      <FormField label="Tu nombre" name="name" defaultValue={name} autoComplete="name" required errors={state?.fieldErrors?.name} />
      <FormField
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        errors={state?.fieldErrors?.password}
      />
      <FormField
        label="Repite la contraseña"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        errors={state?.fieldErrors?.confirmPassword}
      />
      {state?.fieldErrors?.token ? <p className="text-xs text-destructive">{state.fieldErrors.token[0]}</p> : null}
      <Button type="submit" size="lg" disabled={pending} className="h-10">
        {pending ? "Activando…" : "Activar cuenta y entrar"}
      </Button>
    </form>
  );
}
