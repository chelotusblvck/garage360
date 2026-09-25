"use client";

import { useSyncExternalStore } from "react";
import { formatCurrency } from "@/lib/format";
import type { CatalogProduct } from "@/lib/sales/catalog";

/*
 * Carrito de la tienda online: vive en localStorage (sobrevive recargas y se
 * sincroniza entre pestañas). Guarda una copia de nombre/precio/stock solo
 * para mostrar; el checkout la reconcilia con el catálogo y el precio final
 * lo fija la base de datos.
 */

export type CartLine = Pick<CatalogProduct, "id" | "name" | "sku" | "price" | "image_url" | "stock"> & {
  quantity: number;
};

const KEY = "motoops.cart.v1";
const EMPTY: CartLine[] = [];
const listeners = new Set<() => void>();
let cache: CartLine[] | null = null;

function isLine(value: unknown): value is CartLine {
  const v = value as CartLine;
  return (
    typeof v === "object" &&
    v !== null &&
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.price === "number" &&
    Number.isInteger(v.quantity) &&
    v.quantity > 0
  );
}

function read(): CartLine[] {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    cache = Array.isArray(parsed) ? parsed.filter(isLine) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(lines: CartLine[]) {
  cache = lines;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    // Modo privado / cuota llena: el carrito sigue en memoria.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export const cart = {
  /** Agrega unidades respetando el stock y el máximo por producto. Devuelve la cantidad final. */
  add(product: Omit<CartLine, "quantity">, quantity: number, maxPerProduct: number): number {
    const lines = read();
    const current = lines.find((l) => l.id === product.id)?.quantity ?? 0;
    const next = Math.min(current + quantity, product.stock, maxPerProduct);
    if (next <= 0 || next === current) return current;
    write(
      current > 0
        ? lines.map((l) => (l.id === product.id ? { ...l, ...product, quantity: next } : l))
        : [...lines, { ...product, quantity: next }]
    );
    return next;
  },

  setQuantity(id: string, quantity: number, maxPerProduct: number) {
    const lines = read();
    if (!Number.isFinite(quantity)) return;
    if (quantity <= 0) {
      write(lines.filter((l) => l.id !== id));
      return;
    }
    write(
      lines.map((l) =>
        l.id === id ? { ...l, quantity: Math.max(1, Math.min(Math.floor(quantity), l.stock, maxPerProduct)) } : l
      )
    );
  },

  remove(id: string) {
    write(read().filter((l) => l.id !== id));
  },

  clear() {
    write([]);
  },
};

/**
 * Alinea el carrito con el catálogo vigente (función pura): precios y stock
 * actuales, sin productos inexistentes o agotados y con cantidades recortadas.
 * `notes` explica los cambios al comprador.
 */
export function resolveCart(lines: CartLine[], products: CatalogProduct[], maxPerProduct: number) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const notes: string[] = [];
  const resolved: CartLine[] = [];
  for (const line of lines) {
    const product = byId.get(line.id);
    if (!product || product.stock <= 0) {
      notes.push(`«${line.name}» ya no está disponible y no se incluirá en el pedido.`);
      continue;
    }
    const quantity = Math.min(line.quantity, product.stock, maxPerProduct);
    if (quantity < line.quantity) notes.push(`«${product.name}»: solo quedan ${product.stock} u.`);
    if (product.price !== line.price) {
      notes.push(`«${product.name}» cambió de precio: ahora cuesta ${formatCurrency(product.price)}.`);
    }
    resolved.push({
      id: product.id,
      name: product.name,
      sku: product.sku,
      price: product.price,
      image_url: product.image_url,
      stock: product.stock,
      quantity,
    });
  }
  return { lines: resolved, notes };
}

export function useCart() {
  const lines = useSyncExternalStore(subscribe, read, () => EMPTY);
  const count = lines.reduce((sum, l) => sum + l.quantity, 0);
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
  return { lines, count, subtotal };
}
