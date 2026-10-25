export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
  remaining: number;
}
export interface RateLimitStore {
  consume(
    key: string,
    limit: number,
    windowMs: number,
    now?: number,
  ): RateLimitResult | Promise<RateLimitResult>;
}
type Window = { count: number; expiresAt: number };
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly windows = new Map<string, Window>();
  private nextCleanup = 0;
  constructor(private readonly maxKeys = 10000) {
    if (!Number.isInteger(maxKeys) || maxKeys < 1)
      throw new Error('maxKeys must be a positive integer.');
  }
  consume(
    key: string,
    limit: number,
    windowMs: number,
    now = Date.now(),
  ): RateLimitResult {
    if (now >= this.nextCleanup || this.windows.size >= this.maxKeys) {
      for (const [entry, window] of this.windows)
        if (window.expiresAt <= now) this.windows.delete(entry);
      this.nextCleanup = now + Math.min(windowMs, 1000);
    }
    let window = this.windows.get(key);
    if (window && window.expiresAt <= now) {
      this.windows.delete(key);
      window = undefined;
    }
    if (!window) {
      if (this.windows.size >= this.maxKeys) {
        let earliest = now + windowMs;
        for (const entry of this.windows.values())
          earliest = Math.min(earliest, entry.expiresAt);
        return {
          allowed: false,
          retryAfter: Math.max(1, Math.ceil((earliest - now) / 1000)),
          remaining: 0,
        };
      }
      window = { count: 0, expiresAt: now + windowMs };
      this.windows.set(key, window);
    }
    if (window.count >= limit)
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil((window.expiresAt - now) / 1000)),
        remaining: 0,
      };
    window.count++;
    return { allowed: true, retryAfter: 0, remaining: limit - window.count };
  }
}
