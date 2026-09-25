"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { login, type LoginPortal } from "../actions";
import { FormField, FormMessage } from "../_components/form-field";

export type DemoAccountHint = { email: string; hint: string; portal: LoginPortal };

type Props = {
  next?: string;
  initialPortal: LoginPortal;
  /** Solo en modo demo (sin Supabase): cuentas de prueba para rellenar el formulario. */
  demo?: { accounts: DemoAccountHint[]; password: string };
};

const PORTALS: { value: LoginPortal; label: string; icon: typeof Wrench; title: string; description: string }[] = [
  {
    value: "workshop",
    label: "Taller",
    icon: Wrench,
    title: "Ingresa a tu taller",
    description: "Órdenes de trabajo, agenda, inventario y ventas de tu equipo.",
  },
  {
    value: "superadmin",
    label: "Superadmin",
    icon: ShieldCheck,
    title: "Consola de superadministración",
    description: "Directorio de talleres, soporte y métricas globales de la plataforma.",
  },
];

export function LoginForm({ next, initialPortal, demo }: Props) {
  const [state, action, pending] = useActionState(login, null);
  const [portal, setPortal] = useState<LoginPortal>(initialPortal);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const current = PORTALS.find((p) => p.value === portal)!;

  function fillDemoAccount(account: DemoAccountHint) {
    setPortal(account.portal);
    setEmail(account.email);
    setPassword(demo!.password);
  }

  return (
    <div className="grid gap-6">
      {/* Indicador de rol: define por qué portal se ingresa. */}
      <div role="radiogroup" aria-label="Tipo de acceso" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {PORTALS.map((p) => {
          const active = p.value === portal;
          return (
            <button
              key={p.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setPortal(p.value)}
              className={cn(
                "flex h-9 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                active ? "bg-background text-foreground shadow-sm ring-1 ring-foreground/10" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <p.icon className={cn("size-4", active && p.value === "superadmin" && "text-brand")} aria-hidden />
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{current.title}</h1>
        <p className="text-sm text-muted-foreground">{current.description}</p>
      </div>

      <form action={action} className="grid gap-4" noValidate>
        <input type="hidden" name="next" value={next ?? ""} />
        <input type="hidden" name="portal" value={portal} />
        <FormMessage state={state} />
        <FormField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder={portal === "superadmin" ? "soporte@garage360.cl" : "taller@ejemplo.cl"}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          errors={state?.fieldErrors?.email}
        />
        <FormField
          label="Contraseña"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          errors={state?.fieldErrors?.password}
        />
        <Button type="submit" size="lg" disabled={pending} className="h-10">
          {pending ? "Ingresando…" : `Ingresar como ${current.label}`}
          {pending ? null : <ArrowRight data-icon="inline-end" />}
        </Button>
      </form>

      {demo ? (
        <section aria-label="Cuentas demo" className="grid gap-2 rounded-xl border border-dashed p-3">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Modo demo</span> · contraseña{" "}
            <code className="rounded bg-muted px-1 font-mono">{demo.password}</code>. Elige una cuenta:
          </p>
          <ul className="grid gap-1">
            {demo.accounts.map((a) => (
              <li key={a.email}>
                <button
                  type="button"
                  onClick={() => fillDemoAccount(a)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                    email === a.email && "bg-muted"
                  )}
                >
                  {a.portal === "superadmin" ? (
                    <ShieldCheck className="size-4 shrink-0 text-brand" aria-hidden />
                  ) : (
                    <Wrench className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className="grid min-w-0 leading-tight">
                    <span className="truncate font-mono text-xs">{a.email}</span>
                    <span className="truncate text-xs text-muted-foreground">{a.hint}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {portal === "workshop" ? (
        <p className="text-center text-sm text-muted-foreground">
          ¿Eres cliente del taller?{" "}
          <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
            Crea tu cuenta
          </Link>
        </p>
      ) : null}
    </div>
  );
}
