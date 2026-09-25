import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { demoWorkshopRepository } from "./demo-repository";
import { supabaseWorkshopRepository } from "./supabase-repository";
import type { WorkshopRepository } from "./types";

/** Supabase si está configurado; si no, el repositorio demo en memoria. */
export function getWorkshopRepository(): WorkshopRepository {
  return isSupabaseConfigured() ? supabaseWorkshopRepository : demoWorkshopRepository;
}
