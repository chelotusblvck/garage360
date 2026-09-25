import "server-only";
import { DEFAULT_HOURLY_RATE } from "@/lib/business";
import { getStockStatus } from "@/lib/inventory/constants";
import type { InventoryReason, Product, StockMovement } from "@/lib/inventory/types";
import type { Customer, Mechanic, Motorcycle, WorkOrderLabor } from "@/lib/orders/types";
import { SERVICE_DURATION } from "@/lib/appointments/schedule";
import { addDays, addMonths, startOfMonth, todayKey, weekdayOf, zonedToUtc } from "@/lib/datetime";
import type { SalesChannel, ShippingAddress } from "@/lib/sales/types";
import type {
  AppointmentStatus,
  Fulfillment,
  PaymentMethod,
  SaleStatus,
  ServiceType,
  FuelLevel,
  PhotoStage,
  WorkOrderStatus,
} from "@/lib/validations/schemas";
import { demoPhotoUrl } from "./photos";
import {
  APPOINTMENT_SEED,
  COMUNA_POSTAL_CODE,
  CUSTOMER_PROFILES,
  INVENTORY_SEED,
  MOTO_DETAILS,
  SALES_SEED_BUYERS,
  WORK_ORDER_FIRST_NUMBER,
  WORK_ORDER_SEED,
} from "./seed";

/*
 * "Base de datos" en memoria del modo demo (sin Supabase).
 * Inventario y órdenes comparten estado para que los repuestos usados en una
 * OT descuenten stock igual que en producción. Vive en globalThis: sobrevive
 * a las recargas en caliente de `next dev` y se reinicia con el servidor.
 */

export const DEMO_USER = "Taller Demo";

export type DemoMovement = Omit<StockMovement, "stock_after">;

export type DemoWorkOrder = {
  id: string;
  number: number;
  status: WorkOrderStatus;
  motorcycle_id: string;
  mechanic_id: string | null;
  intake_reason: string;
  diagnosis: string | null;
  km_at_intake: number | null;
  /** Nivel de combustible en la recepción (solo OTs creadas con el check-in o sembradas). */
  fuel_level?: FuelLevel | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  delivered_at: string | null;
  appointment_id: string | null;
};

export type DemoAppointment = {
  id: string;
  booking_code: string;
  customer_id: string;
  motorcycle_id: string;
  service_type: ServiceType;
  scheduled_at: string;
  duration_minutes: number;
  status: AppointmentStatus;
  notes: string | null;
  source: "staff" | "public";
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  created_at: string;
};

export type DemoPart = {
  id: string;
  work_order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  created_at: string;
};

export type DemoLabor = WorkOrderLabor & { work_order_id: string };

export type DemoSaleItem = { product_id: string; quantity: number; unit_price: number };

export type DemoSale = {
  id: string;
  number: number;
  channel: SalesChannel;
  status: SaleStatus;
  payment_method: PaymentMethod;
  customer_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  items: DemoSaleItem[];
  subtotal: number;
  tax: number;
  amount_tendered: number | null;
  fulfillment: Fulfillment | null;
  shipping_address: ShippingAddress | null;
  notes: string | null;
  seller_name: string | null;
  paid_at: string;
  created_at: string;
};

/** Cliente demo: la ficha (RUT, domicilio) es opcional para quienes nacen desde una OT o cita. */
export type DemoCustomer = Customer & {
  rut?: string | null;
  address?: string | null;
  city?: string | null;
  created_at?: string;
};

export type DemoMotorcycle = Motorcycle & {
  customer_id: string;
  color?: string | null;
  notes?: string | null;
};

export type DemoPhoto = {
  id: string;
  work_order_id: string;
  stage: PhotoStage;
  url: string;
  caption: string | null;
  created_at: string;
};

export type DemoDb = {
  products: Product[];
  movements: DemoMovement[];
  nextMovementId: number;
  mechanics: Mechanic[];
  customers: DemoCustomer[];
  motorcycles: DemoMotorcycle[];
  photos: DemoPhoto[];
  /** Fotos del check-in subidas antes de crear la OT (token → data URL). */
  stagedPhotos: Map<string, string>;
  workOrders: DemoWorkOrder[];
  parts: DemoPart[];
  labor: DemoLabor[];
  nextWorkOrderNumber: number;
  appointments: DemoAppointment[];
  sales: DemoSale[];
  nextSaleNumber: number;
  /**
   * Facturación de OTs anteriores al período sembrado (solo demo), para que
   * el gráfico de ingresos tenga historia. Las OTs nuevas suman aparte.
   */
  workshopArchive: { at: string; amount: number }[];
};

/** Stock insuficiente al confirmar una venta demo (mismo criterio que el SQL). */
export class DemoStockError extends Error {
  constructor(
    public productName: string,
    public available: number,
    public requested: number
  ) {
    super(`Stock insuficiente para «${productName}»: quedan ${available} u. y se piden ${requested}`);
    this.name = "DemoStockError";
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Registra una venta pagada: valida stock de todas las líneas (agrupadas por
 * producto) y recién entonces descuenta con motivo pos_sale / online_sale.
 * Espejo de create_pos_sale() / checkout_online() + apply_sale_stock().
 */
export function recordDemoSale(
  db: DemoDb,
  input: Omit<DemoSale, "id" | "number" | "items" | "subtotal" | "status" | "paid_at" | "created_at" | "tax"> & {
    lines: { product_id: string; quantity: number }[];
    tax_rate: number;
    at?: string;
  }
): DemoSale {
  const grouped = new Map<string, number>();
  for (const line of input.lines) grouped.set(line.product_id, (grouped.get(line.product_id) ?? 0) + line.quantity);

  const items: DemoSaleItem[] = [];
  for (const [productId, quantity] of grouped) {
    const product = db.products.find((p) => p.id === productId && p.is_active);
    if (!product) throw new Error("PRODUCT_NOT_FOUND");
    if (product.stock < quantity) throw new DemoStockError(product.name, product.stock, quantity);
    items.push({ product_id: productId, quantity, unit_price: product.price });
  }

  const subtotal = round2(items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0));
  const tax = round2(subtotal * input.tax_rate);
  const at = input.at ?? new Date().toISOString();
  const sale: DemoSale = {
    id: crypto.randomUUID(),
    number: db.nextSaleNumber++,
    channel: input.channel,
    status: "paid",
    payment_method: input.payment_method,
    customer_id: input.customer_id,
    contact_name: input.contact_name,
    contact_email: input.contact_email,
    contact_phone: input.contact_phone,
    items,
    subtotal,
    tax,
    amount_tendered: input.amount_tendered,
    fulfillment: input.fulfillment,
    shipping_address: input.shipping_address,
    notes: input.notes,
    seller_name: input.seller_name,
    paid_at: at,
    created_at: at,
  };

  const folio = `V-${String(sale.number).padStart(6, "0")}`;
  const reason = sale.channel === "pos" ? "pos_sale" : "online_sale";
  for (const item of items) {
    applyStockMovement(db, item.product_id, -item.quantity, reason, folio, {
      createdAt: at,
      author: sale.seller_name,
    });
  }
  db.sales.push(sale);
  return sale;
}

/** PRNG determinístico: la demo siembra siempre los mismos datos. */
function seededRandom(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Alta de OT en estado "Recepcionada" (compartida por órdenes y agenda). */
export function insertDemoWorkOrder(
  db: DemoDb,
  input: {
    motorcycle_id: string;
    mechanic_id: string | null;
    intake_reason: string;
    km: number;
    appointment_id?: string | null;
  }
): DemoWorkOrder {
  const now = new Date().toISOString();
  const moto = db.motorcycles.find((m) => m.id === input.motorcycle_id);
  if (moto && input.km > moto.current_km) moto.current_km = input.km;
  const order: DemoWorkOrder = {
    id: crypto.randomUUID(),
    number: db.nextWorkOrderNumber++,
    status: "open",
    motorcycle_id: input.motorcycle_id,
    mechanic_id: input.mechanic_id,
    intake_reason: input.intake_reason,
    diagnosis: null,
    km_at_intake: input.km,
    created_at: now,
    updated_at: now,
    completed_at: null,
    delivered_at: null,
    appointment_id: input.appointment_id ?? null,
  };
  db.workOrders.push(order);
  return order;
}

/** Código de reserva de 6 caracteres hexadecimales (como en SQL). */
export function newBookingCode(db: DemoDb): string {
  let code: string;
  do {
    code = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  } while (db.appointments.some((a) => a.booking_code === code));
  return code;
}

const DAY = 24 * 60 * 60 * 1000;
export const daysAgo = (days: number, hour = 10) => {
  const d = new Date(Date.now() - days * DAY);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

/** Aplica un movimiento de stock validando que no quede negativo. */
export function applyStockMovement(
  db: DemoDb,
  productId: string,
  delta: number,
  reason: InventoryReason,
  note: string | null,
  options: { createdAt?: string; author?: string | null } = {}
): Product {
  const product = db.products.find((p) => p.id === productId);
  if (!product) throw new Error("PRODUCT_NOT_FOUND");
  const next = product.stock + delta;
  if (next < 0) throw new Error("INSUFFICIENT_STOCK");

  const at = options.createdAt ?? new Date().toISOString();
  product.stock = next;
  product.stock_status = getStockStatus(next, product.min_stock);
  product.updated_at = at;

  db.movements.push({
    id: db.nextMovementId++,
    product_id: productId,
    quantity: delta,
    reason,
    note,
    created_at: at,
    created_by_name: options.author === undefined ? DEMO_USER : options.author,
  });
  return product;
}

const SEED_FUEL_LEVELS: FuelLevel[] = ["half", "quarter", "three_quarters", "reserve", "full", "half"];

function seed(): DemoDb {
  const db: DemoDb = {
    products: [],
    movements: [],
    nextMovementId: 1,
    mechanics: [],
    customers: [],
    motorcycles: [],
    photos: [],
    stagedPhotos: new Map(),
    workOrders: [],
    parts: [],
    labor: [],
    nextWorkOrderNumber: 1,
    appointments: [],
    sales: [],
    nextSaleNumber: 1,
    workshopArchive: [],
  };

  // ---- Inventario -----------------------------------------------------------
  for (const s of INVENTORY_SEED) {
    const id = crypto.randomUUID();
    const sold = s.sold ?? 0;
    const damaged = s.damaged ?? 0;
    const createdAt = daysAgo(SALES_HISTORY_DAYS + 10, 9);
    // Stock inicial = stock final + todo lo que salió después (ventas, mermas y OTs).
    const workshopUse = WORK_ORDER_SEED.flatMap((o) => o.parts)
      .filter((p) => p.sku === s.sku)
      .reduce((sum, p) => sum + p.qty, 0);
    const initial = s.stock + sold + damaged + workshopUse;

    db.products.push({
      id,
      name: s.name,
      sku: s.sku,
      description: s.description ?? null,
      category: s.category,
      price: s.price,
      cost: s.cost,
      stock: 0,
      min_stock: s.min,
      image_url: null,
      is_active: true,
      stock_status: "out",
      created_at: createdAt,
      updated_at: createdAt,
    });

    applyStockMovement(db, id, initial, "purchase", "Stock inicial", { createdAt });

    if (damaged > 0) {
      applyStockMovement(db, id, -damaged, "damage", "Llegó dañado del proveedor", { createdAt: daysAgo(3, 16) });
    }
  }

  // ---- Mecánicos, clientes y motos -----------------------------------------
  const mechanicByName = new Map<string, Mechanic>();
  for (const name of ["Pedro Álvarez", "Ramiro Sosa", "Ana Torres"]) {
    const m = { id: crypto.randomUUID(), name };
    db.mechanics.push(m);
    mechanicByName.set(name, m);
  }

  const customerByName = new Map<string, DemoCustomer>();
  const motoByPlate = new Map<string, DemoMotorcycle>();
  const customerRecord = (c: Customer): DemoCustomer => {
    const profile = CUSTOMER_PROFILES[c.name];
    return { ...c, rut: profile?.rut ?? null, address: profile?.address ?? null, city: profile?.city ?? null, created_at: daysAgo(400, 10) };
  };
  const motoRecord = (m: { brand: string; model: string; year: number; plate: string }, km: number, customerId: string): DemoMotorcycle => ({
    id: crypto.randomUUID(),
    vin: null,
    current_km: km,
    ...m,
    customer_id: customerId,
    color: MOTO_DETAILS[m.plate]?.color ?? null,
    notes: MOTO_DETAILS[m.plate]?.notes ?? null,
  });

  // ---- Órdenes de trabajo ---------------------------------------------------
  const firstNumber = WORK_ORDER_FIRST_NUMBER;
  WORK_ORDER_SEED.forEach((o, index) => {
    let customer = customerByName.get(o.customer.name);
    if (!customer) {
      customer = customerRecord({ id: crypto.randomUUID(), ...o.customer });
      db.customers.push(customer);
      customerByName.set(customer.name, customer);
    }

    let moto = motoByPlate.get(o.moto.plate);
    if (!moto) {
      moto = motoRecord(o.moto, o.km, customer.id);
      db.motorcycles.push(moto);
      motoByPlate.set(moto.plate, moto);
    }
    moto.current_km = Math.max(moto.current_km, o.km);

    const number = firstNumber + index;
    const createdAt = daysAgo(o.daysAgo, 9 + (index % 4));
    const closedAt = o.closedDaysAgo !== undefined ? daysAgo(o.closedDaysAgo, 17) : null;
    const workOrder: DemoWorkOrder = {
      id: crypto.randomUUID(),
      number,
      status: o.status,
      motorcycle_id: moto.id,
      mechanic_id: o.mechanic ? mechanicByName.get(o.mechanic)!.id : null,
      intake_reason: o.reason,
      diagnosis: o.diagnosis ?? null,
      km_at_intake: o.km,
      fuel_level: SEED_FUEL_LEVELS[index % SEED_FUEL_LEVELS.length],
      created_at: createdAt,
      updated_at: closedAt ?? createdAt,
      completed_at: o.status === "completed" || o.status === "delivered" ? closedAt ?? createdAt : null,
      delivered_at: o.status === "delivered" ? closedAt : null,
      appointment_id: null,
    };
    db.workOrders.push(workOrder);

    const folio = `OT-${String(number).padStart(4, "0")}`;
    for (const part of o.parts) {
      const product = db.products.find((p) => p.sku === part.sku)!;
      applyStockMovement(db, product.id, -part.qty, "workshop_use", folio, { createdAt });
      db.parts.push({
        id: crypto.randomUUID(),
        work_order_id: workOrder.id,
        product_id: product.id,
        quantity: part.qty,
        unit_price: product.price,
        created_at: createdAt,
      });
    }
    (o.photos ?? []).forEach((photo, i) => {
      const openedAt = new Date(createdAt).getTime();
      const closedAtMs = closedAt ? new Date(closedAt).getTime() : Date.now();
      const at =
        photo.stage === "reception"
          ? openedAt + (10 + i * 3) * 60_000
          : photo.stage === "in_progress"
            ? openedAt + (closedAtMs - openedAt) / 2 + i * 60_000
            : closedAtMs - 30 * 60_000 + i * 60_000;
      db.photos.push({
        id: crypto.randomUUID(),
        work_order_id: workOrder.id,
        stage: photo.stage,
        url: demoPhotoUrl({
          shot: photo.shot,
          stage: photo.stage,
          color: moto.color ?? null,
          plate: moto.plate,
          folio,
          km: o.km,
          label: photo.label,
        }),
        caption: photo.caption,
        created_at: new Date(Math.min(at, Date.now())).toISOString(),
      });
    });

    for (const job of o.labor) {
      db.labor.push({
        id: crypto.randomUUID(),
        work_order_id: workOrder.id,
        description: job.description,
        hours: job.hours,
        hourly_rate: job.rate ?? DEFAULT_HOURLY_RATE,
        line_total: Math.round(job.hours * (job.rate ?? DEFAULT_HOURLY_RATE)),
        created_at: createdAt,
      });
    }
  });
  db.nextWorkOrderNumber = firstNumber + WORK_ORDER_SEED.length;

  // ---- Citas (semana actual, relativas a hoy) ------------------------------
  const today = todayKey();
  const dayFor = (offset: number) => {
    const key = addDays(today, offset);
    return weekdayOf(key) === 0 ? addDays(key, 1) : key; // domingo → lunes
  };

  for (const a of APPOINTMENT_SEED) {
    let moto = motoByPlate.get(a.moto.plate);
    let customerId: string;
    if (moto) {
      customerId = moto.customer_id;
    } else {
      const known = customerByName.get(a.customer.name);
      const customer = known ?? customerRecord({ id: crypto.randomUUID(), name: a.customer.name, phone: a.customer.phone, email: a.customer.email });
      if (!known) {
        db.customers.push(customer);
        customerByName.set(customer.name, customer);
      }
      customerId = customer.id;
      moto = motoRecord(a.moto, a.km ?? 0, customerId);
      db.motorcycles.push(moto);
      motoByPlate.set(moto.plate, moto);
    }

    const date = dayFor(a.day);
    const appointment: DemoAppointment = {
      id: crypto.randomUUID(),
      booking_code: newBookingCode(db),
      customer_id: customerId,
      motorcycle_id: moto.id,
      service_type: a.service,
      scheduled_at: zonedToUtc(date, a.time).toISOString(),
      duration_minutes: SERVICE_DURATION[a.service],
      status: a.status,
      notes: a.notes ?? null,
      source: a.source ?? "staff",
      contact_name: a.customer.name,
      contact_phone: a.customer.phone,
      contact_email: a.customer.email,
      created_at: daysAgo(Math.max(1, 3 - a.day), 12),
    };
    db.appointments.push(appointment);

    // Citas ya convertidas en OT (enlaza con la OT sembrada).
    if (a.convertedTo) {
      const order = db.workOrders.find((o) => o.number === a.convertedTo);
      if (order) order.appointment_id = appointment.id;
    }
  }

  seedSales(db);
  seedWorkshopArchive(db);
  return db;
}

const SALES_HISTORY_DAYS = 150;

/**
 * Reparte las unidades `sold` del inventario en ventas de mostrador y online
 * de los últimos meses. El stock inicial ya las incluye, así que nunca falta.
 */
function seedSales(db: DemoDb) {
  const random = seededRandom(20260925);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(random() * list.length)];

  // Paquetes de 1–3 unidades por producto, mezclados.
  const chunks: { product_id: string; quantity: number }[] = [];
  for (const s of INVENTORY_SEED) {
    const product = db.products.find((p) => p.sku === s.sku)!;
    let remaining = s.sold ?? 0;
    while (remaining > 0) {
      const quantity = Math.min(remaining, 1 + Math.floor(random() * 3));
      chunks.push({ product_id: product.id, quantity });
      remaining -= quantity;
    }
  }
  for (let i = chunks.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [chunks[i], chunks[j]] = [chunks[j], chunks[i]];
  }

  // Tickets de 1–3 paquetes, con fecha dentro del historial.
  const tickets: { lines: typeof chunks; day: number; hour: number }[] = [];
  for (let i = 0; i < chunks.length; ) {
    const size = 1 + Math.floor(random() * 3);
    tickets.push({
      lines: chunks.slice(i, i + size),
      day: 1 + Math.floor(random() * SALES_HISTORY_DAYS),
      hour: 9 + Math.floor(random() * 10),
    });
    i += size;
  }
  tickets.sort((a, b) => b.day - a.day || a.hour - b.hour);

  const buyers = SALES_SEED_BUYERS.flatMap((name) => {
    const customer = db.customers.find((c) => c.name === name);
    if (!customer) return [];
    const address: ShippingAddress = {
      street: customer.address ?? "Retiro en taller",
      city: customer.city ?? "Santiago",
      postal_code: COMUNA_POSTAL_CODE[customer.city ?? ""] ?? "8320000",
    };
    return [{ ...customer, address }];
  });

  for (const ticket of tickets) {
    const online = random() < 0.4;
    const at = daysAgo(ticket.day, ticket.hour);
    if (online) {
      const buyer = pick(buyers);
      const fulfillment: Fulfillment = random() < 0.55 ? "pickup" : "delivery";
      recordDemoSale(db, {
        channel: "online",
        lines: ticket.lines,
        tax_rate: 0,
        payment_method: fulfillment === "pickup" ? pick(["online", "transfer", "cash"] as const) : pick(["online", "transfer"] as const),
        customer_id: buyer.id,
        contact_name: buyer.name,
        contact_email: buyer.email,
        contact_phone: buyer.phone,
        amount_tendered: null,
        fulfillment,
        shipping_address:
          fulfillment === "delivery" ? buyer.address : null,
        notes: null,
        seller_name: null,
        at,
      });
    } else {
      const method = pick(["cash", "cash", "debit_card", "credit_card", "transfer"] as const);
      const customer = random() < 0.3 ? pick(db.customers) : null;
      const sale = recordDemoSale(db, {
        channel: "pos",
        lines: ticket.lines,
        tax_rate: 0,
        payment_method: method,
        customer_id: customer?.id ?? null,
        contact_name: customer?.name ?? null,
        contact_email: customer?.email ?? null,
        contact_phone: customer?.phone ?? null,
        amount_tendered: null,
        fulfillment: null,
        shipping_address: null,
        notes: null,
        seller_name: DEMO_USER,
        at,
      });
      // Efectivo redondeado a la decena de mil superior (para mostrar vuelto).
      if (method === "cash") sale.amount_tendered = Math.ceil(sale.subtotal / 10_000) * 10_000;
    }
  }
}

/** Facturación mensual de OTs anteriores al período sembrado (día 10 de cada mes). */
function seedWorkshopArchive(db: DemoDb) {
  const amounts = [8_400_000, 8_900_000, 8_100_000, 9_500_000, 10_000_000, 7_900_000];
  const thisMonth = startOfMonth(todayKey());
  amounts.forEach((amount, index) => {
    const month = addMonths(thisMonth, index - (amounts.length - 1));
    const at = zonedToUtc(`${month.slice(0, 7)}-10`, "12:00");
    if (at.getTime() < Date.now() - 12 * 86_400_000) {
      db.workshopArchive.push({ at: at.toISOString(), amount });
    }
  });
}

const store = globalThis as typeof globalThis & { __motoopsDemoDb?: DemoDb };

export function demoDb(): DemoDb {
  return (store.__motoopsDemoDb ??= seed());
}
