import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { demoBillingRepository } from "./demo-repository";
import { supabaseBillingRepository } from "./supabase-repository";
import type { BillingRepository } from "./types";

/** Supabase si está configurado; si no, el repositorio demo en memoria. */
export function getBillingRepository(): BillingRepository {
  return isSupabaseConfigured() ? supabaseBillingRepository : demoBillingRepository;
}
