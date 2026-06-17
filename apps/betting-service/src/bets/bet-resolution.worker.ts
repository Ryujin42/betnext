import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  BetNextQueue,
  BetResolutionJob,
  BULLMQ_FACTORY,
  IBullMqFactory,
} from '@betnext/shared-events';
import { BetResolutionService } from './bet-resolution.service';

/**
 * Worker BullMQ qui exécute la résolution des paris (T7.1). Délègue à
 * {@link BetResolutionService} ; un échec (DB, wallet, etc.) propage
 * l'exception au worker BullMQ → retry exponentiel selon la policy par défaut
 * (5 tentatives, backoff 1s). DoD T7.1.
 */
@Injectable()
export class BetResolutionWorker implements OnModuleInit {
  private readonly logger = new Logger(BetResolutionWorker.name);

  constructor(
    @Inject(BULLMQ_FACTORY) private readonly bullmq: IBullMqFactory,
    private readonly resolution: BetResolutionService,
  ) {}

  onModuleInit(): void {
    this.bullmq.createWorker<BetResolutionJob>(BetNextQueue.BetResolution, async (data) => {
      await this.resolution.resolveForEvent(data.eSportEventId);
    });
    this.logger.log(`Worker BullMQ ${BetNextQueue.BetResolution} démarré.`);
  }
}
