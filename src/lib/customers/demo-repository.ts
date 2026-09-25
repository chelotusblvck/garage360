import "server-only";
import { demoDb, type DemoCustomer, type DemoDb, type DemoMotorcycle } from "@/lib/demo/db";
import { formatFolio } from "@/lib/orders/workflow";
import { formatSaleFolio, round2 } from "@/lib/sales/shared";
import { customerSearchText, matchesCustomerSearch } from "./shared";
import {
  CustomerError,
  type CustomerMotorcycle,
  type CustomerProfile,
  type CustomerRepository,
  type CustomerSummary,
  type WorkOrderPhoto,
} from "./types";

/* Repositorio de clientes en memoria (modo demo). Mismas reglas que el SQL. */

function toProfile(c: DemoCustomer): CustomerProfile {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    rut: c.rut ?? null,
    address: c.address ?? null,
    city: c.city ?? null,
    created_at: c.created_at ?? new Date(0).toISOString(),
  };
}

/** OTs no canceladas de una moto (cuentan como visita al taller). */
const visitsOf = (db: DemoDb, motorcycleId: string) =>
  db.workOrders.filter((o) => o.motorcycle_id === motorcycleId && o.status !== "cancelled");

const latest = (dates: string[]) => (dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null);

function toMotorcycle(db: DemoDb, m: DemoMotorcycle): CustomerMotorcycle {
  const visits = visitsOf(db, m.id);
  return {
    id: m.id,
    brand: m.brand,
    model: m.model,
    year: m.year,
    plate: m.plate,
    vin: m.vin,
    current_km: m.current_km,
    color: m.color ?? null,
    notes: m.notes ?? null,
    order_count: visits.length,
    last_visit_at: latest(visits.map((o) => o.created_at)),
  };
}

function toPhoto(db: DemoDb, p: DemoDb["photos"][number]): WorkOrderPhoto {
  const order = db.workOrders.find((o) => o.id === p.work_order_id)!;
  return {
    id: p.id,
    work_order_id: p.work_order_id,
    folio: formatFolio(order.number),
    motorcycle_id: order.motorcycle_id,
    stage: p.stage,
    url: p.url,
    caption: p.caption,
    created_at: p.created_at,
  };
}

function findCustomer(db: DemoDb, id: string) {
  const customer = db.customers.find((c) => c.id === id);
  if (!customer) throw new CustomerError("Cliente no encontrado");
  return customer;
}

function assertUnique(db: DemoDb, input: { rut: string | null; email: string | null }, exceptId?: string) {
  const others = db.customers.filter((c) => c.id !== exceptId);
  if (input.rut && others.some((c) => c.rut === input.rut)) {
    throw new CustomerError("Ya existe un cliente con ese RUT", "rut");
  }
  if (input.email && others.some((c) => c.email?.toLowerCase() === input.email)) {
    throw new CustomerError("Ya existe un cliente con ese email", "email");
  }
}

export const demoCustomerRepository: CustomerRepository = {
  async list(query) {
    const db = demoDb();
    const summaries = db.customers.map((c): CustomerSummary => {
      const motos = db.motorcycles.filter((m) => m.customer_id === c.id);
      const visits = motos.flatMap((m) => visitsOf(db, m.id));
      const profile = toProfile(c);
      return {
        ...profile,
        motorcycles: motos.map((m) => ({ brand: m.brand, model: m.model, plate: m.plate })),
        order_count: visits.length,
        last_visit_at: latest(visits.map((o) => o.created_at)),
        search: customerSearchText(profile, motos),
      };
    });
    return summaries
      .filter((c) => !query || matchesCustomerSearch(c.search, query))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  },

  async profile(id) {
    const customer = demoDb().customers.find((c) => c.id === id);
    return customer ? toProfile(customer) : null;
  },

  async detail(id) {
    const db = demoDb();
    const customer = db.customers.find((c) => c.id === id);
    if (!customer) return null;

    const motos = db.motorcycles.filter((m) => m.customer_id === id);
    const motoIds = new Set(motos.map((m) => m.id));
    const orders = db.workOrders.filter((o) => motoIds.has(o.motorcycle_id));
    const orderIds = new Set(orders.map((o) => o.id));

    const history = orders
      .map((o) => {
        const parts = db.parts.filter((p) => p.work_order_id === o.id);
        const labor = db.labor.filter((l) => l.work_order_id === o.id);
        return {
          id: o.id,
          folio: formatFolio(o.number),
          status: o.status,
          motorcycle_id: o.motorcycle_id,
          intake_reason: o.intake_reason,
          diagnosis: o.diagnosis,
          km_at_intake: o.km_at_intake,
          total_amount: round2(
            parts.reduce((s, p) => s + p.quantity * p.unit_price, 0) + labor.reduce((s, l) => s + l.line_total, 0)
          ),
          mechanic_name: o.mechanic_id ? db.mechanics.find((m) => m.id === o.mechanic_id)?.name ?? null : null,
          jobs: labor.map((l) => l.description),
          photo_count: db.photos.filter((p) => p.work_order_id === o.id).length,
          created_at: o.created_at,
          completed_at: o.completed_at,
          delivered_at: o.delivered_at,
        };
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    const purchases = db.sales
      .filter((s) => s.customer_id === id)
      .map((s) => ({
        id: s.id,
        folio: formatSaleFolio(s.number),
        channel: s.channel,
        status: s.status,
        total: round2(s.subtotal + s.tax),
        units: s.items.reduce((sum, i) => sum + i.quantity, 0),
        at: s.paid_at ?? s.created_at,
      }))
      .sort((a, b) => b.at.localeCompare(a.at));

    return {
      customer: toProfile(customer),
      motorcycles: motos.map((m) => toMotorcycle(db, m)),
      history,
      photos: db.photos
        .filter((p) => orderIds.has(p.work_order_id))
        .map((p) => toPhoto(db, p))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
      purchases,
    };
  },

  async create(input) {
    const db = demoDb();
    assertUnique(db, input);
    const customer: DemoCustomer = { id: crypto.randomUUID(), ...input, created_at: new Date().toISOString() };
    db.customers.push(customer);
    return toProfile(customer);
  },

  async update(id, input) {
    const db = demoDb();
    const customer = findCustomer(db, id);
    assertUnique(db, input, id);
    Object.assign(customer, input);
    return toProfile(customer);
  },

  async addMotorcycle(customerId, input) {
    const db = demoDb();
    findCustomer(db, customerId);
    if (db.motorcycles.some((m) => m.plate === input.plate)) {
      throw new CustomerError("Ya existe una moto con esa patente", "plate");
    }
    if (input.vin && db.motorcycles.some((m) => m.vin === input.vin)) {
      throw new CustomerError("Ya existe una moto con ese VIN", "vin");
    }
    const moto: DemoMotorcycle = { id: crypto.randomUUID(), customer_id: customerId, ...input };
    db.motorcycles.push(moto);
    return toMotorcycle(db, moto);
  },

  async uploadPhoto(workOrderId, file, stage, caption) {
    const db = demoDb();
    if (!db.workOrders.some((o) => o.id === workOrderId)) {
      throw new CustomerError("Orden de trabajo no encontrada", "work_order_id");
    }
    // Sin Storage en modo demo: la imagen (ya comprimida en el navegador)
    // se guarda como data URL en memoria.
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const photo = {
      id: crypto.randomUUID(),
      work_order_id: workOrderId,
      stage,
      url: `data:${file.type};base64,${base64}`,
      caption,
      created_at: new Date().toISOString(),
    };
    db.photos.push(photo);
    return toPhoto(db, photo);
  },

  async listPhotos(workOrderId) {
    const db = demoDb();
    return db.photos
      .filter((p) => p.work_order_id === workOrderId)
      .map((p) => toPhoto(db, p))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },

  async deletePhoto(photoId) {
    const db = demoDb();
    if (!db.photos.some((p) => p.id === photoId)) throw new CustomerError("Foto no encontrada");
    db.photos = db.photos.filter((p) => p.id !== photoId);
  },
};
