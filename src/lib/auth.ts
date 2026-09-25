import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { failure, type ActionResult } from "@/lib/action-result";
import { findDemoAccount } from "@/lib/demo/accounts";
import { isSupabaseConfigured } from "@/lib/env";
import { DEMO_SESSION_COOKIE, SUPPORT_COOKIE } from "@/lib/session-cookies";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/validations/schemas";
import { getWorkshopRepository } from "@/lib/workshops/repository";
import type { Workshop } from "@/lib/workshops/types";

/** Superadmin navegando el panel de un taller (solo lectura). */
export type SupportSession = { workshopId: string; workshopName: string };

export type SessionProfile = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  /** Taller al que pertenece el staff (null para clientes y superadmin). */
  workshopId: string | null;
  isDemo: boolean;
  support: SupportSession | null;
};

export const READ_ONLY_MESSAGE = "Modo soporte: el acceso al taller es de solo lectura.";

async function loadProfile(): Promise<Omit<SessionProfile, "support"> | null> {
  if (!isSupabaseConfigured()) {
    const email = (await cookies()).get(DEMO_SESSION_COOKIE)?.value;
    const account = email ? findDemoAccount(email) : null;
    if (!account) return null;
    const { id, name, role, workshopId } = account;
    return { id, email: account.email, name, role, workshopId, isDemo: true };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, name, role, workshop_id")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role as UserRole,
    workshopId: profile.workshop_id ?? null,
    isDemo: false,
  };
}

/** Taller del modo soporte, si la cookie apunta a uno que existe. */
async function loadSupport(): Promise<SupportSession | null> {
  const workshopId = (await cookies()).get(SUPPORT_COOKIE)?.value;
  if (!workshopId) return null;
  const workshop = await getWorkshopRepository().get(workshopId);
  return workshop ? { workshopId: workshop.id, workshopName: workshop.name } : null;
}

/** Perfil del usuario autenticado (memoizado por request). */
export const getCurrentProfile = cache(async (): Promise<SessionProfile | null> => {
  const profile = await loadProfile();
  if (!profile) return null;
  // La cookie de soporte solo tiene efecto para un superadmin.
  const support = profile.role === "superadmin" ? await loadSupport() : null;
  return { ...profile, support };
});

/** Taller que se está viendo: el propio o, en modo soporte, el elegido (memoizado). */
export const getCurrentWorkshop = cache(async (): Promise<Workshop | null> => {
  const profile = await getCurrentProfile();
  const id = profile?.support?.workshopId ?? profile?.workshopId;
  return id ? getWorkshopRepository().get(id) : null;
});

/** Pantalla de inicio según el rol. */
export function homePathFor(profile: Pick<SessionProfile, "role">) {
  if (profile.role === "superadmin") return "/admin";
  if (profile.role === "client") return "/inicio";
  return "/dashboard";
}

/**
 * Taller suspendido por mora: su staff solo ve /dashboard/suspended. El
 * superadmin en modo soporte no se ve afectado (su perfil no tiene workshopId).
 */
async function redirectIfSuspended(profile: SessionProfile) {
  if (profile.support || !profile.workshopId) return;
  const workshop = await getCurrentWorkshop();
  if (workshop?.suspended_at) redirect(SUSPENDED_PATH);
}

export const SUSPENDED_PATH = "/dashboard/suspended";

/**
 * Exige staff del taller (admin o mecánico) o un superadmin en modo soporte;
 * si no, redirige.
 */
export async function requireStaff(): Promise<SessionProfile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/dashboard");
  if (profile.role === "superadmin") {
    if (!profile.support) redirect("/admin");
    return profile;
  }
  if (profile.role === "client") redirect("/inicio");
  await redirectIfSuspended(profile);
  return profile;
}

/**
 * Para Server Actions que escriben: exige staff y bloquea el modo soporte.
 * Devuelve el error a retornar, o null si puede continuar:
 *
 *   const denied = await denyStaffWrite();
 *   if (denied) return denied;
 */
export async function denyStaffWrite(): Promise<ActionResult<never> | null> {
  const profile = await requireStaff();
  return profile.support ? failure(READ_ONLY_MESSAGE) : null;
}

export async function requireSuperadmin(): Promise<SessionProfile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/admin");
  if (profile.role !== "superadmin") redirect(homePathFor(profile));
  return profile;
}

/** Administrador de un taller (onboarding y configuración). */
export async function requireWorkshopAdmin(): Promise<SessionProfile & { workshopId: string }> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/onboarding");
  if (profile.role !== "admin" || !profile.workshopId) redirect(homePathFor(profile));
  await redirectIfSuspended(profile);
  return { ...profile, workshopId: profile.workshopId };
}
