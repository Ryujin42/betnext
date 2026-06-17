import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BetNextErrorCode, BetStatus, EventStatus, IBet, IBetView } from '@betnext/shared-types';
import { BetEntity, BetHistoryEntity, EsportEventEntity, OutcomeEntity } from '@betnext/database';
import { applyOdds, fromCents, isPast, toCents } from '@betnext/shared-utils';
import { BetNextTopic, BetPlacedEvent, EVENT_BUS, IEventBus } from '@betnext/shared-events';
import { BetNextException } from '../common/betnext.exception';
import { PlaceBetDto } from './dto/place-bet.dto';
import { IWalletService, WALLET_SERVICE } from '../wallet/wallet.interface';
import {
  IResponsibleGaming,
  RESPONSIBLE_GAMING,
} from '../responsible-gaming/responsible-gaming.interface';

/**
 * Placement (T5.1) et historique (T5.4) des paris.
 *
 * Placement — vérifications synchrones dans l'ordre : issue/événement existent,
 * événement PUBLIE et non démarré, limites jeu responsable, puis dans une seule
 * transaction : débit du solde + création du pari (cote figée) + trace
 * d'historique. L'événement `bet.placed` est publié après commit.
 */
@Injectable()
export class BetsService {
  constructor(
    @InjectRepository(BetEntity)
    private readonly bets: Repository<BetEntity>,
    @InjectRepository(OutcomeEntity)
    private readonly outcomes: Repository<OutcomeEntity>,
    @InjectRepository(EsportEventEntity)
    private readonly events: Repository<EsportEventEntity>,
    private readonly dataSource: DataSource,
    @Inject(WALLET_SERVICE) private readonly wallet: IWalletService,
    @Inject(RESPONSIBLE_GAMING) private readonly rg: IResponsibleGaming,
    @Inject(EVENT_BUS) private readonly bus: IEventBus,
  ) {}

  async placeBet(userId: number, dto: PlaceBetDto): Promise<IBet> {
    const outcome = await this.outcomes.findOne({ where: { id: dto.outcomeId } });
    if (!outcome) {
      throw new BetNextException(
        BetNextErrorCode.NOT_FOUND,
        HttpStatus.NOT_FOUND,
        `Issue ${dto.outcomeId} introuvable.`,
      );
    }
    const event = await this.events.findOne({ where: { id: outcome.eSportEventId } });
    if (!event) {
      throw new BetNextException(
        BetNextErrorCode.NOT_FOUND,
        HttpStatus.NOT_FOUND,
        `Événement ${outcome.eSportEventId} introuvable.`,
      );
    }

    if (event.status !== EventStatus.PUBLIE) {
      throw new BetNextException(
        BetNextErrorCode.EVENT_NOT_PUBLISHED,
        HttpStatus.UNPROCESSABLE_ENTITY,
        `Les paris sont fermés : l'événement n'est pas publié (statut ${event.status}).`,
      );
    }
    if (isPast(event.startDate)) {
      throw new BetNextException(
        BetNextErrorCode.EVENT_ALREADY_STARTED,
        HttpStatus.UNPROCESSABLE_ENTITY,
        "L'événement a déjà commencé : les paris sont clôturés.",
      );
    }

    await this.rg.assertCanBet(userId, dto.amount);

    const lockedOdds = Number(outcome.odds);
    const bet = await this.dataSource.transaction(async (manager) => {
      await this.wallet.debit(manager, userId, dto.amount, `Mise pari — issue #${outcome.id}`);

      const betRepo = manager.getRepository(BetEntity);
      const created = betRepo.create({
        title: outcome.label,
        closeDate: event.startDate,
        amount: dto.amount.toFixed(2),
        lockedOdds: lockedOdds.toFixed(2),
        status: BetStatus.PENDING,
        outcomeId: outcome.id,
        userId,
      });
      const saved = await betRepo.save(created);

      const histRepo = manager.getRepository(BetHistoryEntity);
      await histRepo.save(
        histRepo.create({
          oldStatus: null,
          newStatus: BetStatus.PENDING,
          reason: 'Pari placé',
          betId: saved.id,
        }),
      );
      return saved;
    });

    await this.bus.publish<BetPlacedEvent>(BetNextTopic.BetPlaced, {
      betId: bet.id,
      userId,
      outcomeId: outcome.id,
      eSportEventId: event.id,
      amount: Number(bet.amount),
      lockedOdds,
      occurredAt: new Date().toISOString(),
    });

    return bet.toPublic();
  }

  /** Historique des paris d'un utilisateur, enrichi de l'événement/issue (T5.4). */
  async listForUser(userId: number): Promise<IBetView[]> {
    const bets = await this.bets.find({
      where: { userId },
      relations: { outcome: { event: true } },
      order: { createdAt: 'DESC' },
    });
    return bets.map((bet) => this.toView(bet));
  }

  async getForUser(userId: number, betId: number): Promise<IBetView> {
    const bet = await this.bets.findOne({
      where: { id: betId, userId },
      relations: { outcome: { event: true } },
    });
    if (!bet) {
      throw new BetNextException(
        BetNextErrorCode.NOT_FOUND,
        HttpStatus.NOT_FOUND,
        `Pari ${betId} introuvable.`,
      );
    }
    return this.toView(bet);
  }

  private toView(bet: BetEntity): IBetView {
    const amount = Number(bet.amount);
    const lockedOdds = Number(bet.lockedOdds);
    const potentialGain = fromCents(applyOdds(toCents(amount), lockedOdds));
    let actualGain: number | null;
    switch (bet.status) {
      case BetStatus.WON:
        actualGain = potentialGain;
        break;
      case BetStatus.LOST:
        actualGain = 0;
        break;
      default:
        actualGain = null;
    }
    return {
      ...bet.toPublic(),
      eventName: bet.outcome.event.name,
      eventStatus: bet.outcome.event.status,
      outcomeLabel: bet.outcome.label,
      potentialGain,
      actualGain,
    };
  }
}
