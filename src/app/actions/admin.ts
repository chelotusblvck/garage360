"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSuperadmin } from "@/lib/auth";
import { SUPPORT_COOKIE, SUPPORT_MAX_AGE } from "@/lib/session-cookies";
import { getWorkshopRepository } from "@/lib/workshops/repository";
import type { GlobalMetrics, WorkshopSummary } from "@/lib/workshops/types";

// z.guid(): los ids fijos de talleres (00000000-…-0001) no son UUID RFC y z.uuid() los rechaza.
const idSchema = z.guid("Identificador inválido");

// ---------------------------------------------------------------------------
// Lecturas (solo superadmin)
// ---------------------------------------------------------------------------

export async function getWorkshops(): Promise<WorkshopSummary[]> {
  await requireSuperadmin();
  return getWorkshopRepository().list();
}

export async function getGlobalMetrics(): Promise<GlobalMetrics> {
  await requireSuperadmin();
  return getWorkshopRepository().globalMetrics();
}

// ---------------------------------------------------------------------------
// Modo soporte ("Ingresar como taller")
// ---------------------------------------------------------------------------

/**
 * Abre el panel del taller en solo lectura: las Server Actions de escritura
 * rechazan la sesión (denyStaffWrite) y en Supabase el superadmin solo tiene
 * políticas RLS de lectura.
 */
export async function startSupportSession(workshopId: string) {
  await requireSuperadmin();
  const parsed = idSchema.safeParse(workshopId);
  const workshop = parsed.success ? await getWorkshopRepository().get(parsed.data) : null;
  if (!workshop) redirect("/admin");

  (await cookies()).set(SUPPORT_COOKIE, workshop.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SUPPORT_MAX_AGE,
  });
  redirect("/dashboard");
}

export async function endSupportSession() {
  await requireSuperadmin();
  (await cookies()).delete(SUPPORT_COOKIE);
  redirect("/admin");
}
