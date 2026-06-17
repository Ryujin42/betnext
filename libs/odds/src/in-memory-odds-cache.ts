import { Injectable } from '@nestjs/common';
import { CachedOdds, IOddsCache } from './odds-cache.interface';

/**
 * Cache mémoire — utilisé par défaut quand `REDIS_URL` n'est pas configuré
 * (tests, school local). Suffit pour servir la dernière valeur connue dans
 * un même process.
 */
@Injectable()
export class InMemoryOddsCache implements IOddsCache {
  private readonly store = new Map<number, CachedOdds>();

  async get(eSportEventId: number): Promise<CachedOdds | null> {
    return this.store.get(eSportEventId) ?? null;
  }

  async set(value: CachedOdds): Promise<void> {
    this.store.set(value.eSportEventId, value);
  }
}
