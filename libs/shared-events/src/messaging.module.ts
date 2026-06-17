import { Global, Module } from '@nestjs/common';
import { DISTRIBUTED_LOCK } from './distributed-lock.interface';
import { EVENT_BUS } from './event-bus.interface';
import { InMemoryEventBus } from './in-memory-event-bus';
import { InMemoryLock } from './in-memory-lock';

/**
 * Module de messagerie partagé. Fournit les implémentations in-memory du Lot 5
 * (bus + verrou) sous les tokens {@link EVENT_BUS} / {@link DISTRIBUTED_LOCK}.
 * `@Global` : un seul bus par processus, partagé entre producteurs et
 * consommateurs (la livraison in-memory n'a lieu qu'au sein d'un même process).
 *
 * À Lot 7, basculer ces providers vers Redis Pub/Sub + BullMQ sans changer un
 * seul consommateur.
 */
@Global()
@Module({
  providers: [
    { provide: EVENT_BUS, useClass: InMemoryEventBus },
    { provide: DISTRIBUTED_LOCK, useClass: InMemoryLock },
  ],
  exports: [EVENT_BUS, DISTRIBUTED_LOCK],
})
export class MessagingModule {}
