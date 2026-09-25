import type { Metadata } from "next";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo/accounts";
import { isSupabaseConfigured } from "@/lib/env";
import { LoginForm, type DemoAccountHint } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, portal } = await searchParams;
  const demo: DemoAccountHint[] | undefined = isSupabaseConfigured()
    ? undefined
    : DEMO_ACCOUNTS.map(({ email, hint, role }) => ({
        email,
        hint,
        portal: role === "superadmin" ? "superadmin" : "workshop",
      }));

  return (
    <LoginForm
      next={typeof next === "string" ? next : undefined}
      initialPortal={portal === "superadmin" || next?.toString().startsWith("/admin") ? "superadmin" : "workshop"}
      demo={demo ? { accounts: demo, password: DEMO_PASSWORD } : undefined}
    />
  );
}
