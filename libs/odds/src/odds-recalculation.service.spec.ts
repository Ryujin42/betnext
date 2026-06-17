import 'reflect-metadata';
import { BetEntity, OutcomeEntity } from '@betnext/database';
import { InMemoryLock } from '@betnext/shared-events';
import { OddsRecalculationService } from './odds-recalculation.service';

interface OutcomeRow {
  id: number;
  eSportEventId: number;
  odds: string;
}

/** Construit un DataSource mocké dont la transaction reçoit un manager mocké. */
function makeDataSource(
  outcomes: OutcomeRow[],
  bets: Array<{ outcomeId: number; amount: string }>,
) {
  const outcomeRepo = {
    find: jest.fn().mockResolvedValue(outcomes),
    save: jest.fn().mockImplementation(async (rows: OutcomeRow[]) => rows),
  };
  const betRepo = { find: jest.fn().mockResolvedValue(bets) };
  const manager = {
    getRepository: jest.fn((entity: unknown) =>
      entity === OutcomeEntity ? outcomeRepo : entity === BetEntity ? betRepo : null,
    ),
  };
  const dataSource = {
    transaction: jest.fn(async (cb: (m: typeof manager) => unknown) => cb(manager)),
  };
  return { dataSource, outcomeRepo, betRepo };
}

describe('OddsRecalculationService (T5.2)', () => {
  it('applique la formule total/issue et publie odds.updated', async () => {
    const outcomes: OutcomeRow[] = [
      { id: 1, eSportEventId: 10, odds: '1.50' },
      { id: 2, eSportEventId: 10, odds: '1.50' },
    ];
    const bets = [
      { outcomeId: 1, amount: '100.00' },
      { outcomeId: 2, amount: '300.00' }, // total = 400
    ];
    const { dataSource, outcomeRepo } = makeDataSource(outcomes, bets);
    const bus = { publish: jest.fn(), subscribe: jest.fn() };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new OddsRecalculationService(dataSource as any, bus as any, new InMemoryLock());

    const result = await service.recalculate(10);

    // 400/100 = 4.00 ; 400/300 = 1.33
    expect(outcomes[0].odds).toBe('4.00');
    expect(outcomes[1].odds).toBe('1.33');
    expect(outcomeRepo.save).toHaveBeenCalledTimes(1);
    expect(bus.publish).toHaveBeenCalledWith(
      'odds.updated',
      expect.objectContaining({
        eSportEventId: 10,
        odds: [
          { outcomeId: 1, odds: 4 },
          { outcomeId: 2, odds: 1.33 },
        ],
      }),
    );
    expect(result).not.toBeNull();
  });

  it('cote par défaut (1.50) pour une issue sans mise', async () => {
    const outcomes: OutcomeRow[] = [{ id: 1, eSportEventId: 10, odds: '2.00' }];
    const { dataSource } = makeDataSource(outcomes, []);
    const bus = { publish: jest.fn(), subscribe: jest.fn() };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new OddsRecalculationService(dataSource as any, bus as any, new InMemoryLock());

    await service.recalculate(10);

    expect(outcomes[0].odds).toBe('1.50');
  });

  it('le verrou empêche les recalculs concurrents (un seul recompute)', async () => {
    const outcomes: OutcomeRow[] = [{ id: 1, eSportEventId: 10, odds: '1.50' }];
    const bets = [{ outcomeId: 1, amount: '100.00' }];
    const outcomeRepo = {
      find: jest.fn().mockResolvedValue(outcomes),
      save: jest.fn().mockResolvedValue(outcomes),
    };
    const betRepo = { find: jest.fn().mockResolvedValue(bets) };
    const manager = {
      getRepository: jest.fn((entity: unknown) =>
        entity === OutcomeEntity ? outcomeRepo : betRepo,
      ),
    };
    const dataSource = {
      transaction: jest.fn(async (cb: (m: typeof manager) => unknown) => {
        await new Promise((r) => setTimeout(r, 20)); // recompute lent
        return cb(manager);
      }),
    };
    const bus = { publish: jest.fn(), subscribe: jest.fn() };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new OddsRecalculationService(dataSource as any, bus as any, new InMemoryLock());

    // Deux recalculs simultanés sur le même événement.
    const [a, b] = await Promise.all([service.recalculate(10), service.recalculate(10)]);

    // Le verrou en sérialise un seul ; l'autre est ignoré (null).
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect([a, b].filter((r) => r === null)).toHaveLength(1);
  });
});
