import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { todayKey } from "@/lib/datetime";
import { logActionError } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { supabaseWorkshopRepository } from "@/lib/workshops/supabase-repository";
import { billingStatus, type BillingMethod, type PaymentConcept } from "./shared";
import { BillingError, type BillingRepository, type WorkshopPayment } from "./types";

type Row = Record<string, unknown>;

const PAYMENT_COLUMNS = "id, workshop_id, concept, amount, method, paid_at, notes, next_due_at, created_by, created_at";

function fail(error: PostgrestError): never {
  if (error.code === "42501") throw new BillingError("No tienes permisos para esta operación");
  if (error.code === "P0002") throw new BillingError(error.message);
  logActionError("billing · Supabase", error);
  throw new BillingError("No se pudo completar la operación. Intenta de nuevo.");
}

function toPayment(r: Row): WorkshopPayment {
  return {
    id: String(r.id),
    workshop_id: String(r.workshop_id),
    concept: r.concept as PaymentConcept,
    amount: Number(r.amount),
    method: r.method as BillingMethod,
    paid_at: String(r.paid_at),
    notes: r.notes ? String(r.notes) : null,
    next_due_at: r.next_due_at ? String(r.next_due_at) : null,
    created_by: r.created_by ? String(r.created_by) : null,
    created_at: String(r.created_at),
  };
}

/*
 * Lecturas por RLS (solo superadmin). Escrituras por RPC security definer:
 * el superadmin no tiene políticas de INSERT/UPDATE sobre estas tablas.
 */
export const supabaseBillingRepository: BillingRepository = {
  async account(workshopId) {
    const workshop = await supabaseWorkshopRepository.get(workshopId);
    if (!workshop) return null;
    const supabase = await createClient();
    const [payments, invite] = await Promise.all([
      supabase.from("workshop_payments").select(PAYMENT_COLUMNS).eq("workshop_id", workshopId).order("paid_at", { ascending: false }).order("created_at", { ascending: false }),
      supabase
        .from("workshop_staff")
        .select("name, email, activation_expires_at")
        .eq("workshop_id", workshopId)
        .eq("role", "admin")
        .is("profile_id", null)
        .not("email", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (payments.error) fail(payments.error);
    if (invite.error) fail(invite.error);
    return {
      workshop,
      status: billingStatus(workshop, todayKey()),
      payments: ((payments.data ?? []) as Row[]).map(toPayment),
      pendingInvite: invite.data
        ? { name: String(invite.data.name), email: String(invite.data.email), expiresAt: invite.data.activation_expires_at ?? null }
        : null,
    };
  },

  async recordPayment(workshopId, input, nextDueAt) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_record_payment", {
      p_workshop: workshopId,
      p_payment: { ...input, next_due_at: nextDueAt },
    });
    if (error) fail(error);
    return toPayment(data as Row);
  },

  async setSuspension(workshopId, suspended, reason) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_set_workshop_suspension", {
      p_workshop: workshopId,
      p_suspended: suspended,
      p_reason: reason,
    });
    if (error) fail(error);
  },

  async changePlan(workshopId, plan, setupType, setupFee) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_update_workshop_plan", {
      p_workshop: workshopId,
      p_plan: plan,
      p_setup_type: setupType,
      p_setup_fee: setupFee,
    });
    if (error) fail(error);
  },

  async regenerateActivation(workshopId, activation) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_regenerate_activation", {
      p_workshop: workshopId,
      p_token_hash: activation.tokenHash,
      p_expires_at: activation.expiresAt,
    });
    if (error) fail(error);
    return { email: String(data) };
  },
};
