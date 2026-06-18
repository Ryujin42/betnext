import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  BetCancellationJob,
  BetNextQueue,
  BetNextTopic,
  BULLMQ_FACTORY,
  EVENT_BUS,
  EventCancelledEvent,
  IBullMqFactory,
  IEventBus,
} from '@betnext/shared-events';

/**
 * Producteur du job `bet-cancellation`. S'abonne au topic bus
 * `event.cancelled` ; pour chaque évènement reçu, enqueue un job BullMQ pour
 * que l'annulation/remboursement bénéficie du retry exponentiel (T7.1).
 *
 * `jobId = event-cancel-<id>` : si l'event est rejoué (réémission du bus, panne
 * réseau côté event-service), BullMQ déduplique et n'enfile pas deux
 * remboursements concurrents. Le service côté worker est lui-même idempotent
 * (ne traite que les paris encore PENDING).
 */
@Injectable()
export class BetCancellationProducer implements OnModuleInit {
  private readonly logger = new Logger(BetCancellationProducer.name);

  constructor(
    @Inject(EVENT_BUS) private readonly bus: IEventBus,
    @Inject(BULLMQ_FACTORY) private readonly bullmq: IBullMqFactory,
  ) {}

  onModuleInit(): void {
    this.bus.subscribe<EventCancelledEvent>(BetNextTopic.EventCancelled, async (event) => {
      const queue = this.bullmq.getQueue(BetNextQueue.BetCancellation);
      await queue.add(
        'cancel',
        { eSportEventId: event.eSportEventId } satisfies BetCancellationJob,
        { jobId: `event-cancel-${event.eSportEventId}` },
      );
      this.logger.log(`Job bet-cancellation enqueué pour event #${event.eSportEventId}`);
    });
  }
}
