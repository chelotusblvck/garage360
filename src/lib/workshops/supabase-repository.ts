import "server-only";
import { logActionError } from "@/lib/logger";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { taxRateFromPercent } from "./shared";
import { WorkshopError, type Workshop, type WorkshopRepository, type WorkshopSummary } from "./types";

const WORKSHOP_COLUMNS =
  "id, name, rut, address, city, phone, email, specialty, logo_url, hourly_rate, tax_rate, reception_policy, onboarding_completed, onboarded_at, created_at";

type Row = Record<string, unknown>;

const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

function fail(error: PostgrestError): never {
  if (error.code === "23514") throw new WorkshopError("Algún dato no cumple el formato esperado");
  if (error.code === "42501") throw new WorkshopError("No tienes permisos para esta operación");
  logActionError("workshops · Supabase", error);
  throw new WorkshopError("No se pudo completar la operación. Intenta de nuevo.");
}

function toWorkshop(r: Row): Workshop {
  return {
    id: String(r.id),
    name: String(r.name),
    rut: str(r.rut),
    address: str(r.address),
    city: str(r.city),
    phone: str(r.phone),
    email: str(r.email),
    specialty: str(r.specialty),
    logo_url: str(r.logo_url),
    hourly_rate: Number(r.hourly_rate),
    tax_rate: Number(r.tax_rate),
    reception_policy: str(r.reception_policy),
    onboarding_completed: Boolean(r.onboarding_completed),
    onboarded_at: str(r.onboarded_at),
    created_at: String(r.created_at),
  };
}

export const supabaseWorkshopRepository: WorkshopRepository = {
  async get(id) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("workshops").select(WORKSHOP_COLUMNS).eq("id", id).maybeSingle();
    if (error) fail(error);
    return data ? toWorkshop(data as Row) : null;
  },

  async completeOnboarding(id, { profile, staff, settings }) {
    const supabase = await createClient();
    // La función toma el taller del perfil (my_workshop_id) y valida que sea admin.
    const { error } = await supabase.rpc("complete_workshop_onboarding", {
      p_workshop: {
        ...profile,
        hourly_rate: settings.hourly_rate,
        tax_rate: taxRateFromPercent(settings.tax_percent),
        reception_policy: settings.reception_policy,
      },
      p_staff: staff,
    });
    if (error) fail(error);
    const workshop = await supabaseWorkshopRepository.get(id);
    if (!workshop) throw new WorkshopError("Taller no encontrado");
    return workshop;
  },

  async list() {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_list_workshops");
    if (error) fail(error);
    return ((data ?? []) as Row[]).map(
      (r): WorkshopSummary => ({
        id: String(r.id),
        name: String(r.name),
        rut: str(r.rut),
        city: str(r.city),
        phone: str(r.phone),
        email: str(r.email),
        specialty: str(r.specialty),
        logo_url: str(r.logo_url),
        onboarding_completed: Boolean(r.onboarding_completed),
        created_at: String(r.created_at),
        users: Number(r.users),
        staff: Number(r.staff),
      })
    );
  },

  async globalMetrics() {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_global_metrics");
    if (error) fail(error);
    const m = (data ?? {}) as Row;
    return {
      workshops: Number(m.workshops ?? 0),
      onboarded: Number(m.onboarded ?? 0),
      staffUsers: Number(m.staff_users ?? 0),
      workOrders: Number(m.work_orders ?? 0),
      openWorkOrders: Number(m.open_work_orders ?? 0),
      salesTotal: Number(m.sales_total ?? 0),
      salesCount: Number(m.sales_count ?? 0),
    };
  },
};
