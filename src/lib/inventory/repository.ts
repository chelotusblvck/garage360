import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { demoInventoryRepository } from "./demo-repository";
import { supabaseInventoryRepository } from "./supabase-repository";
import type { InventoryRepository } from "./types";

/** Supabase si está configurado; si no, el repositorio demo en memoria. */
export function getInventoryRepository(): InventoryRepository {
  return isSupabaseConfigured() ? supabaseInventoryRepository : demoInventoryRepository;
}
