import { z } from "zod";

const supabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
});

export type SupabaseEnv = { url: string; key: string };

/**
 * Devuelve las credenciales públicas de Supabase, o `null` si aún no están
 * configuradas. Sin credenciales la app corre en "modo demo" con datos dummy.
 *
 * Las variables NEXT_PUBLIC_* se referencian explícitamente para que Next.js
 * pueda inlinearlas en el bundle del cliente.
 */
export function getSupabaseEnv(): SupabaseEnv | null {
  const parsed = supabaseEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  if (!parsed.success) return null;

  return {
    url: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    key: parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function isSupabaseConfigured() {
  return getSupabaseEnv() !== null;
}
