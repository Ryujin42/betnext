import type { IDistributedLock } from './distributed-lock.interface';

/**
 * Sous-ensemble du client Redis (ioredis / node-redis) requis par le verrou.
 * Injecté au Lot 7 ; la lib ne dépend donc pas en dur d'un driver Redis.
 */
export interface RedisLockClient {
  /** `SET key value NX EX ttl` → `'OK'` si acquis, `null` sinon. */
  set(key: string, value: string, ...args: Array<string | number>): Promise<string | null>;
  eval(script: string, numKeys: number, ...args: Array<string | number>): Promise<unknown>;
}

/** Libère le verrou uniquement si le token correspond (compare-and-delete atomique). */
const RELEASE_SCRIPT =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

/**
 * Verrou distribué Redis : `SET key token NX EX ttl` pour l'acquisition, script
 * Lua compare-and-delete pour la libération (on ne libère jamais le verrou d'un
 * autre détenteur). C'est le « verrou Redis SET NX EX 60 » de T5.2.
 *
 * Implémentation prête pour le Lot 7 ; au Lot 5 c'est {@link InMemoryLock} qui
 * est branché par défaut (Lot 5 autonome, sans dépendance Redis au runtime).
 */
export class RedisDistributedLock implements IDistributedLock {
  constructor(private readonly client: RedisLockClient) {}

  async withLock<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T | null> {
    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const acquired = await this.client.set(key, token, 'NX', 'EX', ttlSeconds);
    if (acquired !== 'OK') {
      return null; // verrou déjà détenu
    }
    try {
      return await fn();
    } finally {
      await this.client.eval(RELEASE_SCRIPT, 1, key, token);
    }
  }
}
