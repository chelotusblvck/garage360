import "server-only";
import { addDays, zonedToUtc } from "@/lib/datetime";
import { DEMO_USER, DemoStockError, demoDb, recordDemoSale, type DemoDb, type DemoSale } from "@/lib/demo/db";
import { normalizeText } from "@/lib/inventory/demo-repository";
import { getWorkOrderRepository } from "@/lib/orders/repository";
import { computeTotals, formatSaleFolio, round2 } from "./shared";
import { SalesError, type RevenueEntry, type Sale, type SaleDetail, type SalesRepository } from "./types";

/* Repositorio de ventas en memoria (modo demo). Mismas reglas que el SQL. */

function toSale(db: DemoDb, s: DemoSale): Sale {
  const customer = s.customer_id ? db.customers.find((c) => c.id === s.customer_id) : undefined;
  return {
    id: s.id,
    number: s.number,
    folio: formatSaleFolio(s.number),
    channel: s.channel,
    status: s.status,
    payment_method: s.payment_method,
    subtotal: s.subtotal,
    discount: 0,
    tax: s.tax,
    total: round2(s.subtotal + s.tax),
    amount_tendered: s.amount_tendered,
    customer: {
      id: s.customer_id,
      name: s.contact_name ?? customer?.name ?? null,
      email: s.contact_email ?? customer?.email ?? null,
      phone: s.contact_phone ?? customer?.phone ?? null,
    },
    fulfillment: s.fulfillment,
    shipping_address: s.shipping_address,
    notes: s.notes,
    seller_name: s.seller_name,
    units: s.items.reduce((sum, i) => sum + i.quantity, 0),
    paid_at: s.paid_at,
    created_at: s.created_at,
  };
}

function toDetail(db: DemoDb, s: DemoSale): SaleDetail {
  return {
    ...toSale(db, s),
    items: s.items.map((i) => {
      const product = db.products.find((p) => p.id === i.product_id);
      return {
        product_id: i.product_id,
        product_name: product?.name ?? "Producto eliminado",
        sku: product?.sku ?? "—",
        quantity: i.quantity,
        unit_price: i.unit_price,
        line_total: round2(i.quantity * i.unit_price),
      };
    }),
  };
}

/** Traduce los errores del helper demo a errores de negocio. */
function record(...args: Parameters<typeof recordDemoSale>) {
  try {
    return recordDemoSale(...args);
  } catch (error) {
    if (error instanceof DemoStockError) throw new SalesError(error.message, "items");
    throw new SalesError("Algún producto ya no está disponible. Actualiza el carrito.", "items");
  }
}

export const demoSalesRepository: SalesRepository = {
  async createPosSale(data) {
    const db = demoDb();
    const customer = data.customer_id ? db.customers.find((c) => c.id === data.customer_id) : null;
    if (data.customer_id && !customer) throw new SalesError("Cliente no encontrado");

    // En SQL el rechazo revierte la transacción; aquí se valida antes de mover stock.
    if (data.payment_method === "cash" && data.amount_tendered !== null) {
      const lines = data.items.map((i) => ({
        quantity: i.quantity,
        unit_price: db.products.find((p) => p.id === i.product_id)?.price ?? 0,
      }));
      if (data.amount_tendered < computeTotals(lines, data.tax_rate).total) {
        throw new SalesError("El efectivo recibido es menor al total", "amount_tendered");
      }
    }

    const sale = record(db, {
      channel: "pos",
      lines: data.items,
      tax_rate: data.tax_rate,
      payment_method: data.payment_method,
      customer_id: customer?.id ?? null,
      contact_name: customer?.name ?? null,
      contact_email: customer?.email ?? null,
      contact_phone: customer?.phone ?? null,
      amount_tendered: data.payment_method === "cash" ? data.amount_tendered : null,
      fulfillment: null,
      shipping_address: null,
      notes: data.notes,
      seller_name: DEMO_USER,
    });

    return toDetail(db, sale);
  },

  async createOnlineOrder({ items, customer, shipping, payment_method }) {
    const db = demoDb();
    let buyer = db.customers.find((c) => c.email?.toLowerCase() === customer.email);
    if (!buyer) {
      buyer = { id: crypto.randomUUID(), name: customer.name, phone: customer.phone, email: customer.email };
      db.customers.push(buyer);
    }

    const sale = record(db, {
      channel: "online",
      lines: items,
      tax_rate: 0,
      payment_method,
      customer_id: buyer.id,
      contact_name: customer.name,
      contact_email: customer.email,
      contact_phone: customer.phone,
      amount_tendered: null,
      fulfillment: shipping.fulfillment,
      shipping_address:
        shipping.fulfillment === "delivery"
          ? { street: shipping.street, city: shipping.city, postal_code: shipping.postal_code }
          : null,
      notes: shipping.notes,
      seller_name: null,
    });

    return {
      folio: formatSaleFolio(sale.number),
      total: round2(sale.subtotal + sale.tax),
      paid_at: sale.paid_at,
      fulfillment: shipping.fulfillment,
      payment_method,
      email: customer.email,
    };
  },

  async history({ from, to, channel, payment_method, q }, limit = 500) {
    const db = demoDb();
    const fromMs = from ? zonedToUtc(from).getTime() : -Infinity;
    const toMs = to ? zonedToUtc(addDays(to, 1)).getTime() : Infinity;
    const folioNumber = q?.match(/^(?:v-?)?0*(\d{1,9})$/i)?.[1];
    const term = q && !folioNumber ? normalizeText(q) : "";

    return db.sales
      .filter((s) => {
        const at = new Date(s.created_at).getTime();
        return at >= fromMs && at < toMs;
      })
      .filter((s) => channel === "all" || s.channel === channel)
      .filter((s) => payment_method === "all" || s.payment_method === payment_method)
      .map((s) => toSale(db, s))
      .filter((s) => (folioNumber ? s.number === Number(folioNumber) : true))
      .filter((s) => !term || normalizeText(`${s.customer.name ?? ""} ${s.customer.email ?? ""}`).includes(term))
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.number - a.number)
      .slice(0, limit);
  },

  async detail(id) {
    const db = demoDb();
    const sale = db.sales.find((s) => s.id === id);
    return sale ? toDetail(db, sale) : null;
  },

  async popularity(days = 90) {
    const since = Date.now() - days * 86_400_000;
    const units: Record<string, number> = {};
    for (const sale of demoDb().sales) {
      if (sale.status !== "paid" || new Date(sale.paid_at).getTime() < since) continue;
      for (const item of sale.items) units[item.product_id] = (units[item.product_id] ?? 0) + item.quantity;
    }
    return units;
  },

  async revenue(fromIso) {
    const db = demoDb();
    const entries: RevenueEntry[] = db.sales
      .filter((s) => s.status === "paid" && s.paid_at >= fromIso)
      .map((s) => ({ channel: s.channel, amount: round2(s.subtotal + s.tax), at: s.paid_at }));

    for (const a of db.workshopArchive) {
      if (a.at >= fromIso) entries.push({ channel: "workshop", amount: a.amount, at: a.at });
    }
    // OTs entregadas: el total sale del repositorio de órdenes (mismo cálculo que la UI).
    const delivered = await getWorkOrderRepository().list({ status: "delivered", view: "table" });
    for (const order of delivered) {
      if (order.delivered_at && order.delivered_at >= fromIso) {
        entries.push({ channel: "workshop", amount: order.total_amount, at: order.delivered_at });
      }
    }
    return entries;
  },
};
