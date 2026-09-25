import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { demoCheckInRepository } from "./demo-repository";
import { supabaseCheckInRepository } from "./supabase-repository";
import type { CheckInRepository } from "./types";

/** Supabase si está configurado; si no, el repositorio demo en memoria. */
export function getCheckInRepository(): CheckInRepository {
  return isSupabaseConfigured() ? supabaseCheckInRepository : demoCheckInRepository;
}
