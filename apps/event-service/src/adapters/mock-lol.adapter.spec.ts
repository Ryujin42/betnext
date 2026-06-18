import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AdaptersModule } from './adapters.module';
import { GameAdapterRegistry } from './game-adapter.registry';

describe('MockLolAdapter (via injection NestJS)', () => {
  let registry: GameAdapterRegistry;

  beforeAll(async () => {
    // Le module charge PandaScoreLolAdapter qui exige `PANDASCORE_TOKEN` à
    // l'instanciation, même si `GAME_ADAPTER=mock` reste sélectionné.
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ GAME_ADAPTER: 'mock', PANDASCORE_TOKEN: 'test-token' })],
        }),
        AdaptersModule,
      ],
    }).compile();
    registry = moduleRef.get(GameAdapterRegistry);
  });

  it("découvre l'adaptateur 'lol' via injection", () => {
    expect(registry.getTypes()).toContain('lol');
  });

  it('fetchLiveEvents() renvoie des événements LoL typés', async () => {
    const events = await registry.getAdapter('lol').fetchLiveEvents();

    expect(events.length).toBeGreaterThanOrEqual(2);
    for (const event of events) {
      expect(event.game).toBe('lol');
      expect(event.externalId).toBeTruthy();
      expect(event.teams.length).toBeGreaterThanOrEqual(2);
      expect(event.outcomes.length).toBeGreaterThan(0);
    }
  });

  it('mapToSportEvent() normalise un événement brut', async () => {
    const adapter = registry.getAdapter('lol');
    const [raw] = await adapter.fetchLiveEvents();
    const mapped = adapter.mapToSportEvent(raw);

    expect(mapped.externalId).toBe(raw.externalId);
    expect(mapped.game).toBe('lol');
    expect(mapped.outcomes).toHaveLength(raw.outcomes.length);
  });

  it('fetchEventResult() renvoie un classement final', async () => {
    const result = await registry.getAdapter('lol').fetchEventResult('lol-lck-2026-final');

    expect(result.externalId).toBe('lol-lck-2026-final');
    expect(result.finalRanking.length).toBeGreaterThanOrEqual(2);
    expect(result.finalRanking[0].rank).toBe(1);
  });

  it("rejette un type d'adaptateur inconnu", () => {
    expect(() => registry.getAdapter('cs2')).toThrow();
  });
});
