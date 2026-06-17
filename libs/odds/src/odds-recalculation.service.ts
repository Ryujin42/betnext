import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { BetStatus } from '@betnext/shared-types';
import { BetEntity, OutcomeEntity } from '@betnext/database';
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
    const updates = await this.lock.withLock(`odds:event:${eSportEventId}`, LOCK_TTL_SECONDS, () =>
      this.recompute(eSportEventId),
    );

    if (!updates || updates.length === 0) {
      return null;
    }

    const payload: OddsUpdatedEvent = {
      eSportEventId,
      odds: updates,
      occurredAt: new Date().toISOString(),
    };
    await this.bus.publish<OddsUpdatedEvent>(BetNextTopic.OddsUpdated, payload);
    this.logger.log(
      `Cotes recalculées pour l'événement ${eSportEventId} (${updates.length} issues).`,
    );
    return payload;
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
