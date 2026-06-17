import 'reflect-metadata';
import { RedisEventBus, type RedisPubSubClient } from './redis-event-bus';

/**
 * Faux client ioredis : retient les `subscribe()` et expose `emit()` pour
 * simuler une réception réseau. Suffisant pour vérifier le contrat
 * publish/subscribe/dispatch sans dépendre d'un Redis local.
 */
function makeFakeClient(): RedisPubSubClient & {
  emit: (channel: string, raw: string) => void;
  channels: string[];
  published: Array<{ channel: string; payload: string }>;
} {
  let messageHandler: ((channel: string, payload: string) => void) | null = null;
  const channels: string[] = [];
  const published: Array<{ channel: string; payload: string }> = [];
  return {
    channels,
    published,
    async publish(channel: string, payload: string) {
      published.push({ channel, payload });
      return 1;
    },
    async subscribe(...names: string[]) {
      channels.push(...names);
      return 'OK';
    },
    on(event, listener) {
      if (event === 'message') {
        messageHandler = listener;
      }
      return this;
    },
    async quit() {
      return 'OK';
    },
    emit(channel: string, raw: string) {
      messageHandler?.(channel, raw);
    },
  };
}

describe('RedisEventBus (T7.1)', () => {
  it('publish sérialise le payload en JSON sur le canal du topic', async () => {
    const publisher = makeFakeClient();
    const subscriber = makeFakeClient();
    const bus = new RedisEventBus(publisher, subscriber);

    await bus.publish('bet.placed', { betId: 7, amount: 25 });

    expect(publisher.published).toEqual([
      { channel: 'bet.placed', payload: '{"betId":7,"amount":25}' },
    ]);
  });

  it('subscribe abonne le client Redis et dispatche le payload parsé au handler', async () => {
    const publisher = makeFakeClient();
    const subscriber = makeFakeClient();
    const bus = new RedisEventBus(publisher, subscriber);

    const handler = jest.fn();
    bus.subscribe('bet.placed', handler);
    expect(subscriber.channels).toContain('bet.placed');

    subscriber.emit('bet.placed', '{"betId":7,"amount":25}');
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(handler).toHaveBeenCalledWith({ betId: 7, amount: 25 });
  });

  it('plusieurs handlers sur un même topic : un échec ne casse pas les autres', async () => {
    const publisher = makeFakeClient();
    const subscriber = makeFakeClient();
    const bus = new RedisEventBus(publisher, subscriber);
    const okHandler = jest.fn();
    bus.subscribe('bet.placed', () => {
      throw new Error('boom');
    });
    bus.subscribe('bet.placed', okHandler);

    subscriber.emit('bet.placed', '{"betId":1}');
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(okHandler).toHaveBeenCalledWith({ betId: 1 });
  });

  it('payload non-JSON : pas de dispatch, pas de crash', async () => {
    const publisher = makeFakeClient();
    const subscriber = makeFakeClient();
    const bus = new RedisEventBus(publisher, subscriber);
    const handler = jest.fn();
    bus.subscribe('bet.placed', handler);

    subscriber.emit('bet.placed', '<<not-json>>');
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(handler).not.toHaveBeenCalled();
  });

  it("n'attache le listener `message` qu'une fois (subscribe répétés idempotents)", () => {
    const publisher = makeFakeClient();
    const subscriber = makeFakeClient();
    const onSpy = jest.spyOn(subscriber, 'on');
    const bus = new RedisEventBus(publisher, subscriber);

    bus.subscribe('a', jest.fn());
    bus.subscribe('b', jest.fn());
    bus.subscribe('c', jest.fn());

    const messageListeners = onSpy.mock.calls.filter(([event]) => event === 'message');
    expect(messageListeners).toHaveLength(1);
  });
});
