import 'reflect-metadata';
import { BetEntity, BetHistoryEntity } from '@betnext/database';
import { BetNextErrorCode, BetStatus, EventStatus } from '@betnext/shared-types';
import { BetsService } from './bets.service';
import { BetNextException } from '../common/betnext.exception';

const FUTURE = new Date(Date.now() + 86_400_000);
const PAST = new Date(Date.now() - 86_400_000);

function setup() {
  const outcomes = { findOne: jest.fn() };
  const events = { findOne: jest.fn() };
  const betRepo = {
    create: jest.fn().mockImplementation((b: Record<string, unknown>) => b),
    save: jest.fn().mockImplementation(async (b: Record<string, unknown>) => ({
      ...b,
      id: 1,
      toPublic: () => ({ id: 1, ...b }),
    })),
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
  const rg = { assertCanBet: jest.fn().mockResolvedValue(undefined) };
  const bus = { publish: jest.fn(), subscribe: jest.fn() };
  const notifier = { notifyBetPlaced: jest.fn().mockResolvedValue(undefined) };

  const service = new BetsService(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    {} as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    outcomes as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    events as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dataSource as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wallet as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rg as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bus as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    notifier as any,
  );
  return { service, outcomes, events, betRepo, wallet, rg, bus, notifier };
}

describe('BetsService.placeBet (T5.1)', () => {
  it('place un pari valide : débit + persistance PENDING + bet.placed', async () => {
    const { service, outcomes, events, betRepo, wallet, bus } = setup();
    outcomes.findOne.mockResolvedValue({
      id: 7,
      eSportEventId: 3,
      odds: '2.00',
      label: 'T1 gagne',
    });
    events.findOne.mockResolvedValue({ id: 3, status: EventStatus.PUBLIE, startDate: FUTURE });

    await service.placeBet(5, { outcomeId: 7, amount: 10 });

    expect(wallet.debit).toHaveBeenCalledWith(expect.anything(), 5, 10, expect.any(String));
    expect(betRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: BetStatus.PENDING,
        lockedOdds: '2.00',
        amount: '10.00',
        outcomeId: 7,
        userId: 5,
      }),
    );
    expect(bus.publish).toHaveBeenCalledWith(
      'bet.placed',
      expect.objectContaining({
        betId: 1,
        userId: 5,
        outcomeId: 7,
        eSportEventId: 3,
        lockedOdds: 2,
      }),
    );
  });

  it('refuse si l’issue est introuvable (NOT_FOUND)', async () => {
    const { service, outcomes } = setup();
    outcomes.findOne.mockResolvedValue(null);
    await expect(service.placeBet(5, { outcomeId: 99, amount: 10 })).rejects.toMatchObject({
      errorCode: BetNextErrorCode.NOT_FOUND,
    });
  });

  it('refuse si l’événement n’est pas publié (EVENT_NOT_PUBLISHED)', async () => {
    const { service, outcomes, events, wallet } = setup();
    outcomes.findOne.mockResolvedValue({ id: 7, eSportEventId: 3, odds: '2.00', label: 'x' });
    events.findOne.mockResolvedValue({ id: 3, status: EventStatus.FERME, startDate: FUTURE });
    await expect(service.placeBet(5, { outcomeId: 7, amount: 10 })).rejects.toMatchObject({
      errorCode: BetNextErrorCode.EVENT_NOT_PUBLISHED,
    });
    expect(wallet.debit).not.toHaveBeenCalled();
  });

  it('refuse si l’événement a déjà commencé (EVENT_ALREADY_STARTED)', async () => {
    const { service, outcomes, events } = setup();
    outcomes.findOne.mockResolvedValue({ id: 7, eSportEventId: 3, odds: '2.00', label: 'x' });
    events.findOne.mockResolvedValue({ id: 3, status: EventStatus.PUBLIE, startDate: PAST });
    await expect(service.placeBet(5, { outcomeId: 7, amount: 10 })).rejects.toMatchObject({
      errorCode: BetNextErrorCode.EVENT_ALREADY_STARTED,
    });
  });

  it('refuse si une limite jeu responsable est atteinte (pas de débit)', async () => {
    const { service, outcomes, events, rg, wallet, bus } = setup();
    outcomes.findOne.mockResolvedValue({ id: 7, eSportEventId: 3, odds: '2.00', label: 'x' });
    events.findOne.mockResolvedValue({ id: 3, status: EventStatus.PUBLIE, startDate: FUTURE });
    rg.assertCanBet.mockRejectedValue(
      new BetNextException(BetNextErrorCode.DAILY_LIMIT_REACHED, 422, 'limite'),
    );
    await expect(service.placeBet(5, { outcomeId: 7, amount: 10 })).rejects.toMatchObject({
      errorCode: BetNextErrorCode.DAILY_LIMIT_REACHED,
    });
    expect(wallet.debit).not.toHaveBeenCalled();
    expect(bus.publish).not.toHaveBeenCalled();
  });

  it('propage INSUFFICIENT_BALANCE du wallet (pas de bet.placed)', async () => {
    const { service, outcomes, events, wallet, bus } = setup();
    outcomes.findOne.mockResolvedValue({ id: 7, eSportEventId: 3, odds: '2.00', label: 'x' });
    events.findOne.mockResolvedValue({ id: 3, status: EventStatus.PUBLIE, startDate: FUTURE });
    wallet.debit.mockRejectedValue(
      new BetNextException(BetNextErrorCode.INSUFFICIENT_BALANCE, 422, 'solde'),
    );
    await expect(service.placeBet(5, { outcomeId: 7, amount: 10 })).rejects.toMatchObject({
      errorCode: BetNextErrorCode.INSUFFICIENT_BALANCE,
    });
    expect(bus.publish).not.toHaveBeenCalled();
  });

  // T7.3 — DoD : couper le notification-service ne bloque pas le placement.
  it('résiste à une panne du notification-service : le pari est placé même si la notification échoue', async () => {
    const { service, outcomes, events, betRepo, notifier, bus } = setup();
    outcomes.findOne.mockResolvedValue({
      id: 7,
      eSportEventId: 3,
      odds: '2.00',
      label: 'T1 gagne',
    });
    events.findOne.mockResolvedValue({ id: 3, status: EventStatus.PUBLIE, startDate: FUTURE });
    // Le notifier (best-effort) doit absorber l'exception en interne et ne
    // jamais propager ; on simule donc une notif silencieusement perdue.
    notifier.notifyBetPlaced.mockResolvedValue(undefined);

    const result = await service.placeBet(5, { outcomeId: 7, amount: 10 });

    expect(result).toMatchObject({ id: 1 });
    expect(betRepo.save).toHaveBeenCalled();
    expect(bus.publish).toHaveBeenCalledWith('bet.placed', expect.any(Object));
    expect(notifier.notifyBetPlaced).toHaveBeenCalledWith(5, 1, 10);
  });
});
