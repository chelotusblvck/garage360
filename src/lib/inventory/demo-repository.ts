import "server-only";
import { applyStockMovement, demoDb } from "@/lib/demo/db";
import { getStockStatus } from "./constants";
import { computeStats, withRunningBalance } from "./shared";
import { InventoryError, type InventoryRepository, type Product } from "./types";

/* Repositorio de inventario en memoria (modo demo). Estado en lib/demo/db. */

const byName = (a: Product, b: Product) => a.name.localeCompare(b.name, "es");
export const normalizeText = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function findProduct(id: string) {
  const product = demoDb().products.find((p) => p.id === id);
  if (!product) throw new InventoryError("Producto no encontrado");
  return product;
}

function assertUniqueSku(sku: string, exceptId?: string) {
  const clash = demoDb().products.some(
    (p) => p.id !== exceptId && p.sku.toUpperCase() === sku.toUpperCase()
  );
  if (clash) throw new InventoryError("Ya existe un producto con ese SKU", "sku");
}

/** Traduce los errores del helper de stock a errores de negocio. */
function move(...args: Parameters<typeof applyStockMovement>) {
  try {
    return applyStockMovement(...args);
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      throw new InventoryError(
        "Stock insuficiente: no puedes retirar más unidades de las disponibles",
        "quantity"
      );
    }
    throw new InventoryError("Producto no encontrado");
  }
}

export const demoInventoryRepository: InventoryRepository = {
  async list({ q, category, status }) {
    const term = q ? normalizeText(q) : "";
    return demoDb()
      .products.filter((p) => !term || normalizeText(`${p.name} ${p.sku}`).includes(term))
      .filter((p) => !category || p.category === category)
      .filter((p) => status === "all" || p.stock_status === status)
      .sort(byName)
      .map((p) => ({ ...p }));
  },

  async stats() {
    return computeStats(demoDb().products);
  },

  async categories() {
    return [...new Set(demoDb().products.map((p) => p.category))].sort((a, b) => a.localeCompare(b, "es"));
  },

  async lowStock(limit = 8) {
    return demoDb()
      .products.filter((p) => p.is_active && p.stock_status !== "ok")
      .sort((a, b) => a.stock / Math.max(a.min_stock, 1) - b.stock / Math.max(b.min_stock, 1))
      .slice(0, limit)
      .map((p) => ({ ...p }));
  },

  async create(input) {
    assertUniqueSku(input.sku);
    const db = demoDb();
    const now = new Date().toISOString();
    const product: Product = {
      id: crypto.randomUUID(),
      ...input,
      stock: 0,
      stock_status: getStockStatus(0, input.min_stock),
      created_at: now,
      updated_at: now,
    };
    db.products.push(product);
    if (input.stock > 0) move(db, product.id, input.stock, "purchase", "Stock inicial");
    return { ...product };
  },

  async update(id, input) {
    const db = demoDb();
    const product = findProduct(id);
    assertUniqueSku(input.sku, id);
    const delta = input.stock - product.stock;

    Object.assign(product, { ...input, stock: product.stock });
    if (delta !== 0) move(db, id, delta, "adjustment", "Corrección desde edición de producto");
    product.stock_status = getStockStatus(product.stock, product.min_stock);
    product.updated_at = new Date().toISOString();
    return { ...product };
  },

  async adjust(productId, delta, reason, note) {
    findProduct(productId);
    return { ...move(demoDb(), productId, delta, reason, note) };
  },

  async movements(productId, limit = 25) {
    const product = findProduct(productId);
    const rows = demoDb()
      .movements.filter((m) => m.product_id === productId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
      .slice(0, limit);
    return withRunningBalance(product.stock, rows);
  },

  async uploadImage(file) {
    // En demo no hay Storage: se guarda como data URL (ya comprimida en el cliente).
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    return `data:${file.type};base64,${base64}`;
  },
};
