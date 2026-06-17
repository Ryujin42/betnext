import 'reflect-metadata';
import { BetNextTopic } from '@betnext/shared-events';
import { BetStatus } from '@betnext/shared-types';
import { BetEventsSubscriber } from './bet-events.subscriber';

/**
 * T6.1 — vérifie le câblage du consommateur (les handlers se branchent bien sur
 * `bet.placed` / `bet.won` et appellent les bons services). Le bus reste
 * in-memory mono-processus au Lot 6, mais ce test garantit que le passage au
 * bus Redis du Lot 7 trouvera les abonnements déjà corrects.
 */
describe('BetEventsSubscriber (T6.1)', () => {
  it('abonne debitForBet à `bet.placed` et creditForWin à `bet.won`', () => {
    type Handler<T> = (event: T) => unknown;
    const handlers = new Map<string, Handler<unknown>>();
    const bus = {
      publish: jest.fn(),
      subscribe: jest.fn((topic: string, handler: Handler<unknown>) => {
        handlers.set(topic, handler);
      }),
    };
    const wallet = { debitForBet: jest.fn(), creditForWin: jest.fn() };

    const subscriber = new BetEventsSubscriber(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bus as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      wallet as any,
    );
    subscriber.onModuleInit();

    expect(bus.subscribe).toHaveBeenCalledTimes(2);

    const placed = handlers.get(BetNextTopic.BetPlaced);
    placed?.({
      betId: 42,
      userId: 3,
      outcomeId: 1,
      eSportEventId: 10,
      amount: 25,
      lockedOdds: 2.5,
      occurredAt: '2026-06-17T00:00:00Z',
    });
    expect(wallet.debitForBet).toHaveBeenCalledWith(42, 3, 25);

    const won = handlers.get(BetNextTopic.BetWon);
    won?.({
      betId: 7,
      userId: 3,
      status: BetStatus.WON,
      amount: 25,
      payout: 62.5,
      occurredAt: '2026-06-17T00:00:00Z',
    });
    expect(wallet.creditForWin).toHaveBeenCalledWith(7, 3, 62.5);
  });
});
