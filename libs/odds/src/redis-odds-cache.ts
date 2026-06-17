import { Logger } from '@nestjs/common';
import { CachedOdds, IOddsCache } from './odds-cache.interface';

/**
 * Sous-ensemble du client Redis utilisé. Injecté à l'init pour ne pas dépendre
 * en dur de ioredis au type-level (tests).
 */
export interface RedisOddsCacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: Array<string | number>): Promise<string | null>;
}

/** TTL du cache des cotes (s). 24h suffit largement en école — on écrase régulièrement. */
const TTL_SECONDS = 24 * 60 * 60;

/**
 * Cache Redis des cotes (T7.3) — fallback de lecture si le recalcul échoue.
 * Clé `odds:event:<id>`, valeur JSON. TTL `24h` ; toute écriture renouvelle.
 */
export class RedisOddsCache implements IOddsCache {
  private readonly logger = new Logger(RedisOddsCache.name);

  constructor(private readonly client: RedisOddsCacheClient) {}

  async get(eSportEventId: number): Promise<CachedOdds | null> {
    try {
      const raw = await this.client.get(this.key(eSportEventId));
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as CachedOdds;
    } catch (err) {
      this.logger.warn(
        `Lecture cache cotes event ${eSportEventId} en échec : ${(err as Error).message}`,
      );
      return null;
    }
  }

  async set(value: CachedOdds): Promise<void> {
    try {
      await this.client.set(
        this.key(value.eSportEventId),
        JSON.stringify(value),
        'EX',
        TTL_SECONDS,
      );
    } catch (err) {
      // Une écriture cache qui échoue ne doit jamais casser le flux principal.
      this.logger.warn(
        `Écriture cache cotes event ${value.eSportEventId} en échec : ${(err as Error).message}`,
      );
    }
  }

  private key(eSportEventId: number): string {
    return `odds:event:${eSportEventId}`;
  }
}
