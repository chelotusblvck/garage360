"use server";

import { z } from "zod";
import { getCurrentProfile, requireSuperadmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { logEvent } from "@/lib/logger";
import { getLogRepository } from "@/lib/logs/repository";
import type { TenantDiagnostics } from "@/lib/logs/types";
import { getWorkshopRepository } from "@/lib/workshops/repository";

// z.guid(): los ids fijos de talleres (00000000-…-0001) no son UUID RFC.
const idSchema = z.guid();

/** Cuántos logs trae el visor por consulta (se filtran y buscan en el navegador). */
const LOG_LIMIT = 200;

/** Panel «Diagnóstico Dev»: logs y health check de un taller. Solo superadmin. */
export async function getTenantDiagnostics(workshopId: string): Promise<TenantDiagnostics | null> {
  await requireSuperadmin();
  const parsed = idSchema.safeParse(workshopId);
  if (!parsed.success) return null;

  const workshop = await getWorkshopRepository().get(parsed.data);
  if (!workshop) return null;

  const repo = getLogRepository();
  const [logs, health] = await Promise.all([
    repo.list(workshop.id, LOG_LIMIT).catch((error: unknown) => {
      console.error("[diagnostics] No se pudieron leer los logs", error);
      return [];
    }),
    repo.health(workshop.id),
  ]);

  return {
    workshop: { id: workshop.id, name: workshop.name, onboarding_completed: workshop.onboarding_completed },
    mode: isSupabaseConfigured() ? "supabase" : "demo",
    generatedAt: new Date().toISOString(),
    health,
    logs,
  };
}

const clientErrorSchema = z.object({
  message: z.string().max(2000),
  stack: z.string().max(20_000).nullish(),
  digest: z.string().max(100).nullish(),
  url: z.string().max(500).nullish(),
});

/** Error de render en el navegador (error boundary del panel). Solo sesiones del staff. */
export async function reportClientError(data: unknown): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role === "client") return;
  const parsed = clientErrorSchema.safeParse(data);
  if (!parsed.success) return;

  const { message, stack, digest, url } = parsed.data;
  logEvent({
    level: "error",
    source: "client_error",
    message: `[client] ${message}`,
    error: Object.assign(new Error(message), { stack: stack ?? undefined, digest: digest ?? undefined }),
    metadata: { url, digest },
  });
}
