import "server-only";
import { todayKey } from "@/lib/datetime";
import { demoWorkshopStore, pendingAdminInvite } from "@/lib/workshops/demo-repository";
import { billingStatus } from "./shared";
import { BillingError, type BillingRepository } from "./types";

/* Facturación en memoria (modo demo). Mismas reglas que las RPC admin_* de la sección 15 del SQL. */

function findWorkshop(id: string) {
  const w = demoWorkshopStore().workshops.find((x) => x.id === id);
  if (!w) throw new BillingError("Taller no encontrado");
  return w;
}

export const demoBillingRepository: BillingRepository = {
  async account(workshopId) {
    const s = demoWorkshopStore();
    const w = s.workshops.find((x) => x.id === workshopId);
    if (!w) return null;
    const invite = pendingAdminInvite(s, workshopId);
    return {
      workshop: { ...w },
      status: billingStatus(w, todayKey()),
      payments: s.payments.filter((p) => p.workshop_id === workshopId).map((p) => ({ ...p })),
      pendingInvite: invite?.email ? { name: invite.name, email: invite.email, expiresAt: invite.activation_expires_at } : null,
    };
  },

  async recordPayment(workshopId, input, nextDueAt, createdBy) {
    const w = findWorkshop(workshopId);
    const payment = {
      id: crypto.randomUUID(),
      workshop_id: workshopId,
      ...input,
      next_due_at: nextDueAt,
      created_by: createdBy,
      created_at: new Date().toISOString(),
    };
    w.next_due_at = nextDueAt;
    const s = demoWorkshopStore();
    s.payments.unshift(payment);
    s.payments.sort((a, b) => b.paid_at.localeCompare(a.paid_at) || b.created_at.localeCompare(a.created_at));
    return { ...payment };
  },

  async setSuspension(workshopId, suspended, reason) {
    const w = findWorkshop(workshopId);
    w.suspended_at = suspended ? new Date().toISOString() : null;
    w.suspension_reason = suspended ? reason : null;
  },

  async changePlan(workshopId, plan, setupType, setupFee) {
    Object.assign(findWorkshop(workshopId), { plan, setup_type: setupType, setup_fee: setupFee });
  },

  async regenerateActivation(workshopId, activation) {
    findWorkshop(workshopId);
    const invite = pendingAdminInvite(demoWorkshopStore(), workshopId);
    if (!invite?.email) throw new BillingError("El taller no tiene un administrador pendiente de activar");
    invite.activation_token_hash = activation.tokenHash;
    invite.activation_expires_at = activation.expiresAt;
    return { email: invite.email };
  },
};

/** Activación en demo: crea la cuenta del admin y vincula la invitación. Devuelve su email. */
export function demoActivateInvite(tokenHash: string, profileId: string) {
  const invite = demoWorkshopStore().staff.find((m) => m.activation_token_hash === tokenHash && !m.profile_id);
  if (!invite) return null;
  invite.profile_id = profileId;
  invite.activation_token_hash = null;
  return invite;
}
