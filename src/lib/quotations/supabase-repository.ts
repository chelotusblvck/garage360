import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { logActionError } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { HARDWARE_KEYS, type HardwareLine, type PlanKey, type SetupType } from "@/lib/workshops/plans";
import { QuotationError, type Quotation, type QuotationRepository, type QuotationStatus } from "./types";

const COLUMNS =
  "id, workshop_name, contact_name, email, phone, comuna, plan_type, setup_type, selected_hardware, estimated_total_clp, monthly_clp, status, workshop_id, reviewed_at, created_at";

type Row = Record<string, unknown>;

const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

function fail(error: PostgrestError): never {
  if (error.code === "54000") throw new QuotationError("Recibimos varias solicitudes seguidas: intenta más tarde.");
  if (error.code === "P0002") throw new QuotationError(error.message);
  if (error.code === "23514") throw new QuotationError("Algún dato no cumple el formato esperado");
  if (error.code === "42501") throw new QuotationError("No tienes permisos para esta operación");
  logActionError("quotations · Supabase", error);
  throw new QuotationError("No se pudo completar la operación. Intenta de nuevo.");
}

/** jsonb → líneas válidas (descarta SKUs que ya no existen en el catálogo). */
function toHardware(value: unknown): HardwareLine[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((h: Row) => ({ sku: String(h?.sku) as HardwareLine["sku"], qty: Number(h?.qty) }))
    .filter((h) => (HARDWARE_KEYS as readonly string[]).includes(h.sku) && h.qty > 0);
}

function toQuotation(r: Row): Quotation {
  return {
    id: String(r.id),
    workshop_name: String(r.workshop_name),
    contact_name: String(r.contact_name),
    email: String(r.email),
    phone: String(r.phone),
    comuna: str(r.comuna),
    plan_type: r.plan_type as PlanKey,
    setup_type: r.setup_type as SetupType,
    selected_hardware: toHardware(r.selected_hardware),
    estimated_total_clp: Number(r.estimated_total_clp),
    monthly_clp: Number(r.monthly_clp),
    status: r.status as QuotationStatus,
    workshop_id: str(r.workshop_id),
    reviewed_at: str(r.reviewed_at),
    created_at: String(r.created_at),
  };
}

export const supabaseQuotationRepository: QuotationRepository = {
  async create(input) {
    const supabase = await createClient();
    // RPC pública (anon): el prospecto no puede leer la tabla, solo insertar.
    const { data, error } = await supabase.rpc("submit_quotation", { p_quotation: input });
    if (error) fail(error);
    return { id: String(data) };
  },

  async list() {
    const supabase = await createClient();
    const { data, error } = await supabase.from("quotations").select(COLUMNS).order("created_at", { ascending: false }).limit(200);
    if (error) fail(error);
    return ((data ?? []) as Row[]).map(toQuotation);
  },

  async get(id) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("quotations").select(COLUMNS).eq("id", id).maybeSingle();
    if (error) fail(error);
    return data ? toQuotation(data as Row) : null;
  },

  async reject(id) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_reject_quotation", { p_quotation: id });
    if (error) fail(error);
  },
};
