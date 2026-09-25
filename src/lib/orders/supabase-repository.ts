import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { sanitizeSearch } from "@/lib/inventory/shared";
import { createClient } from "@/lib/supabase/server";
import { normalizePlate, type FuelLevel, type WorkOrderStatus } from "@/lib/validations/schemas";
import {
  WorkOrderError,
  type Customer,
  type Motorcycle,
  type WorkOrderCounts,
  type WorkOrderRepository,
  type WorkOrderSummary,
} from "./types";
import { ALL_STATUSES, parseFolioQuery } from "./workflow";

type Row = Record<string, unknown>;

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

/** Fila de v_work_orders → WorkOrderSummary. */
function toSummary(r: Row): WorkOrderSummary {
  return {
    id: String(r.id),
    number: Number(r.number),
    folio: String(r.folio),
    status: r.status as WorkOrderStatus,
    intake_reason: String(r.intake_reason ?? ""),
    diagnosis: str(r.diagnosis),
    km_at_intake: num(r.km_at_intake),
    fuel_level: (r.fuel_level as FuelLevel | null) ?? null,
    parts_amount: Number(r.parts_amount),
    labor_amount: Number(r.labor_amount),
    total_amount: Number(r.total_amount),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    completed_at: str(r.completed_at),
    delivered_at: str(r.delivered_at),
    motorcycle: {
      id: String(r.motorcycle_id),
      brand: String(r.brand),
      model: String(r.model),
      year: Number(r.year),
      plate: String(r.plate),
      vin: str(r.vin),
      current_km: Number(r.current_km),
    },
    customer: {
      id: String(r.customer_id),
      name: String(r.customer_name),
      phone: str(r.customer_phone),
      email: str(r.customer_email),
    },
    mechanic: r.mechanic_id ? { id: String(r.mechanic_id), name: String(r.mechanic_name ?? "—") } : null,
    appointment_code: str(r.appointment_code),
  };
}

/** Traduce errores de Postgres a mensajes de negocio. */
function fail(error: PostgrestError): never {
  const msg = error.message ?? "";
  if (error.code === "23505") {
    if (msg.includes("motorcycles_plate_unique")) throw new WorkOrderError("Ya existe una moto con esa patente", "plate");
    if (msg.includes("motorcycles_vin_unique")) throw new WorkOrderError("Ya existe una moto con ese VIN", "vin");
    if (msg.includes("customers_email_unique")) throw new WorkOrderError("Ya existe un cliente con ese email", "customer_email");
  }
  if (error.code === "42501") throw new WorkOrderError("No tienes permisos para esta operación");
  if (error.code === "23514" && msg.startsWith("Stock insuficiente")) throw new WorkOrderError(msg, "quantity");
  if (error.code === "23514" && msg.includes("mechanic_id")) throw new WorkOrderError("Mecánico inválido", "mechanic_id");
  // Errores de negocio lanzados por nuestras funciones SQL (mensaje en español).
  if (["22023", "55000", "P0002"].includes(error.code)) {
    throw new WorkOrderError(msg, msg.includes("kilometraje") ? "km" : undefined);
  }
  if (error.code === "PGRST116") throw new WorkOrderError("Orden de trabajo no encontrada");
  console.error("[orders] Supabase error", error);
  throw new WorkOrderError("No se pudo completar la operación. Intenta de nuevo.");
}

function toMotorcycle(r: Row): Motorcycle {
  return {
    id: String(r.id),
    brand: String(r.brand),
    model: String(r.model),
    year: Number(r.year),
    plate: String(r.plate),
    vin: str(r.vin),
    current_km: Number(r.current_km),
  };
}

function toCustomer(r: Row): Customer {
  return { id: String(r.id), name: String(r.name), phone: str(r.phone), email: str(r.email) };
}

export const supabaseWorkOrderRepository: WorkOrderRepository = {
  async list({ q, status }) {
    const supabase = await createClient();
    let query = supabase.from("v_work_orders").select("*").order("number", { ascending: false }).limit(300);
    if (status !== "all") query = query.eq("status", status);

    const folio = q ? parseFolioQuery(q) : null;
    const term = q && folio === null ? sanitizeSearch(q).toLowerCase() : "";
    if (folio !== null) query = query.eq("number", folio);
    if (term) {
      const plate = normalizePlate(term).toLowerCase();
      query = plate && plate !== term
        ? query.or(`search.ilike.*${term}*,search.ilike.*${plate}*`)
        : query.ilike("search", `%${term}%`);
    }

    const { data, error } = await query;
    if (error) fail(error);
    return (data as Row[]).map(toSummary);
  },

  async counts() {
    const supabase = await createClient();
    const { data, error } = await supabase.from("work_orders").select("status");
    if (error) fail(error);
    const counts = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as WorkOrderCounts;
    for (const row of data ?? []) counts[row.status as WorkOrderStatus]++;
    return counts;
  },

  async detail(id) {
    const supabase = await createClient();
    const [order, parts, labor] = await Promise.all([
      supabase.from("v_work_orders").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("work_order_parts")
        .select("id, product_id, quantity, unit_price, line_total, created_at, product:products(name, sku)")
        .eq("work_order_id", id)
        .order("created_at"),
      supabase
        .from("work_order_labor")
        .select("id, description, hours, hourly_rate, line_total, created_at")
        .eq("work_order_id", id)
        .order("created_at"),
    ]);
    if (order.error) fail(order.error);
    if (!order.data) return null;
    if (parts.error) fail(parts.error);
    if (labor.error) fail(labor.error);

    return {
      ...toSummary(order.data as Row),
      parts: (parts.data ?? []).map((p) => {
        const product = (Array.isArray(p.product) ? p.product[0] : p.product) as { name: string; sku: string } | null;
        return {
          id: String(p.id),
          product_id: String(p.product_id),
          product_name: product?.name ?? "Producto eliminado",
          sku: product?.sku ?? "—",
          quantity: Number(p.quantity),
          unit_price: Number(p.unit_price),
          line_total: Number(p.line_total),
          created_at: String(p.created_at),
        };
      }),
      labor: (labor.data ?? []).map((l) => ({
        id: String(l.id),
        description: String(l.description),
        hours: Number(l.hours),
        hourly_rate: Number(l.hourly_rate),
        line_total: Number(l.line_total),
        created_at: String(l.created_at),
      })),
    };
  },

  async create(input) {
    const supabase = await createClient();
    const isNewMoto = input.motorcycle_mode === "new";
    const isNewCustomer = isNewMoto && input.customer_mode === "new";

    const { data, error } = await supabase
      .rpc("create_work_order", {
        p_intake_reason: input.intake_reason,
        p_km: input.km,
        p_motorcycle_id: isNewMoto ? null : input.motorcycle_id,
        p_mechanic_id: input.mechanic_id,
        p_customer_id: isNewMoto && !isNewCustomer ? input.customer_id : null,
        p_customer_name: isNewCustomer ? input.customer_name : null,
        p_customer_phone: isNewCustomer ? input.customer_phone || null : null,
        p_customer_email: isNewCustomer ? input.customer_email || null : null,
        p_brand: isNewMoto ? input.brand : null,
        p_model: isNewMoto ? input.model : null,
        p_year: isNewMoto ? input.year : null,
        p_plate: isNewMoto ? input.plate : null,
        p_vin: isNewMoto ? input.vin : null,
      })
      .single();
    if (error) fail(error);

    const created = await supabase
      .from("v_work_orders")
      .select("*")
      .eq("id", (data as Row).id as string)
      .single();
    if (created.error) fail(created.error);
    return toSummary(created.data as Row);
  },

  async updateStatus(id, status) {
    const supabase = await createClient();
    const { error } = await supabase.from("work_orders").update({ status }).eq("id", id).select("id").single();
    if (error) fail(error);
  },

  async updateDetails(id, { diagnosis, mechanic_id }) {
    const supabase = await createClient();
    const { data: current, error: readError } = await supabase
      .from("work_orders")
      .select("status")
      .eq("id", id)
      .single();
    if (readError) fail(readError);
    if (current.status === "delivered" || current.status === "cancelled") {
      throw new WorkOrderError("La orden está cerrada y no admite cambios");
    }
    const { error } = await supabase.from("work_orders").update({ diagnosis, mechanic_id }).eq("id", id);
    if (error) fail(error);
  },

  async addPart(workOrderId, productId, quantity, unitPrice) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("add_work_order_part", {
      p_work_order_id: workOrderId,
      p_product_id: productId,
      p_quantity: quantity,
      p_unit_price: unitPrice,
    });
    if (error) fail(error);
  },

  async removePart(workOrderId, partId) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("remove_work_order_part", {
      p_work_order_id: workOrderId,
      p_part_id: partId,
    });
    if (error) fail(error);
  },

  async addLabor(workOrderId, { description, hours, hourly_rate }) {
    const supabase = await createClient();
    const { error } = await supabase
      .from("work_order_labor")
      .insert({ work_order_id: workOrderId, description, hours, hourly_rate });
    if (error) fail(error);
  },

  async removeLabor(workOrderId, laborId) {
    const supabase = await createClient();
    const { error, count } = await supabase
      .from("work_order_labor")
      .delete({ count: "exact" })
      .eq("id", laborId)
      .eq("work_order_id", workOrderId);
    if (error) fail(error);
    if (!count) throw new WorkOrderError("El trabajo no pertenece a esta orden");
  },

  async mechanics() {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, email")
      .in("role", ["admin", "mechanic"])
      .order("name");
    if (error) fail(error);
    return (data ?? []).map((m) => ({ id: String(m.id), name: String(m.name || m.email) }));
  },

  async searchCustomers(query) {
    const supabase = await createClient();
    const term = sanitizeSearch(query);
    if (!term) return [];
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, phone, email")
      .or(`name.ilike.*${term}*,phone.ilike.*${term}*,email.ilike.*${term}*`)
      .order("name")
      .limit(8);
    if (error) fail(error);
    return (data as Row[]).map(toCustomer);
  },

  async findMotorcycleByPlate(plate) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("motorcycles")
      .select("id, brand, model, year, plate, vin, current_km, customer:customers(id, name, phone, email)")
      .eq("plate", normalizePlate(plate))
      .maybeSingle();
    if (error) fail(error);
    if (!data) return null;
    const customer = (Array.isArray(data.customer) ? data.customer[0] : data.customer) as Row;
    return { motorcycle: toMotorcycle(data as Row), customer: toCustomer(customer) };
  },
};
