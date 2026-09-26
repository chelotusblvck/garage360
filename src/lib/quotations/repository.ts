import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { demoQuotationRepository } from "./demo-repository";
import { supabaseQuotationRepository } from "./supabase-repository";
import type { QuotationRepository } from "./types";

/** Supabase si está configurado; si no, el repositorio demo en memoria. */
export function getQuotationRepository(): QuotationRepository {
  return isSupabaseConfigured() ? supabaseQuotationRepository : demoQuotationRepository;
}
