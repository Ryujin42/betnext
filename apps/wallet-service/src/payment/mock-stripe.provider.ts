import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { BetNextErrorCode } from '@betnext/shared-types';
import { BetNextException } from '../common/betnext.exception';
import { IPaymentProvider, PaymentIntent, PaymentWebhookEvent } from './payment.interface';

/**
 * PSP mocké (T6.2) : simule la création d'un PaymentIntent et un webhook
 * `payment_intent.succeeded` sans le moindre appel réseau. Les intentions
 * créées sont gardées en mémoire pour pouvoir reconstruire l'événement de
 * confirmation.
 */
@Injectable()
export class MockStripeProvider implements IPaymentProvider {
  private readonly intents = new Map<string, PaymentIntent>();

  async createPaymentIntent(params: { amount: number; userId: number }): Promise<PaymentIntent> {
    const id = `pi_mock_${randomUUID()}`;
    const intent: PaymentIntent = {
      id,
      amount: params.amount,
      currency: 'eur',
      status: 'requires_confirmation',
      clientSecret: `${id}_secret`,
      userId: params.userId,
    };
    this.intents.set(id, intent);
    return intent;
  }

  async confirmPayment(paymentIntentId: string): Promise<PaymentWebhookEvent> {
    const intent = this.intents.get(paymentIntentId);
    if (!intent) {
      throw new BetNextException(
        BetNextErrorCode.PAYMENT_FAILED,
        HttpStatus.BAD_REQUEST,
        `PaymentIntent ${paymentIntentId} inconnu.`,
      );
    }
    intent.status = 'succeeded';
    return {
      id: `evt_mock_${randomUUID()}`,
      type: 'payment_intent.succeeded',
      paymentIntentId: intent.id,
      amount: intent.amount,
      userId: intent.userId,
    };
  }

  /**
   * En mock, le payload webhook EST déjà un {@link PaymentWebhookEvent}. On
   * valide juste sa forme (le vrai provider vérifierait la signature Stripe).
   */
  parseWebhook(payload: unknown, _signature?: string): PaymentWebhookEvent {
    if (!this.isWebhookEvent(payload)) {
      throw new BetNextException(
        BetNextErrorCode.PAYMENT_FAILED,
        HttpStatus.BAD_REQUEST,
        'Payload webhook invalide.',
      );
    }
    return payload;
  }

  private isWebhookEvent(payload: unknown): payload is PaymentWebhookEvent {
    if (typeof payload !== 'object' || payload === null) {
      return false;
    }
    const p = payload as Record<string, unknown>;
    return (
      typeof p.id === 'string' &&
      (p.type === 'payment_intent.succeeded' || p.type === 'payment_intent.payment_failed') &&
      typeof p.paymentIntentId === 'string' &&
      typeof p.amount === 'number' &&
      typeof p.userId === 'number'
    );
  }
}
