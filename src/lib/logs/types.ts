/* Logs del sistema y diagnóstico por taller (solo superadmin). Compartido por cliente y servidor. */

export const LOG_LEVELS = ["error", "warn", "info"] as const;
export const LOG_SOURCES = ["server_action", "api", "client_error", "billing_action"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];
export type LogSource = (typeof LOG_SOURCES)[number];

export type SystemLog = {
  id: string;
  workshop_id: string | null;
  level: LogLevel;
  source: LogSource;
  message: string;
  stack_trace: string | null;
  /** Params saneados, error de Zod, usuario, etc. */
  metadata: Record<string, unknown>;
  created_at: string;
};

export type NewSystemLog = Omit<SystemLog, "id" | "created_at">;

export type HealthStatus = "ok" | "warn" | "error" | "na";

export type HealthCheck = {
  key: "supabase" | "storage" | "rls" | "tenant";
  label: string;
  status: HealthStatus;
  summary: string;
  details: string[];
};

export type TenantDiagnostics = {
  workshop: { id: string; name: string; onboarding_completed: boolean };
  mode: "demo" | "supabase";
  generatedAt: string;
  health: HealthCheck[];
  /** Más recientes primero. */
  logs: SystemLog[];
};

export interface LogRepository {
  /** Un insert por evento (atómico). */
  insert(entry: NewSystemLog): Promise<void>;
  list(workshopId: string, limit: number): Promise<SystemLog[]>;
  health(workshopId: string): Promise<HealthCheck[]>;
}
