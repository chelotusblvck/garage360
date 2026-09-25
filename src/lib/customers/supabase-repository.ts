import "server-only";
import { logActionError } from "@/lib/logger";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { sanitizeSearch } from "@/lib/inventory/shared";
import { formatFolio } from "@/lib/orders/workflow";
import type { SalesChannel } from "@/lib/sales/types";
import { createClient } from "@/lib/supabase/server";
import { normalizePlate, type PhotoStage, type SaleStatus, type WorkOrderStatus } from "@/lib/validations/schemas";
import { customerSearchText } from "./shared";
import {
  CustomerError,
  type CustomerMotorcycle,
  type CustomerProfile,
  type CustomerRepository,
  type WorkOrderPhoto,
} from "./types";

/** Bucket privado: las fotos se sirven con URLs firmadas de corta duración. */
const BUCKET = "work-order-photos";
const SIGNED_URL_TTL = 60 * 60;

const CUSTOMER_COLUMNS = "id, name, rut, phone, email, address, city, created_at";
const MOTO_COLUMNS = "id, brand, model, year, plate, vin, current_km, color, notes";
const PHOTO_COLUMNS = "id, work_order_id, stage, storage_path, caption, created_at";

type Row = Record<string, unknown>;

const str = (v: unknown) => (v === null || v === undefined ? null : String(v));
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

function fail(error: PostgrestError): never {
  const msg = error.message ?? "";
  if (error.code === "23505") {
    if (msg.includes("customers_rut_unique")) throw new CustomerError("Ya existe un cliente con ese RUT", "rut");
    if (msg.includes("customers_email_unique")) throw new CustomerError("Ya existe un cliente con ese email", "email");
    if (msg.includes("motorcycles_plate_unique")) throw new CustomerError("Ya existe una moto con esa patente", "plate");
    if (msg.includes("motorcycles_vin_unique")) throw new CustomerError("Ya existe una moto con ese VIN", "vin");
  }
  if (error.code === "23514") throw new CustomerError("Algún dato no cumple el formato esperado");
  if (error.code === "42501") throw new CustomerError("No tienes permisos para esta operación");
  if (error.code === "PGRST116") throw new CustomerError("Registro no encontrado");
  logActionError("customers · Supabase", error);
  throw new CustomerError("No se pudo completar la operación. Intenta de nuevo.");
}

function toProfile(r: Row): CustomerProfile {
  return {
    id: String(r.id),
    name: String(r.name),
    rut: str(r.rut),
    phone: str(r.phone),
    email: str(r.email),
    address: str(r.address),
    city: str(r.city),
    created_at: String(r.created_at),
  };
}

function toMoto(r: Row, visits: { created_at: string }[] = []): CustomerMotorcycle {
  return {
    id: String(r.id),
    brand: String(r.brand),
    model: String(r.model),
    year: Number(r.year),
    plate: String(r.plate),
    vin: str(r.vin),
    current_km: Number(r.current_km),
    color: str(r.color),
    notes: str(r.notes),
    order_count: visits.length,
    last_visit_at: visits.reduce<string | null>((max, v) => (!max || v.created_at > max ? v.created_at : max), null),
  };
}

/** Filas de work_order_photos → fotos con URL firmada. */
async function withSignedUrls(
  supabase: SupabaseClient,
  rows: Row[],
  orders: Map<string, { folio: string; motorcycle_id: string }>
): Promise<WorkOrderPhoto[]> {
  if (rows.length === 0) return [];
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(rows.map((r) => String(r.storage_path)), SIGNED_URL_TTL);
  if (error) {
    logActionError("customers · Storage", error);
    throw new CustomerError("No se pudieron cargar las fotos");
  }
  const urlByPath = new Map(data.map((d) => [d.path, d.signedUrl]));
  return rows.flatMap((r) => {
    const url = urlByPath.get(String(r.storage_path));
    const order = orders.get(String(r.work_order_id));
    if (!url || !order) return [];
    return [
      {
        id: String(r.id),
        work_order_id: String(r.work_order_id),
        folio: order.folio,
        motorcycle_id: order.motorcycle_id,
        stage: r.stage as PhotoStage,
        url,
        caption: str(r.caption),
        created_at: String(r.created_at),
      },
    ];
  });
}

export const supabaseCustomerRepository: CustomerRepository = {
  async list(query) {
    const supabase = await createClient();
    let request = supabase.from("v_customers").select("*").order("name").limit(500);

    const term = query ? sanitizeSearch(query).toLowerCase() : "";
    if (term) {
      // Cada palabra debe aparecer; también se prueba sin separadores (RUT, patente).
      for (const token of term.split(" ")) {
        const bare = normalizePlate(token).toLowerCase();
        request = bare && bare !== token
          ? request.or(`search.ilike.*${token}*,search.ilike.*${bare}*`)
          : request.ilike("search", `%${token}%`);
      }
    }

    const { data, error } = await request;
    if (error) fail(error);
    return (data as Row[]).map((r) => {
      const profile = toProfile(r);
      const motorcycles = ((r.motorcycles as Row[] | null) ?? []).map((m) => ({
        brand: String(m.brand),
        model: String(m.model),
        plate: String(m.plate),
      }));
      return {
        ...profile,
        motorcycles,
        order_count: Number(r.order_count ?? 0),
        last_visit_at: str(r.last_visit_at),
        search: customerSearchText(profile, motorcycles),
      };
    });
  },

  async profile(id) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("customers").select(CUSTOMER_COLUMNS).eq("id", id).maybeSingle();
    if (error) fail(error);
    return data ? toProfile(data as Row) : null;
  },

  async detail(id) {
    const supabase = await createClient();
    const [customer, motos, orders, purchases] = await Promise.all([
      supabase.from("customers").select(CUSTOMER_COLUMNS).eq("id", id).maybeSingle(),
      supabase.from("motorcycles").select(MOTO_COLUMNS).eq("client_id", id).order("created_at"),
      supabase
        .from("v_work_orders")
        .select("id, number, status, motorcycle_id, intake_reason, diagnosis, km_at_intake, total_amount, mechanic_name, created_at, completed_at, delivered_at")
        .eq("customer_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("v_sales")
        .select("id, folio, channel, status, total, units, paid_at, created_at")
        .eq("customer_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (customer.error) fail(customer.error);
    if (!customer.data) return null;
    if (motos.error) fail(motos.error);
    if (orders.error) fail(orders.error);
    if (purchases.error) fail(purchases.error);

    const orderRows = (orders.data ?? []) as Row[];
    const orderIds = orderRows.map((o) => String(o.id));

    const [labor, photos] = orderIds.length
      ? await Promise.all([
          supabase.from("work_order_labor").select("work_order_id, description").in("work_order_id", orderIds).order("created_at"),
          supabase.from("work_order_photos").select(PHOTO_COLUMNS).in("work_order_id", orderIds).order("created_at", { ascending: false }),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];
    if (labor.error) fail(labor.error);
    if (photos.error) fail(photos.error);

    const photoRows = (photos.data ?? []) as Row[];
    const orderInfo = new Map(
      orderRows.map((o) => [String(o.id), { folio: formatFolio(Number(o.number)), motorcycle_id: String(o.motorcycle_id) }])
    );

    return {
      customer: toProfile(customer.data as Row),
      motorcycles: ((motos.data ?? []) as Row[]).map((m) =>
        toMoto(
          m,
          orderRows
            .filter((o) => o.motorcycle_id === m.id && o.status !== "cancelled")
            .map((o) => ({ created_at: String(o.created_at) }))
        )
      ),
      history: orderRows.map((o) => ({
        id: String(o.id),
        folio: formatFolio(Number(o.number)),
        status: o.status as WorkOrderStatus,
        motorcycle_id: String(o.motorcycle_id),
        intake_reason: String(o.intake_reason ?? ""),
        diagnosis: str(o.diagnosis),
        km_at_intake: num(o.km_at_intake),
        total_amount: Number(o.total_amount),
        mechanic_name: str(o.mechanic_name),
        jobs: (labor.data ?? []).filter((l) => l.work_order_id === o.id).map((l) => String(l.description)),
        photo_count: photoRows.filter((p) => p.work_order_id === o.id).length,
        created_at: String(o.created_at),
        completed_at: str(o.completed_at),
        delivered_at: str(o.delivered_at),
      })),
      photos: await withSignedUrls(supabase, photoRows, orderInfo),
      purchases: ((purchases.data ?? []) as Row[]).map((s) => ({
        id: String(s.id),
        folio: String(s.folio),
        channel: s.channel as SalesChannel,
        status: s.status as SaleStatus,
        total: Number(s.total),
        units: Number(s.units),
        at: String(s.paid_at ?? s.created_at),
      })),
    };
  },

  async create(input) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("customers").insert(input).select(CUSTOMER_COLUMNS).single();
    if (error) fail(error);
    return toProfile(data as Row);
  },

  async update(id, input) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("customers").update(input).eq("id", id).select(CUSTOMER_COLUMNS).single();
    if (error) fail(error);
    return toProfile(data as Row);
  },

  async addMotorcycle(customerId, input) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("motorcycles")
      .insert({ ...input, client_id: customerId })
      .select(MOTO_COLUMNS)
      .single();
    if (error) fail(error);
    return toMoto(data as Row);
  },

  async uploadPhoto(workOrderId, file, stage, caption) {
    const supabase = await createClient();
    const { data: order, error: orderError } = await supabase
      .from("work_orders")
      .select("id, number, motorcycle_id")
      .eq("id", workOrderId)
      .maybeSingle();
    if (orderError) fail(orderError);
    if (!order) throw new CustomerError("Orden de trabajo no encontrada", "work_order_id");

    const ext = file.type.split("/")[1] ?? "webp";
    const path = `${workOrderId}/${stage}/${crypto.randomUUID()}.${ext}`;
    const upload = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });
    if (upload.error) {
      logActionError("customers · Storage", upload.error);
      throw new CustomerError("No se pudo subir la foto");
    }

    const { data, error } = await supabase
      .from("work_order_photos")
      .insert({ work_order_id: workOrderId, stage, storage_path: path, caption })
      .select(PHOTO_COLUMNS)
      .single();
    if (error) {
      await supabase.storage.from(BUCKET).remove([path]);
      fail(error);
    }

    const [photo] = await withSignedUrls(
      supabase,
      [data as Row],
      new Map([[workOrderId, { folio: formatFolio(Number(order.number)), motorcycle_id: String(order.motorcycle_id) }]])
    );
    return photo;
  },

  async listPhotos(workOrderId) {
    const supabase = await createClient();
    const [order, photos] = await Promise.all([
      supabase.from("work_orders").select("id, number, motorcycle_id").eq("id", workOrderId).maybeSingle(),
      supabase.from("work_order_photos").select(PHOTO_COLUMNS).eq("work_order_id", workOrderId).order("created_at"),
    ]);
    if (order.error) fail(order.error);
    if (photos.error) fail(photos.error);
    if (!order.data) return [];
    return withSignedUrls(
      supabase,
      (photos.data ?? []) as Row[],
      new Map([[workOrderId, { folio: formatFolio(Number(order.data.number)), motorcycle_id: String(order.data.motorcycle_id) }]])
    );
  },

  async deletePhoto(photoId) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("work_order_photos")
      .delete()
      .eq("id", photoId)
      .select("storage_path")
      .maybeSingle();
    if (error) fail(error);
    if (!data) throw new CustomerError("Foto no encontrada");
    await supabase.storage.from(BUCKET).remove([String(data.storage_path)]);
  },
};
