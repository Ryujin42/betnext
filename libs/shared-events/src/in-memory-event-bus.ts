import { Injectable, Logger } from '@nestjs/common';
import type { EventHandler, IEventBus } from './event-bus.interface';

/**
 * Bus d'événements en mémoire (mono-processus) — implémentation par défaut du
 * Lot 5. Les handlers d'un topic sont invoqués séquentiellement ; une erreur
 * dans un handler est journalisée mais n'interrompt ni la publication ni les
 * autres handlers (résilience — un consommateur non critique ne doit pas
 * casser le flux, cf. T7.3).
 *
 * À Lot 7, remplacé par Redis Pub/Sub + BullMQ derrière la même interface
 * {@link IEventBus} : les appelants ne changent pas.
 */
@Injectable()
export class InMemoryEventBus implements IEventBus {
  private readonly logger = new Logger(InMemoryEventBus.name);
  private readonly handlers = new Map<string, Array<EventHandler<unknown>>>();

  async publish<T>(topic: string, payload: T): Promise<void> {
    const subs = this.handlers.get(topic) ?? [];
    for (const handler of subs) {
      try {
        await handler(payload);
      } catch (err) {
        this.logger.error(`Handler en échec pour le topic "${topic}"`, err as Error);
      }
    }
  }

  subscribe<T>(topic: string, handler: EventHandler<T>): void {
    const subs = this.handlers.get(topic) ?? [];
    subs.push(handler as EventHandler<unknown>);
    this.handlers.set(topic, subs);
  }
}
