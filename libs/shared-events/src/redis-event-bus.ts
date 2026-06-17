import { Injectable, Logger } from '@nestjs/common';
import type { EventHandler, IEventBus } from './event-bus.interface';

/**
 * Sous-ensemble du client Redis (ioredis) utilisé par le bus pub/sub. Garde la
 * lib indépendante du driver concret au type-level (les tests injectent un
 * fake, le runtime un vrai `Redis`).
 */
export interface RedisPubSubClient {
  publish(channel: string, payload: string): Promise<number>;
  subscribe(...channels: string[]): Promise<unknown>;
  on(event: 'message', listener: (channel: string, payload: string) => void): unknown;
  quit(): Promise<unknown>;
}

/**
 * Bus d'événements Redis Pub/Sub (T7.1). Implémente {@link IEventBus} : les
 * producteurs/consommateurs n'ont rien à changer par rapport au bus in-memory.
 *
 * Deux clients ioredis sont nécessaires car en mode subscriber ioredis bloque
 * tout autre command. Convention : le payload est sérialisé JSON, le topic est
 * le nom du canal Redis (cf. {@link BetNextTopic}).
 *
 * Résilience (cf. T7.3) : une erreur dans un handler est journalisée mais
 * n'empêche ni les autres handlers du même topic, ni la réception suivante.
 */
@Injectable()
export class RedisEventBus implements IEventBus {
  private readonly logger = new Logger(RedisEventBus.name);
  private readonly handlers = new Map<string, Array<EventHandler<unknown>>>();
  private listenerAttached = false;

  constructor(
    private readonly publisher: RedisPubSubClient,
    private readonly subscriber: RedisPubSubClient,
  ) {}

  async publish<T>(topic: string, payload: T): Promise<void> {
    await this.publisher.publish(topic, JSON.stringify(payload));
  }

  subscribe<T>(topic: string, handler: EventHandler<T>): void {
    const subs = this.handlers.get(topic) ?? [];
    subs.push(handler as EventHandler<unknown>);
    this.handlers.set(topic, subs);

    // Abonnement réseau idempotent : on n'attache le listener qu'une fois.
    if (!this.listenerAttached) {
      this.subscriber.on('message', (channel, raw) => {
        void this.dispatch(channel, raw);
      });
      this.listenerAttached = true;
    }
    void this.subscriber.subscribe(topic);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([this.publisher.quit(), this.subscriber.quit()]);
  }

  private async dispatch(channel: string, raw: string): Promise<void> {
    const subs = this.handlers.get(channel) ?? [];
    if (subs.length === 0) {
      return;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch (err) {
      this.logger.error(`Payload non JSON sur le topic "${channel}"`, err as Error);
      return;
    }
    for (const handler of subs) {
      try {
        await handler(payload);
      } catch (err) {
        this.logger.error(`Handler en échec pour le topic "${channel}"`, err as Error);
      }
    }
  }
}
