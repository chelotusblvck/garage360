import type { WorkshopPaymentInput } from "@/lib/validations/schemas";
import type { PlanKey, SetupType } from "@/lib/workshops/plans";
import type { ActivationTicket, Workshop } from "@/lib/workshops/types";
import type { BillingMethod, BillingStatus, PaymentConcept } from "./shared";

export type WorkshopPayment = {
  id: string;
  workshop_id: string;
  concept: PaymentConcept;
  /** CLP con IVA incluido. */
  amount: number;
  method: BillingMethod;
  /** dateKey del pago. */
  paid_at: string;
  notes: string | null;
  /** Vencimiento resultante tras este pago. */
  next_due_at: string | null;
  created_by: string | null;
  created_at: string;
};

/** Ficha de cobro de un taller (consola superadmin). */
export type WorkshopAccount = {
  workshop: Workshop;
  status: BillingStatus;
  payments: WorkshopPayment[];
  /** Admin invitado que aún no activa su cuenta. */
  pendingInvite: { name: string; email: string; expiresAt: string | null } | null;
};

export interface BillingRepository {
  account(workshopId: string): Promise<WorkshopAccount | null>;
  /** Registra el pago y mueve el vencimiento en una sola operación. */
  recordPayment(workshopId: string, input: WorkshopPaymentInput, nextDueAt: string | null, createdBy: string): Promise<WorkshopPayment>;
  setSuspension(workshopId: string, suspended: boolean, reason: string | null): Promise<void>;
  changePlan(workshopId: string, plan: PlanKey, setupType: SetupType, setupFee: number): Promise<void>;
  /** Nuevo enlace para el admin pendiente; devuelve su email. */
  regenerateActivation(workshopId: string, activation: ActivationTicket): Promise<{ email: string }>;
}

export class BillingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingError";
  }
}
