import 'reflect-metadata';
import { BetNextErrorCode } from '@betnext/shared-types';
import { RgProfilesService } from './rg-profiles.service';

/** Faux dépôt de profils (1 user max) qui mime juste find/save + toPublic. */
function toPublic(store: Record<string, unknown>): Record<string, unknown> {
  const num = (k: string) =>
    store[k] !== null && store[k] !== undefined ? Number(store[k]) : null;
  const iso = (k: string) =>
    store[k] instanceof Date ? (store[k] as Date).toISOString() : (store[k] ?? null);
  return {
    id: store.id ?? 1,
    userId: store.userId,
    dailyBetLimit: num('dailyBetLimit'),
    weeklyBetLimit: num('weeklyBetLimit'),
    dailyDepositLimit: num('dailyDepositLimit'),
    weeklyDepositLimit: num('weeklyDepositLimit'),
    selfExcludedUntil: iso('selfExcludedUntil'),
    limitUpdatedAt: iso('limitUpdatedAt'),
  };
}

function makeRepo(initial: Partial<Record<string, unknown>> | null = null) {
  let store: Record<string, unknown> | null = initial ? { id: 1, userId: 3, ...initial } : null;
  return {
    findOne: jest.fn(async () => {
      if (!store) return null;
      const snapshot = store;
      return { ...snapshot, toPublic: () => toPublic(snapshot) };
    }),
    create: jest.fn((data: Record<string, unknown>) => ({ id: 1, ...data })),
    save: jest.fn(async (entity: Record<string, unknown>) => {
      // Exclut `toPublic` du merge pour ne pas écraser la fonction.
      const { toPublic: _omit, ...payload } = entity;
      void _omit;
      store = { ...(store ?? {}), ...payload };
      const snapshot = store;
      return { ...snapshot, toPublic: () => toPublic(snapshot) };
    }),
    _getStore: () => store,
  };
}

function makeBus() {
  return { publish: jest.fn().mockResolvedValue(undefined), subscribe: jest.fn() };
}

function makeService(repo: ReturnType<typeof makeRepo>, bus = makeBus()) {
  return {
    service: new RgProfilesService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      repo as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bus as any,
    ),
    repo,
    bus,
  };
}

describe('RgProfilesService.updateLimits — règle des 48h (T7.2)', () => {
  it("crée le profil avec des limites null s'il n'existe pas", async () => {
    const repo = makeRepo(null);
    const { service } = makeService(repo);
    const profile = await service.getProfile(3);
    expect(profile.dailyBetLimit).toBeNull();
  });

  it('baisse → effet immédiat, événement `immediate`, met à jour `limit_updated_at`', async () => {
    const repo = makeRepo({ dailyDepositLimit: '1000.00', pendingDailyDepositLimit: null });
    const { service, bus } = makeService(repo);

    const result = await service.updateLimits(3, { dailyDepositLimit: 500 });

    expect(result.dailyDepositLimit).toBe(500);
    expect(bus.publish).toHaveBeenCalledWith(
      'rg.limit_updated',
      expect.objectContaining({ userId: 3, effect: 'immediate' }),
    );
  });

  it('hausse → effet différé 48h : valeur en `pending_*`, événement `pending`', async () => {
    const repo = makeRepo({ dailyDepositLimit: '500.00', pendingDailyDepositLimit: null });
    const { service, bus } = makeService(repo);

    const before = Date.now();
    const result = await service.updateLimits(3, { dailyDepositLimit: 1500 });

    // La limite courante reste l'ancienne (plus stricte).
    expect(result.dailyDepositLimit).toBe(500);
    const stored = repo._getStore() as Record<string, unknown>;
    expect(stored.pendingDailyDepositLimit).toBe('1500.00');
    expect((stored.pendingEffectiveAt as Date).getTime()).toBeGreaterThanOrEqual(
      before + 48 * 60 * 60 * 1000 - 1000,
    );
    expect(bus.publish).toHaveBeenCalledWith(
      'rg.limit_updated',
      expect.objectContaining({ effect: 'pending' }),
    );
  });

  it('refuse une 2e hausse tant que la précédente est encore pending (LIMIT_INCREASE_PENDING)', async () => {
    const repo = makeRepo({
      dailyDepositLimit: '500.00',
      pendingDailyDepositLimit: '1500.00',
      pendingEffectiveAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    const { service } = makeService(repo);

    await expect(service.updateLimits(3, { dailyDepositLimit: 2000 })).rejects.toMatchObject({
      errorCode: BetNextErrorCode.LIMIT_INCREASE_PENDING,
    });
  });

  it('après la fenêtre 48h, la hausse pending devient la limite courante (promotion)', async () => {
    const repo = makeRepo({
      dailyDepositLimit: '500.00',
      pendingDailyDepositLimit: '1500.00',
      pendingEffectiveAt: new Date(Date.now() - 60 * 1000), // déjà échue
    });
    const { service } = makeService(repo);

    const profile = await service.getProfile(3);
    expect(profile.dailyDepositLimit).toBe(1500);
    const stored = repo._getStore() as Record<string, unknown>;
    expect(stored.pendingDailyDepositLimit).toBeNull();
    expect(stored.pendingEffectiveAt).toBeNull();
  });
});

describe('RgProfilesService.selfExclude (T7.2)', () => {
  it('pose `self_excluded_until` à now + N jours et émet `rg.self_excluded`', async () => {
    const repo = makeRepo({});
    const { service, bus } = makeService(repo);

    const before = Date.now();
    const profile = await service.selfExclude(3, { durationDays: 30 });

    expect(profile.selfExcludedUntil).not.toBeNull();
    const until = new Date(profile.selfExcludedUntil ?? '').getTime();
    expect(until).toBeGreaterThanOrEqual(before + 30 * 24 * 60 * 60 * 1000 - 1000);
    expect(bus.publish).toHaveBeenCalledWith(
      'rg.self_excluded',
      expect.objectContaining({ userId: 3 }),
    );
  });

  it("ne raccourcit jamais une auto-exclusion déjà active (peut seulement l'allonger)", async () => {
    const longUntil = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    const repo = makeRepo({ selfExcludedUntil: longUntil });
    const { service } = makeService(repo);

    const profile = await service.selfExclude(3, { durationDays: 7 });
    expect(new Date(profile.selfExcludedUntil ?? '').getTime()).toBe(longUntil.getTime());
  });
});

describe('RgProfilesService.isSelfExcluded (T7.2)', () => {
  it('renvoie excluded=true tant que la date est dans le futur', async () => {
    const until = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const repo = makeRepo({ selfExcludedUntil: until });
    const { service } = makeService(repo);
    const result = await service.isSelfExcluded(3);
    expect(result.excluded).toBe(true);
    expect(result.until?.getTime()).toBe(until.getTime());
  });

  it('renvoie excluded=false si la date est passée', async () => {
    const until = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const repo = makeRepo({ selfExcludedUntil: until });
    const { service } = makeService(repo);
    const result = await service.isSelfExcluded(3);
    expect(result.excluded).toBe(false);
  });

  it("renvoie excluded=false si pas de profil ou pas de date d'exclusion", async () => {
    const { service } = makeService(makeRepo(null));
    expect((await service.isSelfExcluded(3)).excluded).toBe(false);
  });
});
