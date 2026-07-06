/**
 * Per-IP in-memory rate limiter. Sliding window.
 *
 * In-memory means per-Vercel-instance: with N concurrent serverless
 * instances the effective limit is N × `max`. Acceptable for the
 * volumes we serve; swap for Vercel KV if we ever multi-tenant.
 */

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  /** Milliseconds until the next request would be allowed. 0 if `allowed` is true. */
  retryAfterMs: number;
}

export function rateLimit(args: {
  key: string;
  max: number;
  windowMs: number;
  now?: number;
}): RateLimitResult {
  const { key, max, windowMs } = args;
  const now = args.now ?? Date.now();
  const cutoff = now - windowMs;

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= max) {
    const earliest = bucket.timestamps[0];
    return { allowed: false, retryAfterMs: Math.max(0, (earliest + windowMs) - now) };
  }
  bucket.timestamps.push(now);
  return { allowed: true, retryAfterMs: 0 };
}
