import "server-only";
import { applyStockMovement, demoDb, insertDemoWorkOrder, type DemoDb, type DemoWorkOrder } from "@/lib/demo/db";
import { normalizeText } from "@/lib/inventory/demo-repository";
import { normalizePlate } from "@/lib/validations/schemas";
import {
  WorkOrderError,
  type Customer,
  type Motorcycle,
  type WorkOrderCounts,
  type WorkOrderDetail,
  type WorkOrderRepository,
  type WorkOrderSummary,
} from "./types";
import { ALL_STATUSES, canTransition, formatFolio, isEditable, parseFolioQuery } from "./workflow";

/* Repositorio de órdenes en memoria (modo demo). Mismas reglas que el SQL. */

const round2 = (n: number) => Math.round(n * 100) / 100;

function findOrder(db: DemoDb, id: string) {
  const order = db.workOrders.find((o) => o.id === id);
  if (!order) throw new WorkOrderError("Orden de trabajo no encontrada");
  return order;
}

function assertEditable(order: DemoWorkOrder) {
  if (!isEditable(order.status)) {
    throw new WorkOrderError("La orden está cerrada y no admite cambios");
  }
}

function toSummary(db: DemoDb, o: DemoWorkOrder): WorkOrderSummary {
  const moto = db.motorcycles.find((m) => m.id === o.motorcycle_id)!;
  const customer = db.customers.find((c) => c.id === moto.customer_id)!;
  const mechanic = o.mechanic_id ? db.mechanics.find((m) => m.id === o.mechanic_id) ?? null : null;
  const parts_amount = round2(
    db.parts.filter((p) => p.work_order_id === o.id).reduce((s, p) => s + p.quantity * p.unit_price, 0)
  );
  const labor_amount = round2(
    db.labor.filter((l) => l.work_order_id === o.id).reduce((s, l) => s + l.line_total, 0)
  );
  return {
    id: o.id,
    number: o.number,
    folio: formatFolio(o.number),
    status: o.status,
    intake_reason: o.intake_reason,
    diagnosis: o.diagnosis,
    km_at_intake: o.km_at_intake,
    fuel_level: o.fuel_level ?? null,
    parts_amount,
    labor_amount,
    total_amount: round2(parts_amount + labor_amount),
    created_at: o.created_at,
    updated_at: o.updated_at,
    completed_at: o.completed_at,
    delivered_at: o.delivered_at,
    motorcycle: toMotorcycle(moto),
    customer: { ...customer },
    mechanic: mechanic ? { ...mechanic } : null,
    appointment_code: o.appointment_id
      ? db.appointments.find((a) => a.id === o.appointment_id)?.booking_code ?? null
      : null,
  };
}

function toMotorcycle(m: DemoDb["motorcycles"][number]): Motorcycle {
  return { id: m.id, brand: m.brand, model: m.model, year: m.year, plate: m.plate, vin: m.vin, current_km: m.current_km };
}

function touch(order: DemoWorkOrder) {
  order.updated_at = new Date().toISOString();
}

export const demoWorkOrderRepository: WorkOrderRepository = {
  async list({ q, status }) {
    const db = demoDb();
    const folio = q ? parseFolioQuery(q) : null;
    const term = q && folio === null ? normalizeText(q) : "";
    return db.workOrders
      .filter((o) => status === "all" || o.status === status)
      .filter((o) => folio === null || o.number === folio)
      .map((o) => toSummary(db, o))
      .filter((o) => {
        if (!term) return true;
        const haystack = normalizeText(
          [o.folio, o.number, o.motorcycle.plate, o.customer.name, o.motorcycle.brand, o.motorcycle.model].join(" ")
        );
        return haystack.includes(term) || haystack.includes(normalizePlate(term).toLowerCase());
      })
      .sort((a, b) => b.number - a.number);
  },

  async counts() {
    const counts = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as WorkOrderCounts;
    for (const o of demoDb().workOrders) counts[o.status]++;
    return counts;
  },

  async detail(id) {
    const db = demoDb();
    const order = db.workOrders.find((o) => o.id === id);
    if (!order) return null;

    const detail: WorkOrderDetail = {
      ...toSummary(db, order),
      parts: db.parts
        .filter((p) => p.work_order_id === id)
        .map((p) => {
          const product = db.products.find((x) => x.id === p.product_id)!;
          return {
            id: p.id,
            product_id: p.product_id,
            product_name: product.name,
            sku: product.sku,
            quantity: p.quantity,
            unit_price: p.unit_price,
            line_total: round2(p.quantity * p.unit_price),
            created_at: p.created_at,
          };
        })
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
      labor: db.labor
        .filter((l) => l.work_order_id === id)
        .map((l) => ({
          id: l.id,
          description: l.description,
          hours: l.hours,
          hourly_rate: l.hourly_rate,
          line_total: l.line_total,
          created_at: l.created_at,
        }))
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    };
    return detail;
  },

  async create(input) {
    const db = demoDb();
    let motorcycleId = input.motorcycle_id ?? null;

    if (input.motorcycle_mode === "existing") {
      const moto = db.motorcycles.find((m) => m.id === motorcycleId);
      if (!moto) throw new WorkOrderError("Moto no encontrada", "plate");
      if (input.km < moto.current_km) {
        throw new WorkOrderError(`El kilometraje es menor al último registrado (${moto.current_km} km)`, "km");
      }
      moto.current_km = input.km;
    } else {
      if (db.motorcycles.some((m) => m.plate === input.plate)) {
        throw new WorkOrderError("Ya existe una moto con esa patente", "plate");
      }
      let customerId = input.customer_id ?? null;
      if (input.customer_mode === "new") {
        const email = input.customer_email || null;
        if (email && db.customers.some((c) => c.email?.toLowerCase() === email)) {
          throw new WorkOrderError("Ya existe un cliente con ese email", "customer_email");
        }
        const customer: Customer = {
          id: crypto.randomUUID(),
          name: input.customer_name,
          phone: input.customer_phone || null,
          email,
        };
        db.customers.push(customer);
        customerId = customer.id;
      } else if (!db.customers.some((c) => c.id === customerId)) {
        throw new WorkOrderError("Cliente no encontrado", "customer_id");
      }

      motorcycleId = crypto.randomUUID();
      db.motorcycles.push({
        id: motorcycleId,
        customer_id: customerId!,
        brand: input.brand,
        model: input.model,
        year: input.year!,
        plate: input.plate,
        vin: input.vin,
        current_km: input.km,
      });
    }

    if (input.mechanic_id && !db.mechanics.some((m) => m.id === input.mechanic_id)) {
      throw new WorkOrderError("Mecánico no encontrado", "mechanic_id");
    }

    const order = insertDemoWorkOrder(db, {
      motorcycle_id: motorcycleId!,
      mechanic_id: input.mechanic_id,
      intake_reason: input.intake_reason,
      km: input.km,
    });
    return toSummary(db, order);
  },

  async updateStatus(id, status) {
    const db = demoDb();
    const order = findOrder(db, id);
    if (!canTransition(order.status, status)) {
      throw new WorkOrderError("Transición de estado no permitida");
    }
    if (status === "cancelled" && db.parts.some((p) => p.work_order_id === id)) {
      throw new WorkOrderError("Quita los repuestos de la orden antes de cancelarla (se devuelven al stock)");
    }
    const now = new Date().toISOString();
    if (status === "open" || status === "in_progress" || status === "waiting_parts") {
      order.completed_at = null;
      order.delivered_at = null;
    }
    if (status === "completed" || status === "delivered") order.completed_at ??= now;
    if (status === "delivered") order.delivered_at = now;
    order.status = status;
    touch(order);
  },

  async updateDetails(id, { diagnosis, mechanic_id }) {
    const db = demoDb();
    const order = findOrder(db, id);
    assertEditable(order);
    if (mechanic_id && !db.mechanics.some((m) => m.id === mechanic_id)) {
      throw new WorkOrderError("Mecánico no encontrado", "mechanic_id");
    }
    order.diagnosis = diagnosis;
    order.mechanic_id = mechanic_id;
    touch(order);
  },

  async addPart(workOrderId, productId, quantity, unitPrice) {
    const db = demoDb();
    const order = findOrder(db, workOrderId);
    assertEditable(order);
    const product = db.products.find((p) => p.id === productId);
    if (!product) throw new WorkOrderError("Producto no encontrado", "product_id");

    try {
      applyStockMovement(db, productId, -quantity, "workshop_use", formatFolio(order.number));
    } catch {
      throw new WorkOrderError(
        `Stock insuficiente: quedan ${product.stock} u. de ${product.name}`,
        "quantity"
      );
    }
    db.parts.push({
      id: crypto.randomUUID(),
      work_order_id: workOrderId,
      product_id: productId,
      quantity,
      unit_price: unitPrice ?? product.price,
      created_at: new Date().toISOString(),
    });
    touch(order);
  },

  async removePart(workOrderId, partId) {
    const db = demoDb();
    const part = db.parts.find((p) => p.id === partId && p.work_order_id === workOrderId);
    if (!part) throw new WorkOrderError("El repuesto no pertenece a esta orden");
    const order = findOrder(db, workOrderId);
    assertEditable(order);

    applyStockMovement(db, part.product_id, part.quantity, "workshop_return", `${formatFolio(order.number)} (devolución)`);
    db.parts = db.parts.filter((p) => p.id !== partId);
    touch(order);
  },

  async addLabor(workOrderId, { description, hours, hourly_rate }) {
    const db = demoDb();
    const order = findOrder(db, workOrderId);
    assertEditable(order);
    db.labor.push({
      id: crypto.randomUUID(),
      work_order_id: workOrderId,
      description,
      hours,
      hourly_rate,
      line_total: round2(hours * hourly_rate),
      created_at: new Date().toISOString(),
    });
    touch(order);
  },

  async removeLabor(workOrderId, laborId) {
    const db = demoDb();
    const order = findOrder(db, workOrderId);
    assertEditable(order);
    if (!db.labor.some((l) => l.id === laborId && l.work_order_id === workOrderId)) {
      throw new WorkOrderError("El trabajo no pertenece a esta orden");
    }
    db.labor = db.labor.filter((l) => l.id !== laborId);
    touch(order);
  },

  async mechanics() {
    return [...demoDb().mechanics].sort((a, b) => a.name.localeCompare(b.name, "es"));
  },

  async searchCustomers(query) {
    const term = normalizeText(query);
    return demoDb()
      .customers.filter((c) => normalizeText(`${c.name} ${c.phone ?? ""} ${c.email ?? ""}`).includes(term))
      .slice(0, 8)
      .map((c) => ({ ...c }));
  },

  async findMotorcycleByPlate(plate) {
    const db = demoDb();
    const moto = db.motorcycles.find((m) => m.plate === normalizePlate(plate));
    if (!moto) return null;
    const customer = db.customers.find((c) => c.id === moto.customer_id)!;
    return { motorcycle: toMotorcycle(moto), customer: { ...customer } };
  },
};
