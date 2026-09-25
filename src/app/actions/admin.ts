"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { failure, success, validationFailure, type ActionResult } from "@/lib/action-result";
import { requireSuperadmin } from "@/lib/auth";
import { logActionError, logEvent } from "@/lib/logger";
import { SUPPORT_COOKIE, SUPPORT_MAX_AGE } from "@/lib/session-cookies";
import { newWorkshopSchema } from "@/lib/validations/schemas";
import { PLANS, SETUPS, initialCharge } from "@/lib/workshops/plans";
import { getWorkshopRepository } from "@/lib/workshops/repository";
import { WorkshopError, type GlobalMetrics, type WorkshopSummary } from "@/lib/workshops/types";

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

// ---------------------------------------------------------------------------
// Alta de talleres
// ---------------------------------------------------------------------------

/**
 * Crea el taller (onboarding pendiente) con su plan y modalidad de
 * implementación, e invita a su administrador por email. El fee de setup se
 * toma de la tabla de precios del servidor, nunca del formulario.
 */
export async function createWorkshop(data: unknown): Promise<ActionResult<{ id: string; name: string }>> {
  const profile = await requireSuperadmin();
  const parsed = newWorkshopSchema.safeParse(data);
  if (!parsed.success) return validationFailure(parsed.error);

  const input = parsed.data;
  const charge = initialCharge(input.plan, input.setup_type);
  try {
    const workshop = await getWorkshopRepository().create(input, charge.setupFee);

    // Auditoría: queda en el visor «Diagnóstico Dev» del taller nuevo.
    logEvent({
      level: "info",
      message: `Taller creado · plan ${PLANS[input.plan].label} · setup ${SETUPS[input.setup_type].short}`,
      workshopId: workshop.id,
      metadata: {
        audit: "workshop_created",
        plan: input.plan,
        plan_monthly: charge.monthly,
        setup_type: input.setup_type,
        setup_fee: charge.setupFee,
        initial_charge: charge.total,
        admin_email: input.admin_email,
        created_by: profile.email,
      },
    });

    revalidatePath("/admin");
    return success({ id: workshop.id, name: workshop.name });
  } catch (error) {
    if (error instanceof WorkshopError) {
      return failure(error.message, error.field ? { [error.field]: [error.message] } : undefined);
    }
    logActionError("admin action", error);
    return failure("No se pudo crear el taller. Intenta de nuevo.");
  }
}
