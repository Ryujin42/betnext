import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { BetStatus, TransactionType } from '@betnext/shared-types';
import { BetEntity, BetHistoryEntity, OutcomeEntity } from '@betnext/database';
import { IWalletService, WALLET_SERVICE } from '../wallet/wallet.interface';

export interface CancellationSummary {
  eSportEventId: number;
  refunded: number;
}

/**
 * Annulation des paris suite à l'annulation d'un événement
 * (BETNEXT_CONTEXT §10 : « ANNULE → Paris remboursés »).
 *
 * Déclenché par un job BullMQ `bet-cancellation` enqueué par
 * {@link BetCancellationProducer} sur réception du topic bus `event.cancelled`.
 * Pour chaque pari PENDING rattaché à l'événement :
 *   - statut → CANCELLED ;
 *   - mise remboursée via `wallet.credit` (TransactionType.REFUND) ;
 *   - trace append-only dans `bets_history`.
 *
 * Idempotent par nature : seuls les paris encore PENDING sont traités, donc un
 * rejeu du job (retry BullMQ ou réémission du bus) ne re-crédite pas.
 */
@Injectable()
export class BetCancellationService {
  private readonly logger = new Logger(BetCancellationService.name);

  constructor(
    @InjectRepository(BetEntity)
    private readonly bets: Repository<BetEntity>,
    @InjectRepository(OutcomeEntity)
    private readonly outcomes: Repository<OutcomeEntity>,
    private readonly dataSource: DataSource,
    @Inject(WALLET_SERVICE) private readonly wallet: IWalletService,
  ) {}

  async cancelForEvent(eSportEventId: number): Promise<CancellationSummary> {
    const outcomes = await this.outcomes.find({ where: { eSportEventId } });
    const outcomeIds = outcomes.map((o) => o.id);
    if (outcomeIds.length === 0) {
      return { eSportEventId, refunded: 0 };
    }

    const pending = await this.bets.find({
      where: { outcomeId: In(outcomeIds), status: BetStatus.PENDING },
    });

    if (pending.length === 0) {
      return { eSportEventId, refunded: 0 };
    }

    const refunded = await this.dataSource.transaction(async (manager) => {
      const betRepo = manager.getRepository(BetEntity);
      const histRepo = manager.getRepository(BetHistoryEntity);
      let count = 0;

      for (const bet of pending) {
        const amount = Number(bet.amount);
        const oldStatus = bet.status;
        bet.status = BetStatus.CANCELLED;
        await betRepo.save(bet);

        await this.wallet.credit(
          manager,
          bet.userId,
          amount,
          TransactionType.REFUND,
          `Remboursement pari #${bet.id} — événement annulé`,
        );

        await histRepo.save(
          histRepo.create({
            oldStatus,
            newStatus: BetStatus.CANCELLED,
            reason: 'Événement annulé — mise remboursée',
            betId: bet.id,
          }),
        );
        count += 1;
      }

      return count;
    });

    this.logger.log(`Annulation événement ${eSportEventId} : ${refunded} pari(s) remboursé(s).`);
    return { eSportEventId, refunded };
  }
}
