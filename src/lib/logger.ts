import "server-only";
import { headers } from "next/headers";
import { after } from "next/server";
import type { ZodError } from "zod";
import { getLogRepository } from "@/lib/logs/repository";
import type { LogLevel, LogSource } from "@/lib/logs/types";
import { createRateLimiter } from "@/lib/rate-limit";
import { PRIMARY_WORKSHOP_ID } from "@/lib/workshops/shared";

/*
 * Logger del servidor → tabla system_logs (visor «Diagnóstico Dev» del superadmin).
 *
 * - Nunca lanza: un fallo al registrar no puede romper la acción que falló.
 * - No bloquea la respuesta: persiste con after() (un insert por evento).
 * - Sanea la metadata: oculta secretos y recorta data URLs y textos largos.
 * - Limita la frecuencia por sesión / IP (token bucket) y recorta mensaje y
 *   stack por bytes antes de llamar a la RPC, para no saturar la base de datos.
 */

type LogInput = {
  level: LogLevel;
  source?: LogSource;
  message: string;
  error?: unknown;
  metadata?: Record<string, unknown>;
  /** Por defecto: el taller de la sesión (o el del modo soporte). */
  workshopId?: string | null;
};

/** Topes en bytes UTF-8 antes de llamar a write_system_log (la tabla aplica los suyos igual). */
export const LOG_BYTE_LIMITS = {
  message: 2000,
  stack: 20_000,
  /** Lo que envía el navegador es input no confiable: más corto. */
  clientMessage: 2000,
  clientStack: 2000,
} as const;
const MAX_STRING = 500;
const MAX_METADATA_CHARS = 16_000;
const SECRET_KEY = /pass(word)?|token|secret|api[-_]?key|authorization|cookie/i;

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max)}… [+${text.length - max} caracteres]` : text;
}

/** Recorta a `maxBytes` en UTF-8 sin partir caracteres multibyte (ñ, tildes, emoji). */
export function truncateBytes(text: string, maxBytes: number): string {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length <= maxBytes) return text;
  const suffix = ` … [recortado: ${bytes.length} bytes]`;
  const room = Math.max(0, maxBytes - new TextEncoder().encode(suffix).length);
  // Un corte a mitad de carácter decodifica como U+FFFD: se descarta.
  const head = new TextDecoder().decode(bytes.slice(0, room)).replace(/�+$/, "");
  return head + suffix;
}

/** Errores del navegador: 5 por minuto por sesión / IP y 60 por minuto en total. */
const clientPerKey = createRateLimiter("logs:client", { capacity: 5, windowMs: 60_000 });
const clientGlobal = createRateLimiter("logs:client:global", { capacity: 60, windowMs: 60_000 });
/** Eventos del servidor: 30 por minuto por sesión / IP (p. ej. un bot enviando formularios inválidos). */
const serverPerKey = createRateLimiter("logs:server", { capacity: 30, windowMs: 60_000 });

function takeLogToken(source: LogSource, key: string) {
  if (source !== "client_error") return serverPerKey.take(key);
  const perKey = clientPerKey.take(key);
  return perKey.allowed ? clientGlobal.take("global") : perKey;
}

/** IP del cliente según el proxy (Vercel / Supabase Edge envían x-forwarded-for). */
export async function clientIp() {
  try {
    const h = await headers();
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconocida";
  } catch {
    return "desconocida";
  }
}

/** Copia apta para JSON: sin secretos, sin data URLs completas, con profundidad y tamaño acotados. */
export function sanitize(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === "string") {
    if (value.startsWith("data:")) return `[data URL · ${Math.round((value.length * 3) / 4 / 1024)} KB]`;
    return truncate(value, MAX_STRING);
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof File !== "undefined" && value instanceof File) return `[File ${value.name} · ${value.type} · ${Math.round(value.size / 1024)} KB]`;
  if (depth >= 5) return "[…]";
  if (Array.isArray(value)) {
    const items = value.slice(0, 20).map((v) => sanitize(v, depth + 1));
    return value.length > 20 ? [...items, `[+${value.length - 20} elementos]`] : items;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SECRET_KEY.test(k) ? "[oculto]" : sanitize(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

/** Error, PostgrestError / StorageError (objetos con message/code) o cualquier valor. */
function describeError(error: unknown): { message: string; stack: string | null; details: Record<string, unknown> } {
  if (error instanceof Error) {
    const { name, message, stack, cause, ...rest } = error as Error & Record<string, unknown>;
    return { message, stack: stack ?? null, details: { name, ...rest, ...(cause ? { cause: String(cause) } : {}) } };
  }
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    return { message: String(e.message ?? JSON.stringify(e)), stack: null, details: e };
  }
  return { message: String(error), stack: null, details: {} };
}

/** Quién y en qué taller: la sesión actual (import diferido para evitar ciclos con auth). */
async function sessionContext() {
  const ip = await clientIp();
  try {
    const { getCurrentProfile } = await import("@/lib/auth");
    const profile = await getCurrentProfile();
    // Clave del rate limit: la sesión si la hay; si no, la IP.
    if (!profile) return { workshopId: PRIMARY_WORKSHOP_ID, user: null, rateKey: `ip:${ip}` };
    return {
      // Público (reservas, tienda) y staff sin taller: sus datos son del taller principal.
      workshopId: profile.support?.workshopId ?? profile.workshopId ?? (profile.role === "superadmin" ? null : PRIMARY_WORKSHOP_ID),
      user: { id: profile.id, email: profile.email, role: profile.role, support: Boolean(profile.support) },
      rateKey: `user:${profile.id}`,
    };
  } catch {
    return { workshopId: null, user: null, rateKey: `ip:${ip}` };
  }
}

async function persist(input: LogInput, stack: string | null, errorInfo: ReturnType<typeof describeError> | null) {
  try {
    const ctx = await sessionContext();
    const source = input.source ?? "server_action";
    const rate = takeLogToken(source, ctx.rateKey);
    if (!rate.allowed) {
      // Descartado sin tocar la base de datos; se avisa en consola una vez por racha.
      if (rate.firstDenied) console.warn(`[logger] Rate limit (${source}) alcanzado para ${ctx.rateKey}: se descartan eventos`);
      return;
    }

    let metadata = sanitize({
      ...(input.metadata ?? {}),
      ...(errorInfo && Object.keys(errorInfo.details).length ? { error: errorInfo.details } : {}),
      ...(ctx.user ? { user: ctx.user } : {}),
      // Cuántos eventos de esta sesión / IP se descartaron antes de este.
      ...(rate.denied ? { rate_limited_before: rate.denied } : {}),
    }) as Record<string, unknown>;
    const serialized = JSON.stringify(metadata);
    if (serialized.length > MAX_METADATA_CHARS) metadata = { truncated: true, preview: serialized.slice(0, MAX_METADATA_CHARS) };

    const client = source === "client_error";
    await getLogRepository().insert({
      workshop_id: input.workshopId === undefined ? ctx.workshopId : input.workshopId,
      level: input.level,
      source,
      message: truncateBytes(input.message, client ? LOG_BYTE_LIMITS.clientMessage : LOG_BYTE_LIMITS.message),
      stack_trace: stack ? truncateBytes(stack, client ? LOG_BYTE_LIMITS.clientStack : LOG_BYTE_LIMITS.stack) : null,
      metadata,
    });
  } catch (err) {
    console.error("[logger] No se pudo registrar el evento", err);
  }
}

/** Registra un evento. Imprime en consola al instante y lo persiste tras la respuesta. */
export function logEvent(input: LogInput): void {
  const errorInfo = input.error === undefined ? null : describeError(input.error);
  // El stack se captura aquí (síncrono) para conservar el llamador aunque no haya Error.
  const stack = errorInfo?.stack ?? (input.level === "info" ? null : new Error(input.message).stack ?? null);

  const print = input.level === "error" ? console.error : input.level === "warn" ? console.warn : console.info;
  print(`[${input.level}] ${input.message}`, input.error ?? "");

  try {
    after(() => persist(input, stack, errorInfo));
  } catch {
    // Fuera de un request (scripts, build): se persiste de inmediato.
    void persist(input, stack, errorInfo);
  }
}

/** Excepción inesperada en una Server Action o repositorio. */
export function logActionError(scope: string, error: unknown, metadata?: Record<string, unknown>) {
  logEvent({ level: "error", message: `[${scope}] ${describeError(error).message}`, error, metadata });
}

/**
 * El servidor rechazó datos que el formulario ya había validado: suele indicar
 * que cliente y servidor no usan el mismo contrato. Se registra como warn.
 */
export function logValidationFailure(error: ZodError) {
  const issues = error.issues.map((i) => ({ path: i.path.join(".") || "_form", code: i.code, message: i.message }));
  logEvent({
    level: "warn",
    message: `Validación rechazada en el servidor: ${[...new Set(issues.map((i) => i.path))].join(", ")}`,
    metadata: { zod: issues },
  });
}
