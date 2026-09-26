import "server-only";
import { logActionError } from "@/lib/logger";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { hardwareLines, parseHardwareLines, type PlanKey, type SetupType } from "./plans";
import { taxRateFromPercent } from "./shared";
import { WorkshopError, type Workshop, type WorkshopRepository, type WorkshopSummary } from "./types";

const WORKSHOP_COLUMNS =
  "id, name, rut, address, city, phone, email, specialty, logo_url, hourly_rate, tax_rate, reception_policy, plan, setup_type, setup_fee, hardware, next_due_at, suspended_at, suspension_reason, onboarding_completed, onboarded_at, created_at";

type Row = Record<string, unknown>;

const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

function fail(error: PostgrestError): never {
  if (error.code === "23505" && error.message.includes("staff")) {
    throw new WorkshopError("Ese email ya es staff de un taller", "admin_email");
  }
  if (error.code === "23514") throw new WorkshopError("Algún dato no cumple el formato esperado");
  if (error.code === "P0002") throw new WorkshopError(error.message);
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
    plan: r.plan as PlanKey,
    setup_type: r.setup_type as SetupType,
    setup_fee: Number(r.setup_fee ?? 0),
    hardware: parseHardwareLines(r.hardware),
    next_due_at: str(r.next_due_at),
    suspended_at: str(r.suspended_at),
    suspension_reason: str(r.suspension_reason),
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

  async create(input, setupFee, activation, quotationId) {
    const supabase = await createClient();
    // RPC atómica: taller + invitación del admin (o vínculo inmediato si ya tiene
    // cuenta) + aprobación de la cotización de origen, si la hay.
    const { data, error } = await supabase.rpc("admin_create_workshop", {
      p_workshop: {
        ...input,
        hardware: hardwareLines(input.hardware),
        setup_fee: setupFee,
        activation_token_hash: activation.tokenHash,
        activation_expires_at: activation.expiresAt,
        quotation_id: quotationId ?? null,
      },
    });
    if (error) fail(error);
    const workshop = await supabaseWorkshopRepository.get(String(data));
    if (!workshop) throw new WorkshopError("No se pudo leer el taller creado");
    return workshop;
  },

  async lookupActivation(tokenHash) {
    const supabase = await createClient();
    // RPC pública (anon): solo devuelve datos si el hash coincide con una invitación vigente.
    const { data, error } = await supabase.rpc("lookup_activation", { p_token_hash: tokenHash });
    if (error) fail(error);
    const r = ((data ?? []) as Row[])[0];
    return r
      ? { workshopId: String(r.workshop_id), workshopName: String(r.workshop_name), name: String(r.name), email: String(r.email) }
      : null;
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
        plan: r.plan as PlanKey,
        setup_type: r.setup_type as SetupType,
        setup_fee: Number(r.setup_fee ?? 0),
        next_due_at: str(r.next_due_at),
        suspended_at: str(r.suspended_at),
        pending_invite: str(r.pending_invite),
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
