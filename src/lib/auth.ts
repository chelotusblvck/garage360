import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/validations/schemas";

export type SessionProfile = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isDemo: boolean;
};

const DEMO_PROFILE: SessionProfile = {
  id: "demo",
  email: "demo@motoops.app",
  name: "Taller Demo",
  role: "admin",
  isDemo: true,
};

/** Perfil del usuario autenticado (memoizado por request). */
export const getCurrentProfile = cache(async (): Promise<SessionProfile | null> => {
  if (!isSupabaseConfigured()) return DEMO_PROFILE;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, name, role")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return { ...(profile as Omit<SessionProfile, "isDemo">), isDemo: false };
});

/** Exige un usuario con rol admin o mechanic; si no, redirige. */
export async function requireStaff(): Promise<SessionProfile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/dashboard");
  if (profile.role === "client") redirect("/");
  return profile;
}
