import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  BetCancellationJob,
  BetNextQueue,
  BULLMQ_FACTORY,
  IBullMqFactory,
} from '@betnext/shared-events';
import { BetCancellationService } from './bet-cancellation.service';

/**
 * Worker BullMQ qui exécute l'annulation et le remboursement des paris
 * d'un événement annulé. Délègue à {@link BetCancellationService} ; un échec
 * (DB, wallet, etc.) propage l'exception → retry exponentiel BullMQ.
 */
@Injectable()
export class BetCancellationWorker implements OnModuleInit {
  private readonly logger = new Logger(BetCancellationWorker.name);

  constructor(
    @Inject(BULLMQ_FACTORY) private readonly bullmq: IBullMqFactory,
    private readonly cancellation: BetCancellationService,
  ) {}

  onModuleInit(): void {
    this.bullmq.createWorker<BetCancellationJob>(BetNextQueue.BetCancellation, async (data) => {
      await this.cancellation.cancelForEvent(data.eSportEventId);
    });
    this.logger.log(`Worker BullMQ ${BetNextQueue.BetCancellation} démarré.`);
  }
}
