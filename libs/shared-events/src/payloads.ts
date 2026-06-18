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

/** `event.cancelled` — un manager a annulé l'événement (déclenche le remboursement des paris PENDING). */
export interface EventCancelledEvent {
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

/** `payment.deposited` / `payment.withdrawn` — mouvement de portefeuille (T6.3). */
export interface PaymentMovementEvent {
  userId: number;
  amount: number;
  transactionId: number;
  occurredAt: string;
}

/** `rg.limit_updated` — limites RG modifiées (immédiat OU pending 48h). */
export interface RgLimitUpdatedEvent {
  userId: number;
  /** `immediate` pour une baisse / un retrait de limite, `pending` pour une hausse différée 48h. */
  effect: 'immediate' | 'pending';
  /** Date d'effet (= maintenant si `immediate`, +48h si `pending`). */
  effectiveAt: string;
  occurredAt: string;
}

/** `rg.self_excluded` — auto-exclusion activée (bloque la connexion jusqu'à la date). */
export interface RgSelfExcludedEvent {
  userId: number;
  selfExcludedUntil: string;
  occurredAt: string;
}

/** `user.suspended` — un admin a suspendu un compte (T8.3). */
export interface UserSuspendedEvent {
  userId: number;
  adminId: number;
  reason: string | null;
  occurredAt: string;
}

/** `user.unsuspended` — un admin a levé une suspension (T8.3). */
export interface UserUnsuspendedEvent {
  userId: number;
  adminId: number;
  occurredAt: string;
}
