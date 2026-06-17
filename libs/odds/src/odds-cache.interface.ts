/** Token d'injection du cache des cotes (T7.3). */
export const ODDS_CACHE = Symbol('ODDS_CACHE');

/** Vue cachée d'un calcul de cotes — équivalent du payload `odds.updated`. */
export interface CachedOdds {
  eSportEventId: number;
  odds: Array<{ outcomeId: number; odds: number }>;
  computedAt: string;
}

/**
 * Cache de fallback des dernières cotes connues (T7.3). Utilisé quand le
 * recalcul échoue (DB down, etc.) ou pour servir une lecture rapide sans
 * recompute. Implémenté en mémoire en test, en Redis en runtime via
 * {@link RedisOddsCache}.
 */
export interface IOddsCache {
  get(eSportEventId: number): Promise<CachedOdds | null>;
  set(value: CachedOdds): Promise<void>;
}
