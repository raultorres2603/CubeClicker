/**
 * Keyed fixed-window rate limiter (T8, AC-6, AC-8, AC-14).
 *
 * `allow(key, limit, windowMs)` returns `true` when the call is admitted within
 * the fixed window for `key`, and `false` once `limit` calls have been admitted
 * in the current window. Windows are tracked independently per key, so distinct
 * keys (e.g. `ip:1.2.3.4:register` vs `ip:1.2.3.4:login`) never share budget.
 *
 * The clock is injectable so callers (and tests) can control time deterministically
 * instead of relying on `Date.now()`; the default clock is `Date.now`.
 *
 * An optional `onDenied(key)` callback is invoked exactly once per denied `allow`, so the
 * composition root can count drops without ever logging, labelling or storing the key.
 *
 * A window starts on the first admitted/rejected call for a key and lasts
 * `windowMs` milliseconds; once `now - windowStart >= windowMs` the counter resets.
 */
interface WindowEntry {
  windowStart: number;
  count: number;
}

export type Clock = () => number;

export class RateLimiter {
  private readonly now: Clock;
  private readonly onDenied: ((key: string) => void) | null;
  private readonly buckets: Map<string, WindowEntry>;

  constructor(now: Clock = () => Date.now(), onDenied?: (key: string) => void) {
    this.now = now;
    this.onDenied = onDenied ?? null;
    this.buckets = new Map<string, WindowEntry>();
  }

  allow(key: string, limit: number, windowMs: number): boolean {
    const now = this.now();

    let entry = this.buckets.get(key);
    if (entry === undefined || now - entry.windowStart >= windowMs) {
      entry = { windowStart: now, count: 0 };
      this.buckets.set(key, entry);
    }

    if (limit <= 0) {
      this.onDenied?.(key);
      return false;
    }

    if (entry.count < limit) {
      entry.count += 1;
      return true;
    }

    // Exactly one notification per denied `allow`; the callback owns the key (the metrics
    // wiring discards it and only counts the drop), so no key ever reaches a log or label.
    this.onDenied?.(key);
    return false;
  }
}

/**
 * Factory for a {@link RateLimiter} bound to the given clock (defaults to
 * `Date.now`). Convenience for callers that prefer a function over `new`.
 */
export function createRateLimiter(
  now: Clock = () => Date.now(),
  onDenied?: (key: string) => void,
): RateLimiter {
  return new RateLimiter(now, onDenied);
}