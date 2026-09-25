import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { demoCustomerRepository } from "./demo-repository";
import { supabaseCustomerRepository } from "./supabase-repository";
import type { CustomerRepository } from "./types";

/** Supabase si está configurado; si no, el repositorio demo en memoria. */
export function getCustomerRepository(): CustomerRepository {
  return isSupabaseConfigured() ? supabaseCustomerRepository : demoCustomerRepository;
}
