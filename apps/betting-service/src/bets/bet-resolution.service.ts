import { HttpStatus, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { BetNextErrorCode, BetStatus, EventStatus, TransactionType } from '@betnext/shared-types';
import { BetEntity, BetHistoryEntity, EsportEventEntity, OutcomeEntity } from '@betnext/database';
import { applyOdds, fromCents, toCents } from '@betnext/shared-utils';
import {
  BetNextTopic,
  BetResolvedEvent,
  EVENT_BUS,
  EventResultSetEvent,
  IEventBus,
} from '@betnext/shared-events';
import { BetNextException } from '../common/betnext.exception';
import { IWalletService, WALLET_SERVICE } from '../wallet/wallet.interface';

export interface ResolutionSummary {
  eSportEventId: number;
  won: number;
  lost: number;
}

/**
 * Résolution des paris (T5.3). Déclenchée par l'événement `event.result_set` du
 * bus (abonnement in-process au Lot 5 ; bus Redis inter-services au Lot 7) ou
 * par l'endpoint interne de déclenchement.
 *
 * Pour chaque pari PENDING de l'événement résolu : statut WON/LOST selon
 * `outcomes.is_winner`, gain `amount × locked_odds` crédité au gagnant, trace
 * append-only dans `bets_history`, puis émission `bet.won` / `bet.lost`.
 */
@Injectable()
export class BetResolutionService implements OnModuleInit {
  private readonly logger = new Logger(BetResolutionService.name);

  constructor(
    @InjectRepository(BetEntity)
    private readonly bets: Repository<BetEntity>,
    @InjectRepository(OutcomeEntity)
    private readonly outcomes: Repository<OutcomeEntity>,
    @InjectRepository(EsportEventEntity)
    private readonly events: Repository<EsportEventEntity>,
    private readonly dataSource: DataSource,
    @Inject(WALLET_SERVICE) private readonly wallet: IWalletService,
    @Inject(EVENT_BUS) private readonly bus: IEventBus,
  ) {}

  onModuleInit(): void {
    this.bus.subscribe<EventResultSetEvent>(BetNextTopic.EventResultSet, async (event) => {
      await this.resolveForEvent(event.eSportEventId);
    });
  }

  async resolveForEvent(eSportEventId: number): Promise<ResolutionSummary> {
    const event = await this.events.findOne({ where: { id: eSportEventId } });
    if (!event) {
      throw new BetNextException(
        BetNextErrorCode.NOT_FOUND,
        HttpStatus.NOT_FOUND,
        `Événement ${eSportEventId} introuvable.`,
      );
    }
    if (event.status !== EventStatus.TERMINE) {
      throw new BetNextException(
        BetNextErrorCode.VALIDATION_ERROR,
        HttpStatus.CONFLICT,
        `Résolution impossible : l'événement doit être TERMINE (statut ${event.status}).`,
      );
    }

    const outcomes = await this.outcomes.find({ where: { eSportEventId } });
    const winnerByOutcomeId = new Map(outcomes.map((o) => [o.id, o.isWinner === true]));
    const outcomeIds = outcomes.map((o) => o.id);
    if (outcomeIds.length === 0) {
      return { eSportEventId, won: 0, lost: 0 };
    }

    const pending = await this.bets.find({
      where: { outcomeId: In(outcomeIds), status: BetStatus.PENDING },
    });

    const resolved: BetResolvedEvent[] = [];
    const summary = await this.dataSource.transaction(async (manager) => {
      let won = 0;
      let lost = 0;
      const betRepo = manager.getRepository(BetEntity);
      const histRepo = manager.getRepository(BetHistoryEntity);

      for (const bet of pending) {
        const isWinner = winnerByOutcomeId.get(bet.outcomeId) === true;
        const oldStatus = bet.status;
        const newStatus = isWinner ? BetStatus.WON : BetStatus.LOST;
        const amount = Number(bet.amount);
        const payout = isWinner ? fromCents(applyOdds(toCents(amount), Number(bet.lockedOdds))) : 0;

        bet.status = newStatus;
        await betRepo.save(bet);

        if (isWinner) {
          await this.wallet.credit(
            manager,
            bet.userId,
            payout,
            TransactionType.WIN,
            `Gain pari #${bet.id}`,
          );
          won += 1;
        } else {
          lost += 1;
        }

        await histRepo.save(
          histRepo.create({
            oldStatus,
            newStatus,
            reason: isWinner ? `Gagné (+${payout.toFixed(2)} €)` : 'Perdu',
            betId: bet.id,
          }),
        );

        resolved.push({
          betId: bet.id,
          userId: bet.userId,
          status: newStatus,
          amount,
          payout,
          occurredAt: new Date().toISOString(),
        });
      }

      return { eSportEventId, won, lost };
    });

    for (const event of resolved) {
      const topic = event.status === BetStatus.WON ? BetNextTopic.BetWon : BetNextTopic.BetLost;
      await this.bus.publish<BetResolvedEvent>(topic, event);
    }

    this.logger.log(
      `Résolution événement ${eSportEventId} : ${summary.won} gagnés / ${summary.lost} perdus.`,
    );
    return summary;
  }
}
