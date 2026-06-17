import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { BetNextErrorCode, TransactionStatus, TransactionType } from '@betnext/shared-types';
import { TransactionEntity } from '@betnext/database';
import { addCents, toCents } from '@betnext/shared-utils';
import { BetNextException } from '../common/betnext.exception';

/** Plafonds de dépôt par défaut (€) tant que les limites par user n'existent pas (Lot 7). */
const DEFAULT_DAILY_DEPOSIT_LIMIT = 1000;
const DEFAULT_WEEKLY_DEPOSIT_LIMIT = 5000;

/**
 * Contrôle des limites de dépôt jeu responsable (T6.3). Cumule les dépôts
 * aboutis du jour (depuis minuit) et des 7 derniers jours, et refuse si le
 * nouveau dépôt ferait dépasser le plafond → `DEPOSIT_LIMIT_REACHED`.
 */
@Injectable()
export class DepositLimitsService {
  private readonly dailyLimit: number;
  private readonly weeklyLimit: number;

  constructor(
    @InjectRepository(TransactionEntity)
    private readonly transactions: Repository<TransactionEntity>,
    config: ConfigService,
  ) {
    this.dailyLimit = Number(
      config.get<string>('RG_DAILY_DEPOSIT_LIMIT') ?? DEFAULT_DAILY_DEPOSIT_LIMIT,
    );
    this.weeklyLimit = Number(
      config.get<string>('RG_WEEKLY_DEPOSIT_LIMIT') ?? DEFAULT_WEEKLY_DEPOSIT_LIMIT,
    );
  }

  async assertCanDeposit(userId: number, amount: number): Promise<void> {
    const now = new Date();

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const dailyTotal = await this.depositedSince(userId, startOfDay);
    if (this.exceeds(dailyTotal, amount, this.dailyLimit)) {
      throw this.limitError(this.dailyLimit, dailyTotal, amount, 'journalière');
    }

    const startOfWeek = new Date(now.getTime() - 7 * 24 * 3_600_000);
    const weeklyTotal = await this.depositedSince(userId, startOfWeek);
    if (this.exceeds(weeklyTotal, amount, this.weeklyLimit)) {
      throw this.limitError(this.weeklyLimit, weeklyTotal, amount, 'hebdomadaire');
    }
  }

  private async depositedSince(userId: number, since: Date): Promise<number> {
    const rows = await this.transactions.find({
      where: {
        userId,
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.COMPLETED,
        createdAt: MoreThanOrEqual(since),
      },
    });
    const totalCents = rows.reduce((sum, tx) => addCents(sum, toCents(Number(tx.amount))), 0);
    return totalCents / 100;
  }

  private exceeds(already: number, amount: number, limit: number): boolean {
    return toCents(already) + toCents(amount) > toCents(limit);
  }

  private limitError(
    limit: number,
    already: number,
    attempted: number,
    label: string,
  ): BetNextException {
    return new BetNextException(
      BetNextErrorCode.DEPOSIT_LIMIT_REACHED,
      HttpStatus.UNPROCESSABLE_ENTITY,
      `Limite de dépôt ${label} atteinte.`,
      { limit, alreadyDeposited: already, attempted },
    );
  }
}
