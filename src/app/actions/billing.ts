"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, success, validationFailure, type ActionResult } from "@/lib/action-result";
import { activationPath, newActivationToken } from "@/lib/activation";
import { requireSuperadmin } from "@/lib/auth";
import { getBillingRepository } from "@/lib/billing/repository";
import { BILLING_STATUS_LABEL, PAYMENT_CONCEPT, billingStatus, nextDueAfterPayment, withTax } from "@/lib/billing/shared";
import { BillingError, type WorkshopAccount, type WorkshopPayment } from "@/lib/billing/types";
import { todayKey } from "@/lib/datetime";
import { logActionError, logEvent } from "@/lib/logger";
import { workshopPaymentSchema, workshopPlanSchema, workshopSuspensionSchema } from "@/lib/validations/schemas";
import { PLANS, SETUPS } from "@/lib/workshops/plans";

/*
 * Facturación y cobro de talleres (solo superadmin). Cada cambio queda en
 * system_logs con source "billing_action" (visor «Diagnóstico Dev» del taller).
 */

// z.guid(): los ids fijos de talleres (00000000-…-0001) no son UUID RFC.
const idSchema = z.guid("Taller inválido");

function handleError<T>(error: unknown): ActionResult<T> {
  if (error instanceof BillingError) return failure(error.message);
  logActionError("billing action", error);
  return failure("No se pudo completar la operación. Intenta de nuevo.");
}

/** Taller existente y validado, o el error a devolver. */
async function loadAccount(workshopId: string): Promise<WorkshopAccount | ActionResult<never>> {
  const parsed = idSchema.safeParse(workshopId);
  if (!parsed.success) return failure("Taller inválido");
  const account = await getBillingRepository().account(parsed.data);
  return account ?? failure("Taller no encontrado");
}

const isResult = (v: WorkshopAccount | ActionResult<never>): v is ActionResult<never> => "ok" in v;

function audit(workshopId: string, message: string, metadata: Record<string, unknown>) {
  logEvent({ level: "info", source: "billing_action", message, workshopId, metadata });
  revalidatePath("/admin");
}

export async function getWorkshopAccount(workshopId: string): Promise<WorkshopAccount | null> {
  await requireSuperadmin();
  const account = await loadAccount(workshopId);
  return isResult(account) ? null : account;
}

export async function changeWorkshopPlan(workshopId: string, data: unknown): Promise<ActionResult<null>> {
  const profile = await requireSuperadmin();
  const parsed = workshopPlanSchema.safeParse(data);
  if (!parsed.success) return validationFailure(parsed.error);
  const account = await loadAccount(workshopId);
  if (isResult(account)) return account;

  const { plan, setup_type } = parsed.data;
  const before = account.workshop;
  if (before.plan === plan && before.setup_type === setup_type) return success(null);
  // DIY no tiene fee; al pasar a VIP se aplica el fee vigente de la tabla de precios.
  const setupFee = setup_type === "turnkey" ? (before.setup_type === "turnkey" ? before.setup_fee : SETUPS.turnkey.fee) : 0;

  try {
    await getBillingRepository().changePlan(before.id, plan, setup_type, setupFee);
  } catch (error) {
    return handleError(error);
  }
  audit(before.id, `Plan cambiado · ${PLANS[before.plan].label} ${SETUPS[before.setup_type].short} → ${PLANS[plan].label} ${SETUPS[setup_type].short}`, {
    audit: "plan_changed",
    from: { plan: before.plan, setup_type: before.setup_type, setup_fee: before.setup_fee },
    to: { plan, setup_type, setup_fee: setupFee, plan_monthly: PLANS[plan].monthly },
    changed_by: profile.email,
  });
  return success(null);
}

export async function recordWorkshopPayment(workshopId: string, data: unknown): Promise<ActionResult<WorkshopPayment>> {
  const profile = await requireSuperadmin();
  const parsed = workshopPaymentSchema.safeParse(data);
  if (!parsed.success) return validationFailure(parsed.error);
  if (parsed.data.paid_at > todayKey()) return failure("La fecha de pago no puede ser futura", { paid_at: ["No puede ser futura"] });
  const account = await loadAccount(workshopId);
  if (isResult(account)) return account;

  const input = parsed.data;
  const w = account.workshop;
  const nextDue = nextDueAfterPayment(w.next_due_at, input.paid_at, input.concept);
  try {
    const payment = await getBillingRepository().recordPayment(w.id, input, nextDue, profile.email);
    const { net, tax } = withTax(input.amount);
    audit(w.id, `Pago registrado · ${PAYMENT_CONCEPT[input.concept].label} · $${input.amount.toLocaleString("es-CL")}`, {
      audit: "payment_recorded",
      payment_id: payment.id,
      concept: input.concept,
      amount: input.amount,
      net,
      tax,
      method: input.method,
      paid_at: input.paid_at,
      plan: w.plan,
      next_due_before: w.next_due_at,
      next_due_after: nextDue,
      status_after: BILLING_STATUS_LABEL[billingStatus({ next_due_at: nextDue, suspended_at: w.suspended_at }, todayKey())],
      recorded_by: profile.email,
    });
    return success(payment);
  } catch (error) {
    return handleError(error);
  }
}

export async function suspendWorkshop(workshopId: string, data: unknown): Promise<ActionResult<null>> {
  const profile = await requireSuperadmin();
  const parsed = workshopSuspensionSchema.safeParse(data);
  if (!parsed.success) return validationFailure(parsed.error);
  const account = await loadAccount(workshopId);
  if (isResult(account)) return account;
  if (account.workshop.suspended_at) return failure("El taller ya está suspendido");

  try {
    await getBillingRepository().setSuspension(account.workshop.id, true, parsed.data.reason);
  } catch (error) {
    return handleError(error);
  }
  audit(account.workshop.id, "Taller suspendido por mora", {
    audit: "workshop_suspended",
    reason: parsed.data.reason,
    status_before: BILLING_STATUS_LABEL[account.status],
    next_due_at: account.workshop.next_due_at,
    suspended_by: profile.email,
  });
  return success(null);
}

export async function reactivateWorkshop(workshopId: string): Promise<ActionResult<null>> {
  const profile = await requireSuperadmin();
  const account = await loadAccount(workshopId);
  if (isResult(account)) return account;
  if (!account.workshop.suspended_at) return success(null);

  try {
    await getBillingRepository().setSuspension(account.workshop.id, false, null);
  } catch (error) {
    return handleError(error);
  }
  audit(account.workshop.id, "Taller reactivado", {
    audit: "workshop_reactivated",
    suspended_since: account.workshop.suspended_at,
    reason_was: account.workshop.suspension_reason,
    reactivated_by: profile.email,
  });
  return success(null);
}

/** Nuevo enlace para el admin pendiente (el anterior deja de funcionar). */
export async function regenerateActivationLink(workshopId: string): Promise<ActionResult<{ email: string; activationPath: string }>> {
  const profile = await requireSuperadmin();
  const account = await loadAccount(workshopId);
  if (isResult(account)) return account;

  const { token, ticket } = newActivationToken();
  try {
    const { email } = await getBillingRepository().regenerateActivation(account.workshop.id, ticket);
    logEvent({
      level: "info",
      source: "billing_action",
      message: "Enlace de activación regenerado",
      workshopId: account.workshop.id,
      metadata: { audit: "activation_regenerated", admin_email: email, expires_at: ticket.expiresAt, by: profile.email },
    });
    return success({ email, activationPath: activationPath(token) });
  } catch (error) {
    return handleError(error);
  }
}
