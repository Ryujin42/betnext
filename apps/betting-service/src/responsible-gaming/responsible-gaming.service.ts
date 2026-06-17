import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Not, Repository } from 'typeorm';
import { BetNextErrorCode, BetStatus } from '@betnext/shared-types';
import { BetEntity, RgProfileEntity } from '@betnext/database';
import { addCents, toCents } from '@betnext/shared-utils';
import { BetNextException } from '../common/betnext.exception';
import { IResponsibleGaming } from './responsible-gaming.interface';

/** Plafonds de mise plateforme (€) si aucun profil RG individuel n'est défini. */
const DEFAULT_DAILY_BET_LIMIT = 500;
const DEFAULT_WEEKLY_BET_LIMIT = 2000;

/**
 * Contrôle des limites de mise (T5.1 / T7.2). Cumule les mises non annulées
 * du jour (depuis minuit) et des 7 derniers jours.
 *
 * Lot 7 — préséance des limites individuelles : si l'utilisateur a un
 * `rg_profiles.daily_bet_limit` / `weekly_bet_limit` défini, on l'applique ;
 * sinon on retombe sur les plafonds plateforme (`RG_*_BET_LIMIT` env). JOIN
 * cross-domaines autorisé (schéma unique).
 */
@Injectable()
export class BasicResponsibleGamingService implements IResponsibleGaming {
  private readonly platformDailyLimit: number;
  private readonly platformWeeklyLimit: number;

  constructor(
    @InjectRepository(BetEntity)
    private readonly bets: Repository<BetEntity>,
    @InjectRepository(RgProfileEntity)
    private readonly rgProfiles: Repository<RgProfileEntity>,
    config: ConfigService,
  ) {
    this.platformDailyLimit = Number(
      config.get<string>('RG_DAILY_BET_LIMIT') ?? DEFAULT_DAILY_BET_LIMIT,
    );
    this.platformWeeklyLimit = Number(
      config.get<string>('RG_WEEKLY_BET_LIMIT') ?? DEFAULT_WEEKLY_BET_LIMIT,
    );
  }

  async assertCanBet(userId: number, stake: number): Promise<void> {
    const limits = await this.effectiveLimits(userId);
    const now = new Date();

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const dailyTotal = await this.stakedSince(userId, startOfDay);
    if (this.exceeds(dailyTotal, stake, limits.daily)) {
      throw new BetNextException(
        BetNextErrorCode.DAILY_LIMIT_REACHED,
        HttpStatus.UNPROCESSABLE_ENTITY,
        'Limite de mise journalière atteinte.',
        { limit: limits.daily, alreadyStaked: dailyTotal, attempted: stake },
      );
    }

    const startOfWeek = new Date(now.getTime() - 7 * 24 * 3_600_000);
    const weeklyTotal = await this.stakedSince(userId, startOfWeek);
    if (this.exceeds(weeklyTotal, stake, limits.weekly)) {
      throw new BetNextException(
        BetNextErrorCode.WEEKLY_LIMIT_REACHED,
        HttpStatus.UNPROCESSABLE_ENTITY,
        'Limite de mise hebdomadaire atteinte.',
        { limit: limits.weekly, alreadyStaked: weeklyTotal, attempted: stake },
      );
    }
  }

  /**
   * Limite individuelle (RG profile) si définie, sinon plafond plateforme.
   * On lit la colonne **courante** (`daily_bet_limit`) et **pas** le pending :
   * une hausse en attente 48h n'a aucun effet tant que `pending_effective_at`
   * n'est pas dépassée — la promotion est faite côté user-service à chaque
   * lecture du profil.
   */
  private async effectiveLimits(userId: number): Promise<{ daily: number; weekly: number }> {
    const profile = await this.rgProfiles.findOne({ where: { userId } });
    return {
      daily:
        profile?.dailyBetLimit !== null && profile?.dailyBetLimit !== undefined
          ? Number(profile.dailyBetLimit)
          : this.platformDailyLimit,
      weekly:
        profile?.weeklyBetLimit !== null && profile?.weeklyBetLimit !== undefined
          ? Number(profile.weeklyBetLimit)
          : this.platformWeeklyLimit,
    };
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
