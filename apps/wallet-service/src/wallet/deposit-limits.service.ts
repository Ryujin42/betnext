import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { BetNextErrorCode, TransactionStatus, TransactionType } from '@betnext/shared-types';
import { RgProfileEntity, TransactionEntity } from '@betnext/database';
import { addCents, toCents } from '@betnext/shared-utils';
import { BetNextException } from '../common/betnext.exception';

/** Plafonds de dépôt plateforme (€) si aucun profil RG individuel n'est défini. */
const DEFAULT_DAILY_DEPOSIT_LIMIT = 1000;
const DEFAULT_WEEKLY_DEPOSIT_LIMIT = 5000;

/**
 * Contrôle des limites de dépôt jeu responsable (T6.3 / T7.2). Cumule les
 * dépôts aboutis du jour (depuis minuit) et des 7 derniers jours.
 *
 * Lot 7 — préséance des limites individuelles : si l'utilisateur a un
 * `rg_profiles.daily_deposit_limit` / `weekly_deposit_limit` défini, il
 * remplace le plafond plateforme. JOIN cross-domaines autorisé (schéma unique).
 */
@Injectable()
export class DepositLimitsService {
  private readonly platformDailyLimit: number;
  private readonly platformWeeklyLimit: number;

  constructor(
    @InjectRepository(TransactionEntity)
    private readonly transactions: Repository<TransactionEntity>,
    @InjectRepository(RgProfileEntity)
    private readonly rgProfiles: Repository<RgProfileEntity>,
    config: ConfigService,
  ) {
    this.platformDailyLimit = Number(
      config.get<string>('RG_DAILY_DEPOSIT_LIMIT') ?? DEFAULT_DAILY_DEPOSIT_LIMIT,
    );
    this.platformWeeklyLimit = Number(
      config.get<string>('RG_WEEKLY_DEPOSIT_LIMIT') ?? DEFAULT_WEEKLY_DEPOSIT_LIMIT,
    );
  }

  async assertCanDeposit(userId: number, amount: number): Promise<void> {
    const limits = await this.effectiveLimits(userId);
    const now = new Date();

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const dailyTotal = await this.depositedSince(userId, startOfDay);
    if (this.exceeds(dailyTotal, amount, limits.daily)) {
      throw this.limitError(limits.daily, dailyTotal, amount, 'journalière');
    }

    const startOfWeek = new Date(now.getTime() - 7 * 24 * 3_600_000);
    const weeklyTotal = await this.depositedSince(userId, startOfWeek);
    if (this.exceeds(weeklyTotal, amount, limits.weekly)) {
      throw this.limitError(limits.weekly, weeklyTotal, amount, 'hebdomadaire');
    }
  }

  /** Limite individuelle si définie, sinon plafond plateforme. */
  private async effectiveLimits(userId: number): Promise<{ daily: number; weekly: number }> {
    const profile = await this.rgProfiles.findOne({ where: { userId } });
    return {
      daily:
        profile?.dailyDepositLimit !== null && profile?.dailyDepositLimit !== undefined
          ? Number(profile.dailyDepositLimit)
          : this.platformDailyLimit,
      weekly:
        profile?.weeklyDepositLimit !== null && profile?.weeklyDepositLimit !== undefined
          ? Number(profile.weeklyDepositLimit)
          : this.platformWeeklyLimit,
    };
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
