"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DEMO_PASSWORD, findDemoAccount } from "@/lib/demo/accounts";
import { isSupabaseConfigured } from "@/lib/env";
import { DEMO_SESSION_COOKIE, SUPPORT_COOKIE } from "@/lib/session-cookies";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, registerSchema, type UserRole } from "@/lib/validations/schemas";

export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  success?: string;
} | null;

/** Portal elegido en el login: define qué roles pueden entrar por él. */
export type LoginPortal = "workshop" | "superadmin";

const NOT_CONFIGURED: AuthFormState = {
  error:
    "Supabase aún no está configurado. Completa .env.local para habilitar el acceso.",
};

/** Solo permite redirecciones internas (evita open redirects). "/" deriva según el rol. */
function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

/** Error si el rol de la cuenta no corresponde al portal elegido. */
function portalMismatch(portal: LoginPortal, role: UserRole): string | null {
  if (portal === "superadmin" && role !== "superadmin") {
    return "Esta cuenta no tiene acceso de superadministrador. Ingresa como Taller.";
  }
  if (portal === "workshop" && role === "superadmin") {
    return "Es una cuenta de superadministrador: elige «Superadmin» para ingresar.";
  }
  return null;
}

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const portal: LoginPortal = formData.get("portal") === "superadmin" ? "superadmin" : "workshop";
  const cookieStore = await cookies();
  // Un login nuevo nunca hereda un modo soporte anterior.
  cookieStore.delete(SUPPORT_COOKIE);

  if (!isSupabaseConfigured()) {
    const account = findDemoAccount(parsed.data.email);
    if (!account || parsed.data.password !== DEMO_PASSWORD) {
      return { error: `Email o contraseña incorrectos. En modo demo la contraseña es «${DEMO_PASSWORD}».` };
    }
    const mismatch = portalMismatch(portal, account.role);
    if (mismatch) return { error: mismatch };
    cookieStore.set(DEMO_SESSION_COOKIE, account.email, { httpOnly: true, sameSite: "lax", path: "/" });
    redirect(safeNext(formData.get("next")));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Email o contraseña incorrectos." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
  const mismatch = portalMismatch(portal, (profile?.role ?? "client") as UserRole);
  if (mismatch) {
    await supabase.auth.signOut();
    return { error: mismatch };
  }

  redirect(safeNext(formData.get("next")));
}

export async function register(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;

  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const { email, password, name, phone } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // El trigger handle_new_user copia name/phone al perfil (rol = client, o el
    // rol de staff si el taller lo invitó con ese email en el onboarding).
    options: { data: { name, phone } },
  });

  if (error) return { error: error.message };

  // Con confirmación de email activa no hay sesión hasta verificar.
  if (!data.session) {
    return { success: "Te enviamos un email para confirmar tu cuenta." };
  }

  redirect("/");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SUPPORT_COOKIE);
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } else {
    cookieStore.delete(DEMO_SESSION_COOKIE);
  }
  redirect("/login");
}
