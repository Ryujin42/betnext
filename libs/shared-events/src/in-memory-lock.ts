import { Injectable } from '@nestjs/common';
import type { IDistributedLock } from './distributed-lock.interface';

/**
 * Verrou mono-processus (Map en mémoire) — implémentation par défaut du Lot 5
 * et des tests. Le contrôle « est-ce verrouillé ? » et la pose du verrou se
 * font de façon synchrone (mono-thread JS) : deux `withLock` concurrents sur
 * la même clé ne peuvent pas l'acquérir simultanément.
 *
 * À Lot 7, remplacé par {@link RedisDistributedLock} pour un verrou réellement
 * inter-processus.
 */
@Injectable()
export class InMemoryLock implements IDistributedLock {
  /** key -> timestamp epoch (ms) d'expiration. */
  private readonly held = new Map<string, number>();

  async withLock<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T | null> {
    const now = Date.now();
    const expiry = this.held.get(key);
    if (expiry !== undefined && expiry > now) {
      return null; // déjà verrouillé : on ignore le travail concurrent
    }
    this.held.set(key, now + ttlSeconds * 1000);
    try {
      return await fn();
    } finally {
      this.held.delete(key);
    }
  }
}
