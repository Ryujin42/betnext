/**
 * Noms des queues BullMQ partagées (T7.1). Centralisés pour qu'un producteur
 * et le worker correspondant tapent forcément le même nom (pas de chaîne
 * magique dispersée).
 */
export const BetNextQueue = {
  /** Résolution d'un événement : producteur betting-service, déclenché par `event.result_set`. */
  BetResolution: 'bet-resolution',
  /** Crédit de dépôt depuis un webhook PSP : producteur wallet-service, idempotent sur `stripe_id`. */
  PaymentWebhook: 'payment-webhook',
  /** Notifications utilisateur (mail/push) : non bloquant, DLQ après épuisement. */
  Notification: 'notification',
} as const;

export type BetNextQueue = (typeof BetNextQueue)[keyof typeof BetNextQueue];

/** Charge utile du job `bet-resolution`. */
export interface BetResolutionJob {
  eSportEventId: number;
}

/**
 * Charge utile du job `payment-webhook` : l'évènement webhook normalisé tel
 * qu'on l'aurait passé directement à `WalletService.applyDepositEvent`.
 * L'idempotence existante du wallet-service (sur `stripe_id`) couvre les rejeux
 * BullMQ (worker qui retry → même `stripe_id`, pas de double-crédit).
 */
export interface PaymentWebhookJob {
  id: string;
  type: 'payment_intent.succeeded' | 'payment_intent.payment_failed';
  paymentIntentId: string;
  amount: number;
  userId: number;
}

/** Charge utile générique des jobs de notification (placeholder Lot 7). */
export interface NotificationJob {
  /** Identifie le gabarit de notification ("bet.placed", "deposit.succeeded"…). */
  template: string;
  userId: number;
  /** Données interpolées par le template (laissé libre côté notification-service). */
  data: Record<string, unknown>;
}
