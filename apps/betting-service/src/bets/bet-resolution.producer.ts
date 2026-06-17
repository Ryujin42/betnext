import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  BetNextQueue,
  BetNextTopic,
  BetResolutionJob,
  BULLMQ_FACTORY,
  EVENT_BUS,
  EventResultSetEvent,
  IBullMqFactory,
  IEventBus,
} from '@betnext/shared-events';

/**
 * Producteur du job `bet-resolution` (T7.1). À l'init, s'abonne au topic
 * `event.result_set` du bus inter-services ; pour chaque évènement reçu,
 * enqueue un job BullMQ pour que la résolution effective bénéficie du retry
 * exponentiel (DoD T7.1).
 *
 * `jobId = event-<id>` : si l'event est rejoué (réémission du bus, panne
 * réseau côté event-service), BullMQ déduplique côté file et n'enfile pas
 * deux résolutions concurrentes du même évènement.
 */
@Injectable()
export class BetResolutionProducer implements OnModuleInit {
  private readonly logger = new Logger(BetResolutionProducer.name);

  constructor(
    @Inject(EVENT_BUS) private readonly bus: IEventBus,
    @Inject(BULLMQ_FACTORY) private readonly bullmq: IBullMqFactory,
  ) {}

  onModuleInit(): void {
    this.bus.subscribe<EventResultSetEvent>(BetNextTopic.EventResultSet, async (event) => {
      const queue = this.bullmq.getQueue(BetNextQueue.BetResolution);
      await queue.add(
        'resolve',
        { eSportEventId: event.eSportEventId } satisfies BetResolutionJob,
        { jobId: `event-${event.eSportEventId}` },
      );
      this.logger.log(`Job bet-resolution enqueué pour event #${event.eSportEventId}`);
    });
  }
}
