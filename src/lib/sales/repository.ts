import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { demoSalesRepository } from "./demo-repository";
import { supabaseSalesRepository } from "./supabase-repository";
import type { SalesRepository } from "./types";

/** Supabase si está configurado; si no, el repositorio demo en memoria. */
export function getSalesRepository(): SalesRepository {
  return isSupabaseConfigured() ? supabaseSalesRepository : demoSalesRepository;
}
