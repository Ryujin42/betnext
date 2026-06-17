import 'reflect-metadata';
import { InMemoryOddsCache } from './in-memory-odds-cache';
import { RedisOddsCache, type RedisOddsCacheClient } from './redis-odds-cache';
import type { CachedOdds } from './odds-cache.interface';

describe('InMemoryOddsCache (T7.3)', () => {
  it('renvoie null pour un event jamais coté', async () => {
    const cache = new InMemoryOddsCache();
    expect(await cache.get(42)).toBeNull();
  });

  it('renvoie le dernier snapshot écrit pour un event', async () => {
    const cache = new InMemoryOddsCache();
    const snapshot: CachedOdds = {
      eSportEventId: 42,
      odds: [{ outcomeId: 1, odds: 1.85 }],
      computedAt: '2026-06-17T08:00:00.000Z',
    };
    await cache.set(snapshot);
    expect(await cache.get(42)).toEqual(snapshot);
  });
});

describe('RedisOddsCache (T7.3)', () => {
  function fakeClient(): RedisOddsCacheClient & {
    storage: Map<string, string>;
    getCalls: number;
    setCalls: Array<{ key: string; value: string; args: Array<string | number> }>;
  } {
    const storage = new Map<string, string>();
    const setCalls: Array<{ key: string; value: string; args: Array<string | number> }> = [];
    let getCalls = 0;
    return {
      storage,
      setCalls,
      get getCalls() {
        return getCalls;
      },
      async get(key) {
        getCalls += 1;
        return storage.get(key) ?? null;
      },
      async set(key, value, ...args) {
        setCalls.push({ key, value, args });
        storage.set(key, value);
        return 'OK';
      },
    };
  }

  it('écrit la clé `odds:event:<id>` avec un TTL', async () => {
    const client = fakeClient();
    const cache = new RedisOddsCache(client);
    await cache.set({
      eSportEventId: 7,
      odds: [{ outcomeId: 1, odds: 2.1 }],
      computedAt: '2026-06-17T08:00:00.000Z',
    });
    expect(client.setCalls[0].key).toBe('odds:event:7');
    expect(client.setCalls[0].args[0]).toBe('EX');
    expect(typeof client.setCalls[0].args[1]).toBe('number');
  });

  it('lit et désérialise le snapshot', async () => {
    const client = fakeClient();
    client.storage.set(
      'odds:event:7',
      JSON.stringify({ eSportEventId: 7, odds: [], computedAt: 'x' }),
    );
    const cache = new RedisOddsCache(client);
    expect(await cache.get(7)).toEqual({ eSportEventId: 7, odds: [], computedAt: 'x' });
  });

  it('renvoie null et logue si la lecture Redis throw (ne propage jamais l’erreur)', async () => {
    const client = {
      get: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      set: jest.fn().mockResolvedValue('OK'),
    } as unknown as RedisOddsCacheClient;
    const cache = new RedisOddsCache(client);
    await expect(cache.get(7)).resolves.toBeNull();
  });
});
