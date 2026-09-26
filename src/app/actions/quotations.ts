"use server";

import { failure, success, validationFailure, type ActionResult } from "@/lib/action-result";
import { clientIp, logActionError, logEvent } from "@/lib/logger";
import { getQuotationRepository } from "@/lib/quotations/repository";
import { QuotationError } from "@/lib/quotations/types";
import { createRateLimiter } from "@/lib/rate-limit";
import { quotationSchema } from "@/lib/validations/schemas";
import { HARDWARE_KEYS, PLANS, SETUPS, quoteTotals } from "@/lib/workshops/plans";

/*
 * Cotización pública de alta (pestaña «Solicitar cotización» de /login).
 * Sin sesión: se limita por IP aquí y por email / total en SQL (submit_quotation).
 * Los montos se recalculan con la tabla de precios del servidor.
 */

/** 3 cotizaciones cada 10 minutos por IP. */
const perIp = createRateLimiter("quotations:ip", { capacity: 3, windowMs: 10 * 60_000 });

export async function submitQuotation(data: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = quotationSchema.safeParse(data);
  if (!parsed.success) return validationFailure(parsed.error);
  const input = parsed.data;

  // Honeypot: un bot rellenó el campo oculto. Se responde como si todo saliera bien.
  if (input.website) return success({ id: crypto.randomUUID() });

  if (!perIp.take(await clientIp()).allowed) {
    return failure("Recibimos varias solicitudes seguidas: intenta de nuevo en unos minutos.");
  }

  const hardware = HARDWARE_KEYS.map((sku) => ({ sku, qty: input.hardware[sku] ?? 0 })).filter((h) => h.qty > 0);
  const totals = quoteTotals(input.plan, input.setup_type, hardware);
  try {
    const { id } = await getQuotationRepository().create({
      workshop_name: input.workshop_name,
      contact_name: input.contact_name,
      email: input.email,
      phone: input.phone,
      comuna: input.comuna,
      plan_type: input.plan,
      setup_type: input.setup_type,
      selected_hardware: hardware,
      estimated_total_clp: totals.initial.total,
      monthly_clp: totals.monthly.total,
    });

    logEvent({
      level: "info",
      source: "quotation_created",
      message: `Cotización recibida · ${input.workshop_name} · plan ${PLANS[input.plan].label} · setup ${SETUPS[input.setup_type].short}`,
      // Aún no hay taller: el evento es de la plataforma.
      workshopId: null,
      metadata: {
        quotation_id: id,
        plan: input.plan,
        setup_type: input.setup_type,
        hardware,
        initial_total: totals.initial.total,
        monthly: totals.monthly.total,
        comuna: input.comuna,
        email: input.email,
      },
    });

    return success({ id });
  } catch (error) {
    if (error instanceof QuotationError) return failure(error.message);
    logActionError("quotation action", error);
    return failure("No se pudo enviar la cotización. Intenta de nuevo.");
  }
}
