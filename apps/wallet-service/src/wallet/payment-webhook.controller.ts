import { Body, Controller, Headers, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import {
  BetNextQueue,
  BULLMQ_FACTORY,
  IBullMqFactory,
  PaymentWebhookJob,
} from '@betnext/shared-events';
import { IPaymentProvider, PAYMENT_PROVIDER } from '../payment/payment.interface';

/**
 * Endpoint webhook du PSP (T6.2 / T7.1). **Public** : un webhook provient du
 * prestataire de paiement, pas d'un utilisateur authentifié. Le contrôleur
 * valide la forme de l'évènement et enqueue un job BullMQ — on répond
 * immédiatement `received: true` au PSP (les webhooks Stripe doivent répondre
 * en <10s), le crédit effectif est asynchrone, avec retry exponentiel si le
 * wallet-service / la base sont indisponibles (DoD T7.3 : « paiement down →
 * mise en queue avec retry »). L'idempotence existante côté
 * {@link WalletService} (sur `stripe_id`) couvre les rejeux du worker.
 */
@Controller('wallet/webhook')
export class PaymentWebhookController {
  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly payment: IPaymentProvider,
    @Inject(BULLMQ_FACTORY) private readonly bullmq: IBullMqFactory,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handle(
    @Body() body: unknown,
    @Headers('stripe-signature') signature?: string,
  ): Promise<{ received: true; queued: true }> {
    const event = this.payment.parseWebhook(body, signature);
    const queue = this.bullmq.getQueue(BetNextQueue.PaymentWebhook);
    const job: PaymentWebhookJob = {
      id: event.id,
      type: event.type,
      paymentIntentId: event.paymentIntentId,
      amount: event.amount,
      userId: event.userId,
    };
    await queue.add('apply', job, {
      // `jobId = event.id` : un rejeu du PSP avec le même Event ne crée pas
      // deux jobs concurrents. Si le job est de toute façon traité deux fois
      // (BullMQ retry post-completion), l'idempotence du WalletService
      // (sur `paymentIntentId`) empêche le double-crédit.
      jobId: event.id,
    });
    return { received: true, queued: true };
  }
}
