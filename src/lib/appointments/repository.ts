import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { demoAppointmentRepository } from "./demo-repository";
import { supabaseAppointmentRepository } from "./supabase-repository";
import type { AppointmentRepository } from "./types";

/** Supabase si está configurado; si no, el repositorio demo en memoria. */
export function getAppointmentRepository(): AppointmentRepository {
  return isSupabaseConfigured() ? supabaseAppointmentRepository : demoAppointmentRepository;
}
