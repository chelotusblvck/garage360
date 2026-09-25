import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { demoWorkOrderRepository } from "./demo-repository";
import { supabaseWorkOrderRepository } from "./supabase-repository";
import type { WorkOrderRepository } from "./types";

/** Supabase si está configurado; si no, el repositorio demo en memoria. */
export function getWorkOrderRepository(): WorkOrderRepository {
  return isSupabaseConfigured() ? supabaseWorkOrderRepository : demoWorkOrderRepository;
}
