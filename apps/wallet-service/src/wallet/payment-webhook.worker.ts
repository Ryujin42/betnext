import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import {
  BetNextQueue,
  BULLMQ_FACTORY,
  IBullMqFactory,
  PaymentWebhookJob,
} from '@betnext/shared-events';
import { BetNextMetrics } from '@betnext/observability';
import { WalletService } from './wallet.service';

/**
 * Worker BullMQ qui consomme la queue `payment-webhook` (T7.1). Délègue à
 * `WalletService.applyDepositEvent`, déjà idempotent sur `paymentIntentId`
 * (Lot 6). Un échec (DB down, conflit) propage l'erreur → retry exponentiel.
 */
@Injectable()
export class PaymentWebhookWorker implements OnModuleInit {
  private readonly logger = new Logger(PaymentWebhookWorker.name);

  constructor(
    @Inject(BULLMQ_FACTORY) private readonly bullmq: IBullMqFactory,
    private readonly wallet: WalletService,
    @Optional() private readonly metrics?: BetNextMetrics,
  ) {}

  onModuleInit(): void {
    this.bullmq.createWorker<PaymentWebhookJob>(BetNextQueue.PaymentWebhook, async (data) => {
      try {
        await this.wallet.applyDepositEvent({
          id: data.id,
          type: data.type,
          paymentIntentId: data.paymentIntentId,
          amount: data.amount,
          userId: data.userId,
        });
      } catch (err) {
        // T11.2 — compteur d'échecs webhook paiement (mock). On relance pour
        // préserver le retry exponentiel BullMQ (T7.3).
        this.metrics?.recordStripeWebhookError();
        throw err;
      }
    });
    this.logger.log(`Worker BullMQ ${BetNextQueue.PaymentWebhook} démarré.`);
  }
}
