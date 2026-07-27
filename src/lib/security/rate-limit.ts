import { headers } from "next/headers";

/**
 * Lightweight in-memory sliding-window rate limiter.
 *
 * Catatan: pada serverless (Vercel) memori per-instance, jadi ini deterrence
 * terhadap abuse sederhana — bukan limiter terdistribusi. Untuk limit keras
 * lintas instance, pasang Vercel WAF rate limiting / Upstash nanti.
 */

type Bucket = number[];

const store = new Map<string, Bucket>();
const MAX_KEYS = 5000;

function prune(now: number, windowMs: number, bucket: Bucket): Bucket {
  return bucket.filter((t) => now - t < windowMs);
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

export async function rateLimit(params: {
  /** Logical scope, e.g. "interview:submit" */
  scope: string;
  /** Caller identity — token interview, user id, dll */
  identity: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const now = Date.now();

  let ip = "";
  try {
    const h = await headers();
    ip = (h.get("x-forwarded-for") || "").split(",")[0].trim();
  } catch {
    /* headers unavailable — identity-only limiting */
  }

  const key = `${params.scope}:${params.identity}:${ip}`;
  const prev = prune(now, params.windowMs, store.get(key) || []);

  if (prev.length >= params.limit) {
    const oldest = prev[0];
    return {
      ok: false,
      retryAfterSec: Math.max(
        1,
        Math.ceil((params.windowMs - (now - oldest)) / 1000)
      ),
    };
  }

  prev.push(now);
  if (store.size >= MAX_KEYS) {
    // Prevent unbounded growth on long-lived instances
    for (const [k, b] of store) {
      const pruned = prune(now, params.windowMs, b);
      if (pruned.length === 0) store.delete(k);
      else store.set(k, pruned);
    }
  }
  store.set(key, prev);
  return { ok: true };
}

/** Convenience: returns error message string when blocked, else null. */
export async function rateLimitError(params: {
  scope: string;
  identity: string;
  limit: number;
  windowMs: number;
}): Promise<string | null> {
  const result = await rateLimit(params);
  if (result.ok) return null;
  return `Terlalu banyak permintaan. Coba lagi dalam ${result.retryAfterSec} detik.`;
}
