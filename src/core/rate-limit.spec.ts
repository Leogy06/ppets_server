import { InMemoryRateLimitStore } from './rate-limit';
describe('fixed window rate store', () => {
  it('allows the configured count and denies without extending the window', () => {
    const store = new InMemoryRateLimitStore();
    expect(store.consume('ip:auth', 2, 1500, 0)).toEqual({
      allowed: true,
      retryAfter: 0,
      remaining: 1,
    });
    expect(store.consume('ip:auth', 2, 1500, 100)).toEqual({
      allowed: true,
      retryAfter: 0,
      remaining: 0,
    });
    expect(store.consume('ip:auth', 2, 1500, 200)).toEqual({
      allowed: false,
      retryAfter: 2,
      remaining: 0,
    });
    expect(store.consume('ip:auth', 2, 1500, 1400).retryAfter).toBe(1);
    expect(store.consume('ip:auth', 2, 1500, 1500).allowed).toBe(true);
  });
  it('bounds live keys without evicting an active limit and cleans expired entries', () => {
    const store = new InMemoryRateLimitStore(2);
    store.consume('a', 1, 1000, 0);
    store.consume('b', 1, 1000, 0);
    expect(store.consume('c', 1, 1000, 1).allowed).toBe(false);
    expect(store.consume('a', 1, 1000, 2).allowed).toBe(false);
    expect(store.consume('c', 1, 1000, 1000).allowed).toBe(true);
  });
});
