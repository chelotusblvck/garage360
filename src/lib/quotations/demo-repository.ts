import "server-only";
import { daysAgo } from "@/lib/demo/db";
import { quoteTotals, type HardwareLine, type PlanKey, type SetupType } from "@/lib/workshops/plans";
import { QuotationError, type Quotation, type QuotationRepository } from "./types";

/* Cotizaciones en memoria (modo demo). Mismas reglas que las funciones SQL de la sección 16. */

function quotation(
  partial: Pick<Quotation, "workshop_name" | "contact_name" | "email" | "phone" | "comuna" | "created_at"> & {
    plan_type: PlanKey;
    setup_type: SetupType;
    selected_hardware: HardwareLine[];
  }
): Quotation {
  const totals = quoteTotals(partial.plan_type, partial.setup_type, partial.selected_hardware);
  return {
    id: crypto.randomUUID(),
    estimated_total_clp: totals.initial.total,
    monthly_clp: totals.monthly.total,
    status: "pending",
    workshop_id: null,
    reviewed_at: null,
    ...partial,
  };
}

function seed(): Quotation[] {
  return [
    quotation({
      workshop_name: "Taller Motos del Maule",
      contact_name: "Camila Rojas",
      email: "camila@motosmaule.cl",
      phone: "+56 9 6123 4455",
      comuna: "Talca",
      plan_type: "pro",
      setup_type: "turnkey",
      selected_hardware: [
        { sku: "tablet_rugged_10", qty: 2 },
        { sku: "printer_thermal_80", qty: 1 },
        { sku: "pos_smart_c2c", qty: 1 },
      ],
      created_at: daysAgo(0, 9),
    }),
    quotation({
      workshop_name: "Biker Box La Florida",
      contact_name: "Jorge Muñoz",
      email: "jorge@bikerbox.cl",
      phone: "+56 9 7788 1122",
      comuna: "La Florida",
      plan_type: "starter",
      setup_type: "diy",
      selected_hardware: [{ sku: "printer_thermal_80", qty: 1 }],
      created_at: daysAgo(2, 17),
    }),
  ];
}

const store = globalThis as typeof globalThis & { __motoopsDemoQuotations?: Quotation[] };
export const demoQuotationStore = () => (store.__motoopsDemoQuotations ??= seed());

/** Cotización pendiente o error (como el update … where status = 'pending' de SQL). */
function pendingDemoQuotation(id: string) {
  const q = demoQuotationStore().find((x) => x.id === id);
  if (!q || q.status !== "pending") throw new QuotationError("La cotización ya fue procesada o no existe");
  return q;
}

export const demoQuotationRepository: QuotationRepository = {
  async create(input) {
    const all = demoQuotationStore();
    const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const recent = all.filter((q) => q.created_at > hourAgo);
    if (recent.filter((q) => q.email === input.email).length >= 3 || recent.length >= 60) {
      throw new QuotationError("Recibimos varias solicitudes seguidas: intenta más tarde.");
    }
    const created: Quotation = {
      ...input,
      id: crypto.randomUUID(),
      status: "pending",
      workshop_id: null,
      reviewed_at: null,
      created_at: new Date().toISOString(),
    };
    all.unshift(created);
    return { id: created.id };
  },

  async list() {
    return demoQuotationStore()
      .map((q) => ({ ...q }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async get(id) {
    const q = demoQuotationStore().find((x) => x.id === id);
    return q ? { ...q } : null;
  },

  async reject(id) {
    const q = pendingDemoQuotation(id);
    q.status = "rejected";
    q.reviewed_at = new Date().toISOString();
  },
};
