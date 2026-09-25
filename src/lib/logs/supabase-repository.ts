import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { HealthCheck, LogLevel, LogRepository, LogSource, SystemLog } from "./types";

type Row = Record<string, unknown>;

/** Sobre esta latencia (ida y vuelta a la RPC de health) la conexión se marca lenta. */
const SLOW_MS = 800;

function toLog(r: Row): SystemLog {
  return {
    id: String(r.id),
    workshop_id: r.workshop_id ? String(r.workshop_id) : null,
    level: r.level as LogLevel,
    source: r.source as LogSource,
    message: String(r.message),
    stack_trace: r.stack_trace ? String(r.stack_trace) : null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    created_at: String(r.created_at),
  };
}

export const supabaseLogRepository: LogRepository = {
  async insert(entry) {
    const supabase = await createClient();
    // RPC security definer: un solo insert, con límites de tamaño aplicados en SQL.
    const { error } = await supabase.rpc("write_system_log", {
      p_level: entry.level,
      p_source: entry.source,
      p_message: entry.message,
      p_stack_trace: entry.stack_trace,
      p_metadata: entry.metadata,
      p_workshop_id: entry.workshop_id,
    });
    if (error) throw new Error(`write_system_log: ${error.message}`);
  },

  async list(workshopId, limit) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("system_logs")
      .select("id, workshop_id, level, source, message, stack_trace, metadata, created_at")
      .eq("workshop_id", workshopId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`system_logs: ${error.message}`);
    return ((data ?? []) as Row[]).map(toLog);
  },

  async health(workshopId) {
    const supabase = await createClient();
    const started = performance.now();
    const { data, error } = await supabase.rpc("admin_tenant_health", { p_workshop: workshopId });
    const latency = Math.round(performance.now() - started);

    if (error || !data) {
      const reason = error?.message ?? "La RPC admin_tenant_health no devolvió datos (¿falta correr schema.sql?)";
      return [
        { key: "supabase", label: "Conexión a Supabase", status: "error", summary: `Falló en ${latency} ms`, details: [reason] },
        { key: "storage", label: "Bucket de fotos (work-order-photos)", status: "na", summary: "Sin datos: falló la conexión", details: [] },
        { key: "rls", label: "Políticas RLS", status: "na", summary: "Sin datos: falló la conexión", details: [] },
        { key: "tenant", label: "Estado del taller", status: "na", summary: "Sin datos: falló la conexión", details: [] },
      ];
    }

    const h = data as Row;
    const bucket = h.bucket as Row | null;
    const workshop = h.workshop as Row | null;
    const tables = ((h.rls as Row[] | null) ?? []).map((t) => ({
      table: String(t.table),
      enabled: Boolean(t.enabled),
      policies: Number(t.policies),
    }));
    const noRls = tables.filter((t) => !t.enabled);
    const noPolicies = tables.filter((t) => t.enabled && t.policies === 0);
    const errors24h = Number(h.errors_24h ?? 0);

    const checks: HealthCheck[] = [
      {
        key: "supabase",
        label: "Conexión a Supabase",
        status: latency > SLOW_MS ? "warn" : "ok",
        summary: `Respondió en ${latency} ms${latency > SLOW_MS ? " (lento)" : ""}`,
        details: [],
      },
      {
        key: "storage",
        label: "Bucket de fotos (work-order-photos)",
        status: !bucket ? "error" : bucket.public ? "error" : "ok",
        summary: !bucket
          ? "El bucket no existe"
          : bucket.public
            ? "El bucket es PÚBLICO: las fotos de clientes quedan expuestas"
            : `Privado · límite ${Math.round(Number(bucket.file_size_limit ?? 0) / 1_048_576)} MB por archivo · ${Number(bucket.objects ?? 0)} archivos`,
        details: [],
      },
      {
        key: "rls",
        label: "Políticas RLS",
        status: noRls.length ? "error" : noPolicies.length ? "warn" : "ok",
        summary: `${tables.length - noRls.length}/${tables.length} tablas con RLS · ${tables.reduce((s, t) => s + t.policies, 0)} políticas`,
        details: [
          ...noRls.map((t) => `Sin RLS: public.${t.table}`),
          ...noPolicies.map((t) => `RLS activo pero sin políticas (nadie accede salvo funciones definer): public.${t.table}`),
        ],
      },
      {
        key: "tenant",
        label: "Estado del taller",
        status: !workshop ? "error" : !workshop.onboarding_completed || errors24h > 0 ? "warn" : "ok",
        summary: !workshop
          ? "El taller no existe"
          : `${workshop.onboarding_completed ? "Onboarding completo" : "Onboarding pendiente"} · ${Number(workshop.staff_users ?? 0)} usuarios de staff · ${errors24h} errores en 24 h`,
        details: [],
      },
    ];
    return checks;
  },
};
