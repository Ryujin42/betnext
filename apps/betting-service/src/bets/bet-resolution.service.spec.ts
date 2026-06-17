import 'reflect-metadata';
import { BetEntity, BetHistoryEntity } from '@betnext/database';
import { BetNextErrorCode, BetStatus, EventStatus, TransactionType } from '@betnext/shared-types';
import { BetResolutionService } from './bet-resolution.service';

function setup() {
  const events = { findOne: jest.fn() };
  const outcomes = { find: jest.fn() };
  const bets = { find: jest.fn() };
  const savedBets: Array<Record<string, unknown>> = [];
  const betRepo = {
    save: jest.fn().mockImplementation(async (b: Record<string, unknown>) => {
      savedBets.push({ ...b });
      return b;
    }),
  };
  const histRepo = {
    create: jest.fn().mockImplementation((h: unknown) => h),
    save: jest.fn().mockResolvedValue(undefined),
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
  const bus = { publish: jest.fn(), subscribe: jest.fn() };

  const service = new BetResolutionService(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bets as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    outcomes as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    events as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dataSource as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wallet as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bus as any,
  );
  return { service, events, outcomes, bets, wallet, bus, savedBets };
}

describe('BetResolutionService.resolveForEvent (T5.3)', () => {
  it('marque WON/LOST, calcule le gain, crédite et trace l’historique', async () => {
    const { service, events, outcomes, bets, wallet, bus, savedBets } = setup();
    events.findOne.mockResolvedValue({ id: 3, status: EventStatus.TERMINE });
    outcomes.find.mockResolvedValue([
      { id: 1, isWinner: true },
      { id: 2, isWinner: false },
    ]);
    bets.find.mockResolvedValue([
      {
        id: 10,
        outcomeId: 1,
        userId: 5,
        amount: '100.00',
        lockedOdds: '2.00',
        status: BetStatus.PENDING,
      },
      {
        id: 11,
        outcomeId: 2,
        userId: 6,
        amount: '50.00',
        lockedOdds: '3.00',
        status: BetStatus.PENDING,
      },
    ]);

    const summary = await service.resolveForEvent(3);

    expect(summary).toEqual({ eSportEventId: 3, won: 1, lost: 1 });
    // Gain du gagnant = 100 × 2.00 = 200 crédité une seule fois.
    expect(wallet.credit).toHaveBeenCalledTimes(1);
    expect(wallet.credit).toHaveBeenCalledWith(
      expect.anything(),
      5,
      200,
      TransactionType.WIN,
      expect.any(String),
    );
    expect(savedBets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 10, status: BetStatus.WON }),
        expect.objectContaining({ id: 11, status: BetStatus.LOST }),
      ]),
    );
    expect(bus.publish).toHaveBeenCalledWith('bet.won', expect.objectContaining({ betId: 10 }));
    expect(bus.publish).toHaveBeenCalledWith('bet.lost', expect.objectContaining({ betId: 11 }));
  });

  it('refuse si l’événement n’est pas TERMINE', async () => {
    const { service, events } = setup();
    events.findOne.mockResolvedValue({ id: 3, status: EventStatus.FERME });
    await expect(service.resolveForEvent(3)).rejects.toMatchObject({
      errorCode: BetNextErrorCode.VALIDATION_ERROR,
    });
  });

  it('lève NOT_FOUND si l’événement est absent', async () => {
    const { service, events } = setup();
    events.findOne.mockResolvedValue(null);
    await expect(service.resolveForEvent(99)).rejects.toMatchObject({
      errorCode: BetNextErrorCode.NOT_FOUND,
    });
  });
});
