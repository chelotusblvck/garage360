import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { addDays, zonedToUtc } from "@/lib/datetime";
import { sanitizeSearch } from "@/lib/inventory/shared";
import { createClient } from "@/lib/supabase/server";
import type { Fulfillment, OnlinePaymentMethod, PaymentMethod, SaleStatus } from "@/lib/validations/schemas";
import {
  SalesError,
  type RevenueEntry,
  type Sale,
  type SalesChannel,
  type SalesRepository,
  type ShippingAddress,
} from "./types";

const SALE_COLUMNS =
  "id, number, folio, channel, status, payment_method, subtotal, discount, tax, total, amount_tendered, fulfillment, shipping_address, notes, paid_at, created_at, customer_id, customer_name, customer_email, customer_phone, seller_name, units";

type SaleRow = Record<string, unknown>;

const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

function toSale(row: SaleRow): Sale {
  return {
    id: String(row.id),
    number: num(row.number),
    folio: String(row.folio),
    channel: row.channel as SalesChannel,
    status: row.status as SaleStatus,
    payment_method: (row.payment_method as PaymentMethod | null) ?? null,
    subtotal: num(row.subtotal),
    discount: num(row.discount),
    tax: num(row.tax),
    total: num(row.total),
    amount_tendered: row.amount_tendered === null ? null : num(row.amount_tendered),
    customer: {
      id: str(row.customer_id),
      name: str(row.customer_name),
      email: str(row.customer_email),
      phone: str(row.customer_phone),
    },
    fulfillment: (row.fulfillment as Fulfillment | null) ?? null,
    shipping_address: (row.shipping_address as ShippingAddress | null) ?? null,
    notes: str(row.notes),
    seller_name: str(row.seller_name),
    units: num(row.units),
    paid_at: str(row.paid_at),
    created_at: String(row.created_at),
  };
}

/** Traduce errores de Postgres a mensajes de negocio. */
function fail(error: PostgrestError): never {
  switch (error.code) {
    case "23514":
      throw new SalesError(
        error.message.startsWith("Stock insuficiente") ? error.message : "La venta no cumple las reglas de stock",
        "items"
      );
    case "22023":
      throw new SalesError(error.message);
    case "23503":
      throw new SalesError("Algún producto ya no está disponible. Actualiza el carrito.", "items");
    case "22P02":
      throw new SalesError("Datos de la venta inválidos");
    case "42501":
      throw new SalesError("No tienes permisos para esta operación");
    case "P0002":
    case "PGRST116":
      throw new SalesError(error.message || "Registro no encontrado");
    default:
      console.error("[sales] Supabase error", error);
      throw new SalesError("No se pudo completar la venta. Intenta de nuevo.");
  }
}

export const supabaseSalesRepository: SalesRepository = {
  async createPosSale(data) {
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .rpc("create_pos_sale", {
        p_items: data.items,
        p_payment_method: data.payment_method,
        p_customer_id: data.customer_id,
        p_tax_rate: data.tax_rate,
        p_amount_tendered: data.amount_tendered,
        p_notes: data.notes,
      })
      .single();
    if (error) fail(error);

    const detail = await this.detail(String((row as SaleRow).id));
    if (!detail) throw new SalesError("La venta se registró pero no se pudo leer el ticket");
    return detail;
  },

  async createOnlineOrder(data) {
    const supabase = await createClient();
    const { shipping, customer } = data;
    const { data: row, error } = await supabase
      .rpc("checkout_online", {
        p_items: data.items,
        p_payment_method: data.payment_method,
        p_fulfillment: shipping.fulfillment,
        p_customer_name: customer.name,
        p_customer_email: customer.email,
        p_customer_phone: customer.phone,
        p_shipping_address:
          shipping.fulfillment === "delivery"
            ? { street: shipping.street, city: shipping.city, postal_code: shipping.postal_code }
            : null,
        p_notes: shipping.notes,
      })
      .single();
    if (error) fail(error);

    const r = row as SaleRow;
    return {
      folio: String(r.folio),
      total: num(r.total),
      paid_at: String(r.paid_at),
      fulfillment: shipping.fulfillment,
      payment_method: data.payment_method as OnlinePaymentMethod,
      email: customer.email,
    };
  },

  async history({ from, to, channel, payment_method, q }, limit = 500) {
    const supabase = await createClient();
    let query = supabase
      .from("v_sales")
      .select(SALE_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (from) query = query.gte("created_at", zonedToUtc(from).toISOString());
    if (to) query = query.lt("created_at", zonedToUtc(addDays(to, 1)).toISOString());
    if (channel !== "all") query = query.eq("channel", channel);
    if (payment_method !== "all") query = query.eq("payment_method", payment_method);

    const term = q ? sanitizeSearch(q) : "";
    const folioNumber = term.match(/^(?:v-?)?0*(\d{1,9})$/i)?.[1];
    if (folioNumber) query = query.eq("number", Number(folioNumber));
    else if (term) query = query.or(`customer_name.ilike.*${term}*,customer_email.ilike.*${term}*`);

    const { data, error } = await query;
    if (error) fail(error);
    return (data as SaleRow[]).map(toSale);
  },

  async detail(id) {
    const supabase = await createClient();
    const [{ data: sale, error }, { data: items, error: itemsError }] = await Promise.all([
      supabase.from("v_sales").select(SALE_COLUMNS).eq("id", id).maybeSingle(),
      supabase
        .from("order_items")
        .select("product_id, quantity, unit_price, line_total, product:products(name, sku)")
        .eq("sale_id", id)
        .order("created_at"),
    ]);
    if (error) fail(error);
    if (itemsError) fail(itemsError);
    if (!sale) return null;

    return {
      ...toSale(sale as SaleRow),
      items: (items ?? []).map((row) => {
        const product = (Array.isArray(row.product) ? row.product[0] : row.product) as
          | { name?: string; sku?: string }
          | null;
        return {
          product_id: String(row.product_id),
          product_name: product?.name ?? "Producto eliminado",
          sku: product?.sku ?? "—",
          quantity: num(row.quantity),
          unit_price: num(row.unit_price),
          line_total: num(row.line_total),
        };
      }),
    };
  },

  async popularity(days = 90) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_product_popularity", { p_days: days });
    if (error) fail(error);
    return Object.fromEntries(
      ((data ?? []) as { product_id: string; units: number }[]).map((r) => [r.product_id, Number(r.units)])
    );
  },

  async revenue(fromIso) {
    const supabase = await createClient();
    const [sales, orders] = await Promise.all([
      supabase
        .from("sales")
        .select("channel, total, paid_at")
        .eq("status", "paid")
        .in("channel", ["pos", "online"])
        .gte("paid_at", fromIso)
        .limit(10_000),
      supabase
        .from("work_orders")
        .select("total_amount, delivered_at")
        .eq("status", "delivered")
        .gte("delivered_at", fromIso)
        .limit(10_000),
    ]);
    if (sales.error) fail(sales.error);
    if (orders.error) fail(orders.error);

    const entries: RevenueEntry[] = (sales.data ?? []).map((s) => ({
      channel: s.channel as SalesChannel,
      amount: num(s.total),
      at: String(s.paid_at),
    }));
    for (const o of orders.data ?? []) {
      entries.push({ channel: "workshop", amount: num(o.total_amount), at: String(o.delivered_at) });
    }
    return entries;
  },
};
