/**
 * Abstraction du prestataire de paiement (PSP). Mockée en contexte scolaire
 * ({@link MockStripeProvider}) ; un `RealStripeProvider` se branche au déploiement
 * réel sans toucher au reste (clés dans les variables d'environnement).
 */

export type PaymentIntentStatus = 'requires_confirmation' | 'succeeded' | 'failed';

/** Intention de paiement (calque minimal d'un Stripe PaymentIntent). */
export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: PaymentIntentStatus;
  clientSecret: string;
  userId: number;
}

export type PaymentEventType = 'payment_intent.succeeded' | 'payment_intent.payment_failed';

/** Événement webhook normalisé (calque d'un Stripe Event). */
export interface PaymentWebhookEvent {
  id: string;
  type: PaymentEventType;
  paymentIntentId: string;
  amount: number;
  userId: number;
}

export interface IPaymentProvider {
  /** Crée une intention de paiement (aucun appel réseau en mock). */
  createPaymentIntent(params: { amount: number; userId: number }): Promise<PaymentIntent>;
  /** Confirme un paiement et renvoie l'événement webhook correspondant (mock : succeeded). */
  confirmPayment(paymentIntentId: string): Promise<PaymentWebhookEvent>;
  /** Vérifie (signature) et parse un payload webhook brut en événement normalisé. */
  parseWebhook(payload: unknown, signature?: string): PaymentWebhookEvent;
}

/** Token d'injection NestJS du PSP. */
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
