import 'reflect-metadata';
import { BetEntity, BetHistoryEntity } from '@betnext/database';
import { BetStatus, TransactionType } from '@betnext/shared-types';
import { BetCancellationService } from './bet-cancellation.service';

function setup() {
  const outcomes = { find: jest.fn() };
  const bets = { find: jest.fn() };
  const savedBets: Array<Record<string, unknown>> = [];
  const betRepo = {
    save: jest.fn().mockImplementation(async (b: Record<string, unknown>) => {
      savedBets.push({ ...b });
      return b;
    }),
  };
  const histories: Array<Record<string, unknown>> = [];
  const histRepo = {
    create: jest.fn().mockImplementation((h: Record<string, unknown>) => h),
    save: jest.fn().mockImplementation(async (h: Record<string, unknown>) => {
      histories.push({ ...h });
      return h;
    }),
  };
  const manager = {
    getRepository: jest.fn((entity: unknown) =>
      entity === BetEntity ? betRepo : entity === BetHistoryEntity ? histRepo : null,
    ),
  };
  const dataSource = {
    transaction: jest.fn(async (cb: (m: typeof manager) => unknown) => cb(manager)),
  };
  const wallet = { getBalance: jest.fn(), debit: jest.fn(), credit: jest.fn() };

  const service = new BetCancellationService(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bets as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    outcomes as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dataSource as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wallet as any,
  );
  return { service, outcomes, bets, wallet, savedBets, histories };
}

describe('BetCancellationService.cancelForEvent', () => {
  it('rembourse chaque pari PENDING, passe en CANCELLED et trace l’historique', async () => {
    const { service, outcomes, bets, wallet, savedBets, histories } = setup();
    outcomes.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    bets.find.mockResolvedValue([
      { id: 10, outcomeId: 1, userId: 5, amount: '20.00', status: BetStatus.PENDING },
      { id: 11, outcomeId: 2, userId: 6, amount: '15.00', status: BetStatus.PENDING },
    ]);

    const summary = await service.cancelForEvent(42);

    expect(summary).toEqual({ eSportEventId: 42, refunded: 2 });
    expect(wallet.credit).toHaveBeenCalledTimes(2);
    expect(wallet.credit).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      5,
      20,
      TransactionType.REFUND,
      expect.stringContaining('#10'),
    );
    expect(wallet.credit).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      6,
      15,
      TransactionType.REFUND,
      expect.stringContaining('#11'),
    );
    expect(savedBets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 10, status: BetStatus.CANCELLED }),
        expect.objectContaining({ id: 11, status: BetStatus.CANCELLED }),
      ]),
    );
    expect(histories).toHaveLength(2);
    expect(histories[0]).toEqual(
      expect.objectContaining({
        oldStatus: BetStatus.PENDING,
        newStatus: BetStatus.CANCELLED,
        betId: 10,
      }),
    );
  });

  it('ne fait rien si aucun pari PENDING (idempotent au rejeu)', async () => {
    const { service, outcomes, bets, wallet } = setup();
    outcomes.find.mockResolvedValue([{ id: 1 }]);
    bets.find.mockResolvedValue([]);

    const summary = await service.cancelForEvent(42);

    expect(summary).toEqual({ eSportEventId: 42, refunded: 0 });
    expect(wallet.credit).not.toHaveBeenCalled();
  });

  it('ne fait rien si l’événement n’a aucune issue', async () => {
    const { service, outcomes, bets, wallet } = setup();
    outcomes.find.mockResolvedValue([]);
    const summary = await service.cancelForEvent(99);
    expect(summary).toEqual({ eSportEventId: 99, refunded: 0 });
    expect(bets.find).not.toHaveBeenCalled();
    expect(wallet.credit).not.toHaveBeenCalled();
  });
});
