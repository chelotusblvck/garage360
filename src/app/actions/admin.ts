"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { activationPath, newActivationToken } from "@/lib/activation";
import { failure, success, validationFailure, type ActionResult } from "@/lib/action-result";
import { requireSuperadmin } from "@/lib/auth";
import { logActionError, logEvent } from "@/lib/logger";
import { getQuotationRepository } from "@/lib/quotations/repository";
import { QuotationError, type Quotation } from "@/lib/quotations/types";
import { SUPPORT_COOKIE, SUPPORT_MAX_AGE } from "@/lib/session-cookies";
import { newWorkshopSchema, type NewWorkshopInput } from "@/lib/validations/schemas";
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

type CreatedWorkshop = { id: string; name: string; adminEmail: string; activationPath: string };

/**
 * Crea el taller (onboarding pendiente) con su plan y modalidad de
 * implementación, e invita a su administrador con un enlace de activación
 * (el token en claro solo se devuelve aquí, una vez). El fee de setup se toma
 * de la tabla de precios del servidor, nunca del formulario.
 */
export async function createWorkshop(data: unknown): Promise<ActionResult<CreatedWorkshop>> {
  const profile = await requireSuperadmin();
  const parsed = newWorkshopSchema.safeParse(data);
  if (!parsed.success) return validationFailure(parsed.error);
  return provisionWorkshop(parsed.data, profile.email);
}

/** Alta + auditoría. Con `quotation`, la cotización queda aprobada en la misma operación. */
async function provisionWorkshop(
  input: NewWorkshopInput,
  createdBy: string,
  quotation?: Quotation
): Promise<ActionResult<CreatedWorkshop>> {
  const charge = initialCharge(input.plan, input.setup_type);
  try {
    const { token, ticket } = newActivationToken();
    const workshop = await getWorkshopRepository().create(input, charge.setupFee, ticket, quotation?.id);

    // Auditoría: queda en el visor «Diagnóstico Dev» del taller nuevo.
    logEvent({
      level: "info",
      source: "billing_action",
      message: `Taller creado${quotation ? " desde cotización" : ""} · plan ${PLANS[input.plan].label} · setup ${SETUPS[input.setup_type].short}`,
      workshopId: workshop.id,
      metadata: {
        audit: quotation ? "quotation_approved" : "workshop_created",
        plan: input.plan,
        plan_monthly: charge.monthly,
        setup_type: input.setup_type,
        setup_fee: charge.setupFee,
        initial_charge: charge.total,
        admin_email: input.admin_email,
        created_by: createdBy,
        ...(quotation
          ? { quotation_id: quotation.id, quoted_hardware: quotation.selected_hardware, quoted_initial_total: quotation.estimated_total_clp }
          : {}),
      },
    });

    revalidatePath("/admin");
    return success({ id: workshop.id, name: workshop.name, adminEmail: input.admin_email, activationPath: activationPath(token) });
  } catch (error) {
    if (error instanceof WorkshopError) {
      return failure(error.message, error.field ? { [error.field]: [error.message] } : undefined);
    }
    logActionError("admin action", error);
    return failure("No se pudo crear el taller. Intenta de nuevo.");
  }
}

// ---------------------------------------------------------------------------
// Cotizaciones recibidas (formulario público de /login)
// ---------------------------------------------------------------------------

export async function getQuotations(): Promise<Quotation[]> {
  await requireSuperadmin();
  return getQuotationRepository().list();
}

/** Cotización pendiente y validada, o el error a devolver. */
async function loadPendingQuotation(quotationId: string): Promise<Quotation | ActionResult<never>> {
  const parsed = idSchema.safeParse(quotationId);
  const quotation = parsed.success ? await getQuotationRepository().get(parsed.data) : null;
  if (!quotation) return failure("Cotización no encontrada");
  if (quotation.status !== "pending") return failure("La cotización ya fue procesada");
  return quotation;
}

/**
 * «Aprobar y crear taller»: da de alta el taller con los datos de la cotización
 * (el contacto queda como administrador) y devuelve el enlace de activación.
 */
export async function approveQuotation(quotationId: string): Promise<ActionResult<CreatedWorkshop>> {
  const profile = await requireSuperadmin();
  const quotation = await loadPendingQuotation(quotationId);
  if ("ok" in quotation) return quotation;

  const parsed = newWorkshopSchema.safeParse({
    plan: quotation.plan_type,
    setup_type: quotation.setup_type,
    name: quotation.workshop_name,
    city: quotation.comuna,
    phone: quotation.phone,
    admin_name: quotation.contact_name,
    admin_email: quotation.email,
  });
  // Datos que el formulario público ya validó: si no pasan, el contrato cambió.
  if (!parsed.success) return failure(`La cotización tiene datos inválidos: ${parsed.error.issues[0]?.message ?? "revisa sus campos"}`);
  return provisionWorkshop(parsed.data, profile.email, quotation);
}

export async function rejectQuotation(quotationId: string): Promise<ActionResult<null>> {
  const profile = await requireSuperadmin();
  const quotation = await loadPendingQuotation(quotationId);
  if ("ok" in quotation) return quotation;
  try {
    await getQuotationRepository().reject(quotation.id);
    logEvent({
      level: "info",
      source: "quotation_created",
      message: `Cotización rechazada · ${quotation.workshop_name}`,
      workshopId: null,
      metadata: { audit: "quotation_rejected", quotation_id: quotation.id, email: quotation.email, rejected_by: profile.email },
    });
    revalidatePath("/admin");
    return success(null);
  } catch (error) {
    if (error instanceof QuotationError) return failure(error.message);
    logActionError("admin action", error);
    return failure("No se pudo rechazar la cotización. Intenta de nuevo.");
  }
}
