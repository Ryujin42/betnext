import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IPaymentProvider, PaymentIntent, PaymentWebhookEvent } from './payment.interface';

/**
 * Squelette du PSP réel (Stripe). Présent pour montrer que l'architecture est
 * prête à le recevoir : clés lues depuis l'environnement, même interface que le
 * mock. L'implémentation effective (SDK `stripe`, signatures webhook) viendra au
 * déploiement réel — hors périmètre scolaire. Sélectionné via
 * `PAYMENT_PROVIDER=real` (sinon le mock est utilisé par défaut).
 */
@Injectable()
export class RealStripeProvider implements IPaymentProvider {
  private readonly secretKey: string;
  private readonly webhookSecret: string;

  constructor(config: ConfigService) {
    this.secretKey = config.get<string>('STRIPE_SECRET_KEY') ?? '';
    this.webhookSecret = config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
  }

  private notImplemented(): never {
    throw new Error(
      'RealStripeProvider non implémenté (contexte scolaire). Brancher le SDK Stripe au déploiement réel.',
    );
  }

  createPaymentIntent(_params: { amount: number; userId: number }): Promise<PaymentIntent> {
    void this.secretKey;
    return this.notImplemented();
  }

  confirmPayment(_paymentIntentId: string): Promise<PaymentWebhookEvent> {
    return this.notImplemented();
  }

  parseWebhook(_payload: unknown, _signature?: string): PaymentWebhookEvent {
    void this.webhookSecret;
    return this.notImplemented();
  }
}
