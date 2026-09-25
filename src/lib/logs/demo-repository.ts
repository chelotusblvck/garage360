import "server-only";
import { DEMO_NEW_WORKSHOP_ID } from "@/lib/demo/accounts";
import { demoWorkshopRepository } from "@/lib/workshops/demo-repository";
import { PRIMARY_WORKSHOP_ID } from "@/lib/workshops/shared";
import type { LogRepository, NewSystemLog, SystemLog } from "./types";

/* Logs en memoria (modo demo): búfer circular que se reinicia con el servidor. */

const MAX_LOGS = 500;
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

/** Ejemplos marcados con demo_seed para que el visor no arranque vacío. */
function seed(): SystemLog[] {
  const base = { stack_trace: null, source: "server_action" as const };
  return [
    {
      ...base,
      id: crypto.randomUUID(),
      workshop_id: PRIMARY_WORKSHOP_ID,
      level: "error",
      message: "[customers] Storage error: The object exceeded the maximum allowed size",
      stack_trace:
        "StorageApiError: The object exceeded the maximum allowed size\n    at uploadPhoto (src/lib/customers/supabase-repository.ts:268:13)\n    at async uploadWorkOrderPhoto (src/app/actions/customers.ts:131:19)",
      metadata: { demo_seed: true, error: { name: "StorageApiError", statusCode: "413" }, params: { stage: "process", size_kb: 6144 } },
      created_at: minutesAgo(42),
    },
    {
      ...base,
      id: crypto.randomUUID(),
      workshop_id: PRIMARY_WORKSHOP_ID,
      level: "warn",
      message: "Validación rechazada en el servidor: rut",
      metadata: { demo_seed: true, zod: [{ path: "rut", code: "custom", message: "RUT inválido (revisa el dígito verificador)" }] },
      created_at: minutesAgo(95),
    },
    {
      ...base,
      id: crypto.randomUUID(),
      workshop_id: PRIMARY_WORKSHOP_ID,
      level: "info",
      message: "Onboarding completado",
      metadata: { demo_seed: true, staff: 2 },
      created_at: minutesAgo(60 * 26),
    },
    {
      ...base,
      id: crypto.randomUUID(),
      workshop_id: "00000000-0000-0000-0000-000000000003",
      level: "error",
      message: "[orders] Supabase error: new row violates check constraint \"work_orders_km_positive\"",
      metadata: { demo_seed: true, error: { code: "23514" } },
      created_at: minutesAgo(180),
    },
  ];
}

const store = globalThis as typeof globalThis & { __motoopsDemoLogs?: SystemLog[] };
const logs = () => (store.__motoopsDemoLogs ??= seed());

export const demoLogRepository: LogRepository = {
  async insert(entry: NewSystemLog) {
    const all = logs();
    all.unshift({ ...entry, id: crypto.randomUUID(), created_at: new Date().toISOString() });
    if (all.length > MAX_LOGS) all.length = MAX_LOGS;
  },

  async list(workshopId, limit) {
    return logs()
      .filter((l) => l.workshop_id === workshopId)
      .slice(0, limit)
      .map((l) => ({ ...l }));
  },

  async health(workshopId) {
    const workshop = await demoWorkshopRepository.get(workshopId);
    const since = Date.now() - 24 * 3600_000;
    const errors24h = logs().filter(
      (l) => l.workshop_id === workshopId && l.level === "error" && Date.parse(l.created_at) >= since
    ).length;

    return [
      {
        key: "supabase",
        label: "Conexión a Supabase",
        status: "na",
        summary: "Modo demo: Supabase no está configurado (datos en memoria del servidor)",
        details: ["Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY para chequear la conexión real."],
      },
      {
        key: "storage",
        label: "Bucket de fotos (work-order-photos)",
        status: "na",
        summary: "Modo demo: las fotos se guardan como data URLs en memoria",
        details: [],
      },
      {
        key: "rls",
        label: "Políticas RLS",
        status: "na",
        summary: "Modo demo: sin base de datos, no hay políticas que auditar",
        details: [],
      },
      {
        key: "tenant",
        label: "Estado del taller",
        status: !workshop ? "error" : !workshop.onboarding_completed || errors24h > 0 ? "warn" : "ok",
        summary: !workshop
          ? "El taller no existe"
          : `${workshop.onboarding_completed ? "Onboarding completo" : "Onboarding pendiente"} · ${errors24h} errores en 24 h`,
        details:
          workshop && workshopId === DEMO_NEW_WORKSHOP_ID && !workshop.onboarding_completed
            ? ["Cuenta demo nuevo@motoops.cl: el admin aún no completa el asistente."]
            : [],
      },
    ];
  },
};
