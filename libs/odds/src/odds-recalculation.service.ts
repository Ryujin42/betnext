import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { BetStatus } from '@betnext/shared-types';
import { BetEntity, OutcomeEntity } from '@betnext/database';
import { BetNextMetrics } from '@betnext/observability';
import { computeOdds, toCents } from '@betnext/shared-utils';
import {
  BetNextTopic,
  BetPlacedEvent,
  DISTRIBUTED_LOCK,
  EVENT_BUS,
  IDistributedLock,
  IEventBus,
  OddsUpdatedEvent,
} from '@betnext/shared-events';
import { CachedOdds, IOddsCache, ODDS_CACHE } from './odds-cache.interface';

/** TTL du verrou de recalcul (« SET NX EX 60 » — cf. T5.2). */
const LOCK_TTL_SECONDS = 60;

/**
 * Moteur de cotes (T5.2). À chaque `bet.placed`, recalcule les cotes de toutes
 * les issues de l'événement concerné :
 *
 *   cote(issue) = total misé sur l'événement / total misé sur l'issue
 *
 * Le recalcul s'exécute sous **verrou distribué** (`odds:event:<id>`, TTL 60 s)
 * pour qu'aucun recalcul concurrent ne produise de cotes incohérentes : si le
 * verrou est déjà détenu, le travail est ignoré (le détenteur relit l'état
 * courant et publiera les cotes à jour). Émet `odds.updated` après recalcul.
 *
 * Hébergé par l'odds-engine (consommateur) ET par le betting-service en Lot 5
 * (bus in-memory mono-processus). Au Lot 7, seul l'odds-engine consommera, via
 * le bus Redis/BullMQ.
 */
@Injectable()
export class OddsRecalculationService implements OnModuleInit {
  private readonly logger = new Logger(OddsRecalculationService.name);

  constructor(
    private readonly dataSource: DataSource,
    @Inject(EVENT_BUS) private readonly bus: IEventBus,
    @Inject(DISTRIBUTED_LOCK) private readonly lock: IDistributedLock,
    // Optional : Lot 7 — si le cache est branché (ODDS_CACHE), on alimente
    // au passage. Tant qu'il n'est pas fourni (Lot 5/6, tests), le service
    // fonctionne exactement comme avant.
    @Optional() @Inject(ODDS_CACHE) private readonly cache: IOddsCache | null = null,
    // T11.2 — métriques de latence de recalcul (optionnel : absent en tests/Lot 5).
    @Optional() private readonly metrics: BetNextMetrics | null = null,
  ) {}

  onModuleInit(): void {
    this.bus.subscribe<BetPlacedEvent>(BetNextTopic.BetPlaced, async (event) => {
      await this.recalculate(event.eSportEventId);
    });
  }

  /**
   * Recalcule et persiste les cotes de l'événement. Renvoie le payload
   * `odds.updated` émis, ou `null` si le verrou n'a pas été acquis (recalcul
   * concurrent ignoré) ou s'il n'y a aucune issue.
   */
  async recalculate(eSportEventId: number): Promise<OddsUpdatedEvent | null> {
    const startedAt = Date.now();
    const updates = await this.lock.withLock(`odds:event:${eSportEventId}`, LOCK_TTL_SECONDS, () =>
      this.recompute(eSportEventId),
    );

    if (!updates || updates.length === 0) {
      return null;
    }
    // T11.2 — latence de recalcul (uniquement quand un recompute a eu lieu).
    this.metrics?.observeOddsCalculation(Date.now() - startedAt);

    const payload: OddsUpdatedEvent = {
      eSportEventId,
      odds: updates,
      occurredAt: new Date().toISOString(),
    };
    if (this.cache) {
      // T7.3 — alimente le fallback : si une lecture future ne peut pas
      // recalculer (DB down), elle servira ce snapshot.
      const snapshot: CachedOdds = {
        eSportEventId,
        odds: updates,
        computedAt: payload.occurredAt,
      };
      await this.cache.set(snapshot);
    }
    await this.bus.publish<OddsUpdatedEvent>(BetNextTopic.OddsUpdated, payload);
    this.logger.log(
      `Cotes recalculées pour l'événement ${eSportEventId} (${updates.length} issues).`,
    );
    return payload;
  }

  /**
   * Lecture résiliente (T7.3) : tente un recalcul frais, retombe sur la
   * dernière valeur connue en cache si le recompute échoue (DB indisponible,
   * verrou non acquis sans cache mis à jour, etc.). Renvoie `null` si on n'a
   * jamais cotée cet événement.
   */
  async getLastKnownOdds(eSportEventId: number): Promise<CachedOdds | null> {
    try {
      const fresh = await this.recalculate(eSportEventId);
      if (fresh) {
        return { eSportEventId, odds: fresh.odds, computedAt: fresh.occurredAt };
      }
    } catch (err) {
      this.logger.warn(
        `Recalcul cotes event ${eSportEventId} en échec, fallback sur cache : ${(err as Error).message}`,
      );
    }
    if (this.cache) {
      return this.cache.get(eSportEventId);
    }
    return null;
  }

  /** Lit les mises courantes, applique la formule, persiste les cotes (transaction). */
  private async recompute(
    eSportEventId: number,
  ): Promise<Array<{ outcomeId: number; odds: number }>> {
    return this.dataSource.transaction(async (manager) => {
      const outcomeRepo = manager.getRepository(OutcomeEntity);
      const betRepo = manager.getRepository(BetEntity);

      const outcomes = await outcomeRepo.find({ where: { eSportEventId } });
      if (outcomes.length === 0) {
        return [];
      }

      const bets = await betRepo.find({
        where: { outcomeId: In(outcomes.map((o) => o.id)), status: BetStatus.PENDING },
      });

      const stakeCentsByOutcome = new Map<number, number>();
      let totalCents = 0;
      for (const bet of bets) {
        const cents = toCents(Number(bet.amount));
        totalCents += cents;
        stakeCentsByOutcome.set(
          bet.outcomeId,
          (stakeCentsByOutcome.get(bet.outcomeId) ?? 0) + cents,
        );
      }

      const updates: Array<{ outcomeId: number; odds: number }> = [];
      for (const outcome of outcomes) {
        const outcomeCents = stakeCentsByOutcome.get(outcome.id) ?? 0;
        const odds = computeOdds(totalCents / 100, outcomeCents / 100);
        outcome.odds = odds.toFixed(2);
        updates.push({ outcomeId: outcome.id, odds });
      }
      await outcomeRepo.save(outcomes);
      return updates;
    });
  }
}
