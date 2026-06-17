import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Not, Repository } from 'typeorm';
import { BetNextErrorCode, BetStatus } from '@betnext/shared-types';
import { BetEntity } from '@betnext/database';
import { addCents, toCents } from '@betnext/shared-utils';
import { BetNextException } from '../common/betnext.exception';
import { IResponsibleGaming } from './responsible-gaming.interface';

/** Plafonds de mise par défaut (€) tant que les limites par user n'existent pas (Lot 7). */
const DEFAULT_DAILY_BET_LIMIT = 500;
const DEFAULT_WEEKLY_BET_LIMIT = 2000;

/**
 * Contrôle des limites de mise (T5.1). Cumule les mises non annulées du jour
 * (depuis minuit) et des 7 derniers jours, et refuse si la nouvelle mise ferait
 * dépasser le plafond correspondant.
 */
@Injectable()
export class BasicResponsibleGamingService implements IResponsibleGaming {
  private readonly dailyLimit: number;
  private readonly weeklyLimit: number;

  constructor(
    @InjectRepository(BetEntity)
    private readonly bets: Repository<BetEntity>,
    config: ConfigService,
  ) {
    this.dailyLimit = Number(config.get<string>('RG_DAILY_BET_LIMIT') ?? DEFAULT_DAILY_BET_LIMIT);
    this.weeklyLimit = Number(
      config.get<string>('RG_WEEKLY_BET_LIMIT') ?? DEFAULT_WEEKLY_BET_LIMIT,
    );
  }

  async assertCanBet(userId: number, stake: number): Promise<void> {
    const now = new Date();

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const dailyTotal = await this.stakedSince(userId, startOfDay);
    if (this.exceeds(dailyTotal, stake, this.dailyLimit)) {
      throw new BetNextException(
        BetNextErrorCode.DAILY_LIMIT_REACHED,
        HttpStatus.UNPROCESSABLE_ENTITY,
        'Limite de mise journalière atteinte.',
        { limit: this.dailyLimit, alreadyStaked: dailyTotal, attempted: stake },
      );
    }

    const startOfWeek = new Date(now.getTime() - 7 * 24 * 3_600_000);
    const weeklyTotal = await this.stakedSince(userId, startOfWeek);
    if (this.exceeds(weeklyTotal, stake, this.weeklyLimit)) {
      throw new BetNextException(
        BetNextErrorCode.WEEKLY_LIMIT_REACHED,
        HttpStatus.UNPROCESSABLE_ENTITY,
        'Limite de mise hebdomadaire atteinte.',
        { limit: this.weeklyLimit, alreadyStaked: weeklyTotal, attempted: stake },
      );
    }
  }

  /** Somme (€) des mises non annulées du user depuis `since`. */
  private async stakedSince(userId: number, since: Date): Promise<number> {
    const rows = await this.bets.find({
      where: {
        userId,
        status: Not(BetStatus.CANCELLED),
        createdAt: MoreThanOrEqual(since),
      },
    });
    const totalCents = rows.reduce((sum, bet) => addCents(sum, toCents(Number(bet.amount))), 0);
    return totalCents / 100;
  }

  private exceeds(already: number, stake: number, limit: number): boolean {
    return toCents(already) + toCents(stake) > toCents(limit);
  }
}
