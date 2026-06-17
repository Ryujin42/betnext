import 'reflect-metadata';
import { BetNextTopic } from '@betnext/shared-events';
import { BetStatus } from '@betnext/shared-types';
import { RealtimeGateway } from './realtime.gateway';

function makeBus() {
  type Handler<T> = (event: T) => unknown;
  const handlers = new Map<string, Handler<unknown>>();
  return {
    publish: jest.fn(),
    subscribe: jest.fn((topic: string, handler: Handler<unknown>) => {
      handlers.set(topic, handler);
    }),
    handlers,
  };
}

function makeServer() {
  const emitted: Array<{ room: string; event: string; payload: unknown }> = [];
  const to = jest.fn((room: string) => ({
    emit: (event: string, payload: unknown) => {
      emitted.push({ room, event, payload });
    },
  }));
  return { server: { to }, emitted };
}

describe('RealtimeGateway (T9.3)', () => {
  it('bridge bus → WS : `odds.updated` → broadcast room `event:<id>`', () => {
    const bus = makeBus();
    const { server, emitted } = makeServer();
    const gateway = new RealtimeGateway(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bus as any,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gateway.server = server as any;
    gateway.onModuleInit();

    const handler = bus.handlers.get(BetNextTopic.OddsUpdated);
    handler?.({
      eSportEventId: 42,
      odds: [{ outcomeId: 1, odds: 1.85 }],
      occurredAt: '2026-06-17T00:00:00Z',
    });

    expect(server.to).toHaveBeenCalledWith('event:42');
    expect(emitted[0].event).toBe('odds.updated');
  });

  it('bridge bus → WS : `bet.won` → broadcast room `user:<id>`', () => {
    const bus = makeBus();
    const { server, emitted } = makeServer();
    const gateway = new RealtimeGateway(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bus as any,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gateway.server = server as any;
    gateway.onModuleInit();

    const handler = bus.handlers.get(BetNextTopic.BetWon);
    handler?.({
      betId: 7,
      userId: 3,
      status: BetStatus.WON,
      amount: 10,
      payout: 25,
      occurredAt: '2026-06-17T00:00:00Z',
    });

    expect(server.to).toHaveBeenCalledWith('user:3');
    expect(emitted[0].event).toBe('bet.won');
  });

  it('subscribeEvent rejoint `event:<id>` ; payload invalide → no-op', async () => {
    const bus = makeBus();
    const { server } = makeServer();
    const gateway = new RealtimeGateway(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bus as any,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gateway.server = server as any;

    const join = jest.fn().mockResolvedValue(undefined);
    const leave = jest.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = { join, leave } as any;

    await gateway.subscribeEvent(client, { eSportEventId: 42 });
    expect(join).toHaveBeenCalledWith('event:42');

    await gateway.subscribeEvent(client, { eSportEventId: 'wrong' as unknown as number });
    expect(join).toHaveBeenCalledTimes(1); // pas de 2e appel

    await gateway.unsubscribeEvent(client, { eSportEventId: 42 });
    expect(leave).toHaveBeenCalledWith('event:42');
  });
});
