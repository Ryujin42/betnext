import type { BetStatus } from '@betnext/shared-types';

/**
 * Charges utiles typées des événements du bus. Les montants sont en euros
 * (nombres à 2 décimales) ; `occurredAt` est un ISO datetime.
 */

/** `bet.placed` — un pari vient d'être enregistré en PENDING. */
export interface BetPlacedEvent {
  betId: number;
  userId: number;
  outcomeId: number;
  eSportEventId: number;
  amount: number;
  lockedOdds: number;
  occurredAt: string;
}

/** `odds.updated` — nouvelles cotes calculées pour un événement. */
export interface OddsUpdatedEvent {
  eSportEventId: number;
  odds: Array<{ outcomeId: number; odds: number }>;
  occurredAt: string;
}

/** `event.result_set` — un résultat d'événement a été saisi (déclenche la résolution des paris). */
export interface EventResultSetEvent {
  eSportEventId: number;
  occurredAt: string;
}

/** `bet.won` / `bet.lost` — un pari a été résolu. */
export interface BetResolvedEvent {
  betId: number;
  userId: number;
  status: BetStatus.WON | BetStatus.LOST;
  amount: number;
  /** Gain crédité (`amount × lockedOdds` si gagné, `0` si perdu). */
  payout: number;
  occurredAt: string;
}
