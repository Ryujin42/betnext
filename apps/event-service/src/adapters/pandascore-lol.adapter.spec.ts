import { ConfigService } from '@nestjs/config';
import { PandaScoreLolAdapter } from './pandascore-lol.adapter';

function fakeConfig(token = 'test-token'): ConfigService {
  return {
    getOrThrow: jest.fn().mockReturnValue(token),
    get: jest.fn().mockReturnValue(token),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('PandaScoreLolAdapter', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('mappe les matchs PandaScore en IExternalEvent (TEAM_WINS par équipe)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: 1001,
            name: 'T1 vs Gen.G',
            begin_at: '2026-07-01T17:00:00Z',
            status: 'not_started',
            winner_id: null,
            tournament: { name: 'LCK Spring 2026' },
            league: { name: 'LCK' },
            opponents: [
              { opponent: { id: 11, name: 'T1' } },
              { opponent: { id: 22, name: 'Gen.G' } },
            ],
          },
        ]),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const adapter = new PandaScoreLolAdapter(fakeConfig());
    const events = await adapter.fetchLiveEvents();

    expect(events).toHaveLength(1);
    const ev = events[0];
    expect(ev.externalId).toBe('pandascore-lol-1001');
    expect(ev.game).toBe('lol');
    expect(ev.tournament).toBe('LCK Spring 2026');
    expect(ev.teams).toEqual([{ name: 'T1' }, { name: 'Gen.G' }]);
    expect(ev.outcomes).toEqual([
      expect.objectContaining({
        label: 'T1 gagne',
        teamIndex: 0,
        condition: { type: 'TEAM_WINS' },
      }),
      expect.objectContaining({
        label: 'Gen.G gagne',
        teamIndex: 1,
        condition: { type: 'TEAM_WINS' },
      }),
    ]);
  });

  it('filtre les matchs sans `begin_at` ou sans 2 adversaires connus', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: 1,
            name: 'TBD vs ?',
            begin_at: null,
            status: 'not_started',
            winner_id: null,
            tournament: { name: 'X' },
            league: { name: 'X' },
            opponents: [{ opponent: { id: 1, name: 'A' } }, { opponent: null }],
          },
        ]),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const adapter = new PandaScoreLolAdapter(fakeConfig());
    const events = await adapter.fetchLiveEvents();
    expect(events).toHaveLength(0);
  });

  it('fetchEventResult retourne le classement (gagnant = rank 1)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 1001,
          name: 'T1 vs Gen.G',
          begin_at: '2026-07-01T17:00:00Z',
          status: 'finished',
          winner_id: 22,
          tournament: { name: 'LCK' },
          league: { name: 'LCK' },
          opponents: [
            { opponent: { id: 11, name: 'T1' } },
            { opponent: { id: 22, name: 'Gen.G' } },
          ],
        }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const adapter = new PandaScoreLolAdapter(fakeConfig());
    const result = await adapter.fetchEventResult('pandascore-lol-1001');
    expect(result.finalRanking).toEqual([
      { teamIndex: 0, rank: 2 },
      { teamIndex: 1, rank: 1 },
    ]);
  });

  it('lève une erreur si l’API répond non-2xx', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const adapter = new PandaScoreLolAdapter(fakeConfig());
    await expect(adapter.fetchLiveEvents()).rejects.toThrow(/401/);
  });
});
