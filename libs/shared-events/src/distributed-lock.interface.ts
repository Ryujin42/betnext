/**
 * Verrou distribué pour sérialiser un traitement critique (ex. recalcul de
 * cotes, T5.2). Sémantique « SET NX » : si le verrou est déjà détenu, le
 * travail concurrent est **ignoré** (renvoie `null`) plutôt que mis en file
 * d'attente — adapté à un recalcul idempotent qui relit l'état courant.
 */
export interface IDistributedLock {
  withLock<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T | null>;
}

/** Token d'injection NestJS du verrou. */
export const DISTRIBUTED_LOCK = Symbol('DISTRIBUTED_LOCK');
