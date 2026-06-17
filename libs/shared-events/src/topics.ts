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
  /** Émis par wallet-service après un dépôt crédité (T6.3). */
  PaymentDeposited: 'payment.deposited',
  /** Émis par wallet-service après un retrait débité (T6.3). */
  PaymentWithdrawn: 'payment.withdrawn',
  /** Émis par user-service après modification des limites RG (T7.2). */
  RgLimitUpdated: 'rg.limit_updated',
  /** Émis par user-service quand un utilisateur s'auto-exclut (T7.2). */
  RgSelfExcluded: 'rg.self_excluded',
  /** Émis par user-service quand un admin suspend / réactive un compte (T8.3). */
  UserSuspended: 'user.suspended',
  UserUnsuspended: 'user.unsuspended',
} as const;

export type BetNextTopic = (typeof BetNextTopic)[keyof typeof BetNextTopic];
