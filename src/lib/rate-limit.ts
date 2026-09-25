import "server-only";

/*
 * Token bucket en memoria del proceso. Cada clave (sesión, IP) tiene `capacity`
 * fichas que se reponen de forma continua a razón de `capacity` por `windowMs`.
 *
 * Es por instancia del servidor: en despliegues con varias instancias cada una
 * cuenta por separado. El tope global en SQL (write_system_log) cubre ese caso.
 */

type Bucket = { tokens: number; updatedAt: number; denied: number };

export type RateLimitResult = {
  allowed: boolean;
  /** true solo en el primer rechazo de una racha (para avisar una sola vez). */
  firstDenied: boolean;
  /** Rechazos acumulados desde el último evento permitido. */
  denied: number;
};

/** Sobre este número de claves se purgan los buckets ya llenos (inactivos). */
const MAX_KEYS = 5000;

const store = globalThis as typeof globalThis & { __motoopsRateLimits?: Map<string, Map<string, Bucket>> };

export function createRateLimiter(name: string, { capacity, windowMs }: { capacity: number; windowMs: number }) {
  const all = (store.__motoopsRateLimits ??= new Map());
  const buckets = all.get(name) ?? new Map<string, Bucket>();
  all.set(name, buckets);
  const refillPerMs = capacity / windowMs;

  function refill(bucket: Bucket, now: number) {
    bucket.tokens = Math.min(capacity, bucket.tokens + (now - bucket.updatedAt) * refillPerMs);
    bucket.updatedAt = now;
  }

  function prune(now: number) {
    if (buckets.size <= MAX_KEYS) return;
    for (const [key, bucket] of buckets) {
      refill(bucket, now);
      if (bucket.tokens >= capacity) buckets.delete(key);
    }
  }

  return {
    take(key: string, now = Date.now()): RateLimitResult {
      let bucket = buckets.get(key);
      if (!bucket) {
        prune(now);
        bucket = { tokens: capacity, updatedAt: now, denied: 0 };
        buckets.set(key, bucket);
      }
      refill(bucket, now);

      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        const denied = bucket.denied;
        bucket.denied = 0;
        return { allowed: true, firstDenied: false, denied };
      }
      bucket.denied += 1;
      return { allowed: false, firstDenied: bucket.denied === 1, denied: bucket.denied };
    },
  };
}
