import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CATEGORIES } from "./constants";
import { computeStats, sanitizeSearch, withRunningBalance } from "./shared";
import {
  InventoryError,
  type InventoryReason,
  type InventoryRepository,
  type Product,
  type StockStatus,
} from "./types";

const BUCKET = "product-images";
const PRODUCT_COLUMNS =
  "id, name, sku, description, category, price, cost, stock, min_stock, image_url, is_active, stock_status, created_at, updated_at";

type ProductRow = Record<keyof Product, unknown>;

/** PostgREST puede devolver numeric como string: normalizamos. */
function toProduct(row: ProductRow): Product {
  return {
    id: String(row.id),
    name: String(row.name),
    sku: String(row.sku),
    description: (row.description as string | null) ?? null,
    category: String(row.category),
    price: Number(row.price),
    cost: row.cost === null || row.cost === undefined ? null : Number(row.cost),
    stock: Number(row.stock),
    min_stock: Number(row.min_stock),
    image_url: (row.image_url as string | null) ?? null,
    is_active: Boolean(row.is_active),
    stock_status: row.stock_status as StockStatus,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

/** Traduce errores de Postgres a mensajes de negocio. */
function fail(error: PostgrestError): never {
  switch (error.code) {
    case "23505":
      throw new InventoryError("Ya existe un producto con ese SKU", "sku");
    case "23514":
      throw new InventoryError(
        error.message.startsWith("Stock insuficiente")
          ? error.message
          : "Algún valor no cumple las reglas del inventario",
        error.message.startsWith("Stock insuficiente") ? "quantity" : undefined
      );
    case "42501":
      throw new InventoryError("No tienes permisos para esta operación");
    case "P0002":
    case "PGRST116":
      throw new InventoryError("Producto no encontrado");
    default:
      console.error("[inventory] Supabase error", error);
      throw new InventoryError("No se pudo completar la operación. Intenta de nuevo.");
  }
}

async function callAdjust(productId: string, delta: number, reason: InventoryReason, note: string | null) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("adjust_stock", {
      p_product_id: productId,
      p_quantity: delta,
      p_reason: reason,
      p_note: note,
    })
    .single();
  if (error) fail(error);
  return toProduct(data as ProductRow);
}

export const supabaseInventoryRepository: InventoryRepository = {
  async list({ q, category, status }) {
    const supabase = await createClient();
    let query = supabase.from("products").select(PRODUCT_COLUMNS).order("name").limit(500);

    const term = q ? sanitizeSearch(q) : "";
    if (term) query = query.or(`name.ilike.*${term}*,sku.ilike.*${term}*`);
    if (category) query = query.eq("category", category);
    if (status !== "all") query = query.eq("stock_status", status);

    const { data, error } = await query;
    if (error) fail(error);
    return (data as ProductRow[]).map(toProduct);
  },

  async stats() {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("stock, cost, is_active, stock_status");
    if (error) fail(error);
    return computeStats(
      (data ?? []).map((r) => ({
        stock: Number(r.stock),
        cost: r.cost === null ? null : Number(r.cost),
        is_active: Boolean(r.is_active),
        stock_status: r.stock_status as StockStatus,
      }))
    );
  },

  async categories() {
    const supabase = await createClient();
    const { data, error } = await supabase.from("products").select("category");
    if (error) fail(error);
    const used = (data ?? []).map((r) => String(r.category));
    return [...new Set([...used, ...DEFAULT_CATEGORIES])].sort((a, b) => a.localeCompare(b, "es"));
  },

  async lowStock(limit = 8) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_COLUMNS)
      .eq("is_active", true)
      .in("stock_status", ["low", "out"])
      .order("stock")
      .limit(limit);
    if (error) fail(error);
    return (data as ProductRow[]).map(toProduct);
  },

  async create(input) {
    const supabase = await createClient();
    // El trigger products_initial_stock registra el movimiento de stock inicial.
    const { data, error } = await supabase
      .from("products")
      .insert(input)
      .select(PRODUCT_COLUMNS)
      .single();
    if (error) fail(error);
    return toProduct(data as ProductRow);
  },

  async update(id, input) {
    const supabase = await createClient();
    const { data: current, error: readError } = await supabase
      .from("products")
      .select("stock")
      .eq("id", id)
      .single();
    if (readError) fail(readError);

    // El stock nunca se escribe directo: los cambios pasan por adjust_stock()
    // para que queden en la auditoría.
    const { stock, ...fields } = input;
    const { data, error } = await supabase
      .from("products")
      .update(fields)
      .eq("id", id)
      .select(PRODUCT_COLUMNS)
      .single();
    if (error) fail(error);

    const delta = stock - Number(current.stock);
    if (delta !== 0) {
      return callAdjust(id, delta, "adjustment", "Corrección desde edición de producto");
    }
    return toProduct(data as ProductRow);
  },

  adjust: callAdjust,

  async movements(productId, limit = 25) {
    const supabase = await createClient();
    const [{ data: product, error: productError }, { data, error }] = await Promise.all([
      supabase.from("products").select("stock").eq("id", productId).single(),
      supabase
        .from("inventory_movements")
        .select("id, product_id, quantity, reason, note, created_at, author:profiles!inventory_movements_created_by_fkey(name)")
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit),
    ]);
    if (productError) fail(productError);
    if (error) fail(error);

    return withRunningBalance(
      Number(product.stock),
      (data ?? []).map((row) => {
        const author = Array.isArray(row.author) ? row.author[0] : row.author;
        return {
          id: Number(row.id),
          product_id: String(row.product_id),
          quantity: Number(row.quantity),
          reason: row.reason as InventoryReason,
          note: (row.note as string | null) ?? null,
          created_at: String(row.created_at),
          created_by_name: (author as { name?: string } | null)?.name || null,
        };
      })
    );
  },

  async uploadImage(file) {
    const supabase = await createClient();
    const ext = file.type.split("/")[1] ?? "webp";
    const path = `products/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) {
      console.error("[inventory] Storage error", error);
      throw new InventoryError("No se pudo subir la imagen");
    }
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  },
};
