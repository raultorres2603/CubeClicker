import { describe, expect, it } from 'vitest';

import { RateLimiter, createRateLimiter } from './rate-limit.js';

describe('RateLimiter', () => {
  it('admits calls up to the limit within a single window', () => {
    const limiter = new RateLimiter(() => 1000);
    expect(limiter.allow('k', 3, 5000)).toBe(true);
    expect(limiter.allow('k', 3, 5000)).toBe(true);
    expect(limiter.allow('k', 3, 5000)).toBe(true);
  });

  it('rejects the call after the limit is reached within the same window', () => {
    const limiter = new RateLimiter(() => 1000);
    limiter.allow('k', 3, 5000);
    limiter.allow('k', 3, 5000);
    limiter.allow('k', 3, 5000);
    expect(limiter.allow('k', 3, 5000)).toBe(false);
  });

  it('keeps rejecting while the window has not elapsed', () => {
    let now = 1000;
    const limiter = new RateLimiter(() => now);
    limiter.allow('k', 2, 1000);
    limiter.allow('k', 2, 1000);
    now = 1999;
    expect(limiter.allow('k', 2, 1000)).toBe(false);
  });

  it('resets the counter once the window has fully elapsed (boundary: now - start >= windowMs)', () => {
    let now = 0;
    const limiter = new RateLimiter(() => now);
    expect(limiter.allow('k', 2, 1000)).toBe(true);
    expect(limiter.allow('k', 2, 1000)).toBe(true);
    expect(limiter.allow('k', 2, 1000)).toBe(false);
    now = 1000;
    expect(limiter.allow('k', 2, 1000)).toBe(true);
    expect(limiter.allow('k', 2, 1000)).toBe(true);
    expect(limiter.allow('k', 2, 1000)).toBe(false);
  });

  it('does not reset one millisecond before the window elapses', () => {
    let now = 0;
    const limiter = new RateLimiter(() => now);
    limiter.allow('k', 1, 1000);
    now = 999;
    expect(limiter.allow('k', 1, 1000)).toBe(false);
  });

  it('isolates budgets per key', () => {
    const limiter = new RateLimiter(() => 0);
    expect(limiter.allow('a', 1, 1000)).toBe(true);
    expect(limiter.allow('a', 1, 1000)).toBe(false);
    // A separate key still has its full budget.
    expect(limiter.allow('b', 1, 1000)).toBe(true);
    expect(limiter.allow('b', 1, 1000)).toBe(false);
  });

  it('isolates budgets for keys that differ only by namespace', () => {
    const limiter = new RateLimiter(() => 0);
    expect(limiter.allow('ip:1.1.1.1:register', 5, 60000)).toBe(true);
    expect(limiter.allow('ip:1.1.1.1:login', 10, 60000)).toBe(true);
    // Register budget exhausted independently of login budget.
    for (let i = 0; i < 4; i += 1) {
      expect(limiter.allow('ip:1.1.1.1:register', 5, 60000)).toBe(true);
    }
    expect(limiter.allow('ip:1.1.1.1:register', 5, 60000)).toBe(false);
    expect(limiter.allow('ip:1.1.1.1:login', 10, 60000)).toBe(true);
  });

  it('allows a limit of 1 to admit exactly one call per window', () => {
    let now = 0;
    const limiter = new RateLimiter(() => now);
    expect(limiter.allow('k', 1, 1000)).toBe(true);
    expect(limiter.allow('k', 1, 1000)).toBe(false);
    now = 1000;
    expect(limiter.allow('k', 1, 1000)).toBe(true);
  });

  it('rejects every call when limit is 0', () => {
    const limiter = new RateLimiter(() => 0);
    expect(limiter.allow('k', 0, 1000)).toBe(false);
    expect(limiter.allow('k', 0, 1000)).toBe(false);
  });

  it('rejects every call when limit is negative', () => {
    const limiter = new RateLimiter(() => 0);
    expect(limiter.allow('k', -3, 1000)).toBe(false);
  });

  it('uses the injected clock rather than Date.now', () => {
    const clock = (): number => 42;
    const limiter = new RateLimiter(clock);
    expect(limiter.allow('k', 1, 1000)).toBe(true);
    // A second limiter with a different clock is independent.
    const other = new RateLimiter(() => 9999);
    expect(other.allow('k', 1, 1000)).toBe(true);
  });

  it('createRateLimiter factory binds the provided clock', () => {
    let now = 5;
    const limiter = createRateLimiter(() => now);
    expect(limiter.allow('k', 1, 100)).toBe(true);
    expect(limiter.allow('k', 1, 100)).toBe(false);
    now = 105;
    expect(limiter.allow('k', 1, 100)).toBe(true);
  });

  it('works with the default clock (Date.now) without throwing', () => {
    const limiter = new RateLimiter();
    const result = limiter.allow('default-clock', 10, 1000);
    expect(result).toBe(true);
  });

  it('createRateLimiter uses the default clock when none is given', () => {
    const limiter = createRateLimiter();
    const result = limiter.allow('default-clock-factory', 10, 1000);
    expect(result).toBe(true);
  });

  it('treats a zero-length window as a new window per call', () => {
    const limiter = new RateLimiter(() => 0);
    expect(limiter.allow('k', 1, 0)).toBe(true);
    expect(limiter.allow('k', 1, 0)).toBe(true);
  });

  it('does not inflate the counter on a rejected call', () => {
    let now = 0;
    const limiter = new RateLimiter(() => now);
    expect(limiter.allow('k', 1, 1000)).toBe(true);
    expect(limiter.allow('k', 1, 1000)).toBe(false);
    // Window still at count 1; after reset, full budget again (not 2).
    now = 1000;
    expect(limiter.allow('k', 1, 1000)).toBe(true);
    expect(limiter.allow('k', 1, 1000)).toBe(false);
  });
});

describe('RateLimiter onDenied callback', () => {
  it('notifies exactly once per denied allow, with the key, and never for an admitted call', () => {
    const denied: string[] = [];
    let now = 0;
    const limiter = new RateLimiter(
      () => now,
      (key) => denied.push(key),
    );

    expect(limiter.allow('ip:1.2.3.4:login', 2, 1000)).toBe(true);
    expect(limiter.allow('ip:1.2.3.4:login', 2, 1000)).toBe(true);
    expect(denied).toEqual([]);

    expect(limiter.allow('ip:1.2.3.4:login', 2, 1000)).toBe(false);
    expect(limiter.allow('ip:1.2.3.4:login', 2, 1000)).toBe(false);
    expect(denied).toEqual(['ip:1.2.3.4:login', 'ip:1.2.3.4:login']);

    now = 1000;
    expect(limiter.allow('ip:1.2.3.4:login', 2, 1000)).toBe(true);
    expect(denied).toHaveLength(2);

    // A different key keeps its own budget and is only reported when it is denied.
    expect(limiter.allow('ip:5.6.7.8:login', 1, 1000)).toBe(true);
    expect(limiter.allow('ip:5.6.7.8:login', 1, 1000)).toBe(false);
    expect(denied).toEqual(['ip:1.2.3.4:login', 'ip:1.2.3.4:login', 'ip:5.6.7.8:login']);
  });

  it('reports every limit-0 denial once per call', () => {
    const denied: string[] = [];
    const limiter = new RateLimiter(
      () => 0,
      (key) => denied.push(key),
    );

    expect(limiter.allow('scope-key', 0, 1000)).toBe(false);
    expect(limiter.allow('scope-key', 0, 1000)).toBe(false);
    expect(denied).toEqual(['scope-key', 'scope-key']);
  });

  it('binds the callback through createRateLimiter', () => {
    const denied: string[] = [];
    const limiter = createRateLimiter(
      () => 5,
      (key) => denied.push(key),
    );

    expect(limiter.allow('k', 1, 100)).toBe(true);
    expect(limiter.allow('k', 1, 100)).toBe(false);
    expect(denied).toEqual(['k']);
  });
});