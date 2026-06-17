/**
 * Topics du bus d'événements inter-services (cf. BETNEXT_CONTEXT — event bus).
 * Centralisés ici pour que producteurs et consommateurs partagent les mêmes
 * noms (pas de chaîne magique dispersée).
 */
export const BetNextTopic = {
  /** Émis par betting-service après un placement de pari (T5.1). */
  BetPlaced: 'bet.placed',
  /** Émis par odds-engine après recalcul des cotes (T5.2). */
  OddsUpdated: 'odds.updated',
  /** Émis par event-service quand un résultat est saisi (T4.4 → consommé T5.3). */
  EventResultSet: 'event.result_set',
  /** Émis par betting-service à la résolution d'un pari gagnant (T5.3). */
  BetWon: 'bet.won',
  /** Émis par betting-service à la résolution d'un pari perdant (T5.3). */
  BetLost: 'bet.lost',
} as const;

export type BetNextTopic = (typeof BetNextTopic)[keyof typeof BetNextTopic];
