import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { demoLogRepository } from "./demo-repository";
import { supabaseLogRepository } from "./supabase-repository";
import type { LogRepository } from "./types";

/** Supabase si está configurado; si no, el búfer demo en memoria. */
export function getLogRepository(): LogRepository {
  return isSupabaseConfigured() ? supabaseLogRepository : demoLogRepository;
}
