import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BetNextErrorCode, type IRgProfile } from '@betnext/shared-types';
import { RgProfileEntity } from '@betnext/database';
import {
  BetNextTopic,
  EVENT_BUS,
  type IEventBus,
  type RgLimitUpdatedEvent,
  type RgSelfExcludedEvent,
} from '@betnext/shared-events';
import { BetNextException } from '../common/exceptions/betnext.exception';
import { UpdateRgLimitsDto } from './dto/update-limits.dto';
import { SelfExcludeDto } from './dto/self-exclude.dto';

/** Délai d'effet pour les augmentations de limites (règle ARJEL des 48h). */
const LIMIT_INCREASE_DELAY_MS = 48 * 60 * 60 * 1000;

/** Quatre limites RG gérées par cette interface — clés alignées sur l'entité. */
type LimitKey = 'dailyBetLimit' | 'weeklyBetLimit' | 'dailyDepositLimit' | 'weeklyDepositLimit';

const LIMIT_KEYS: ReadonlyArray<LimitKey> = [
  'dailyBetLimit',
  'weeklyBetLimit',
  'dailyDepositLimit',
  'weeklyDepositLimit',
];

type PendingKey =
  | 'pendingDailyBetLimit'
  | 'pendingWeeklyBetLimit'
  | 'pendingDailyDepositLimit'
  | 'pendingWeeklyDepositLimit';

const PENDING_COLUMN: Record<LimitKey, PendingKey> = {
  dailyBetLimit: 'pendingDailyBetLimit',
  weeklyBetLimit: 'pendingWeeklyBetLimit',
  dailyDepositLimit: 'pendingDailyDepositLimit',
  weeklyDepositLimit: 'pendingWeeklyDepositLimit',
};

/**
 * Profil jeu responsable (T7.2). Source de vérité des limites par utilisateur
 * et de l'auto-exclusion.
 *
 * Règles ARJEL :
 * - **Baisse / retrait d'une limite** = immédiat.
 * - **Hausse d'une limite (ou retrait de limite quand il y en avait une)** =
 *   effet **après 48h** : la nouvelle valeur est stockée dans la colonne
 *   `pending_*`. À chaque `getOrCreateForUser()`, si `pending_effective_at`
 *   est dépassé, la nouvelle valeur est promue.
 * - **Auto-exclusion** : pose `self_excluded_until`. Pendant ce délai, la
 *   connexion est refusée par {@link AuthService}. Une auto-exclusion active
 *   ne peut être ni raccourcie ni levée — toute nouvelle exclusion ne peut
 *   qu'allonger la date.
 *
 * Les limites individuelles ont préséance sur les plafonds plateforme
 * (`RG_*_LIMIT` env) ; un `null` signifie « pas de limite individuelle, on
 * retombe sur le plafond plateforme ».
 */
@Injectable()
export class RgProfilesService {
  private readonly logger = new Logger(RgProfilesService.name);

  constructor(
    @InjectRepository(RgProfileEntity)
    private readonly profiles: Repository<RgProfileEntity>,
    @Inject(EVENT_BUS) private readonly bus: IEventBus,
  ) {}

  /** Renvoie la vue publique (limites courantes après promotion éventuelle). */
  async getProfile(userId: number): Promise<IRgProfile> {
    const profile = await this.getOrCreateForUser(userId);
    return profile.toPublic();
  }

  /** Charge un profil, le crée si absent, promeut les pending échus. */
  async getOrCreateForUser(userId: number): Promise<RgProfileEntity> {
    let profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) {
      profile = await this.profiles.save(
        this.profiles.create({
          userId,
          dailyBetLimit: null,
          weeklyBetLimit: null,
          dailyDepositLimit: null,
          weeklyDepositLimit: null,
          pendingDailyBetLimit: null,
          pendingWeeklyBetLimit: null,
          pendingDailyDepositLimit: null,
          pendingWeeklyDepositLimit: null,
          pendingEffectiveAt: null,
          selfExcludedUntil: null,
          limitUpdatedAt: null,
        }),
      );
    }
    return this.promoteIfDue(profile);
  }

  /**
   * Met à jour les limites. Baisse → écrite directement (effet immédiat).
   * Hausse / retrait → mise en `pending_*` avec `pending_effective_at = +48h`.
   * Lève `LIMIT_INCREASE_PENDING` si une hausse précédente est encore en
   * attente sur l'une des limites concernées.
   */
  async updateLimits(userId: number, dto: UpdateRgLimitsDto): Promise<IRgProfile> {
    const profile = await this.getOrCreateForUser(userId);
    const now = new Date();

    let immediateChange = false;
    let pendingChange = false;

    for (const key of LIMIT_KEYS) {
      if (!(key in dto)) {
        continue;
      }
      const requested = dto[key] as number | null | undefined;
      if (requested === undefined) {
        continue;
      }
      const current = profile[key] !== null ? Number(profile[key]) : null;
      const isLooser = this.isLooser(current, requested);

      if (!isLooser) {
        // Baisse stricte → effet immédiat. Annule tout pending sur la même limite.
        profile[key] = requested !== null ? requested.toFixed(2) : null;
        profile[PENDING_COLUMN[key]] = null;
        immediateChange = true;
        continue;
      }

      // Hausse / retrait : pending 48h. Refuse si une hausse est déjà en attente.
      if (profile[PENDING_COLUMN[key]] !== null) {
        throw new BetNextException(
          BetNextErrorCode.LIMIT_INCREASE_PENDING,
          HttpStatus.CONFLICT,
          `Une augmentation de ${key} est déjà en attente — patientez 48h avant d'en demander une nouvelle.`,
        );
      }
      profile[PENDING_COLUMN[key]] = requested !== null ? requested.toFixed(2) : null;
      pendingChange = true;
    }

    if (!immediateChange && !pendingChange) {
      return profile.toPublic();
    }

    if (pendingChange) {
      profile.pendingEffectiveAt = new Date(now.getTime() + LIMIT_INCREASE_DELAY_MS);
    }
    profile.limitUpdatedAt = now;
    const saved = await this.profiles.save(profile);

    const effect: RgLimitUpdatedEvent['effect'] = pendingChange ? 'pending' : 'immediate';
    const effectiveAt = pendingChange ? (saved.pendingEffectiveAt ?? now) : now;
    await this.bus.publish<RgLimitUpdatedEvent>(BetNextTopic.RgLimitUpdated, {
      userId,
      effect,
      effectiveAt: effectiveAt.toISOString(),
      occurredAt: now.toISOString(),
    });

    this.logger.log(
      `Limites RG user ${userId} mises à jour (effet=${effect}, effectif=${effectiveAt.toISOString()}).`,
    );
    return saved.toPublic();
  }

  /**
   * Active l'auto-exclusion. Si une auto-exclusion est déjà en cours, la
   * nouvelle date ne peut que l'allonger — jamais la réduire.
   */
  async selfExclude(userId: number, dto: SelfExcludeDto): Promise<IRgProfile> {
    const profile = await this.getOrCreateForUser(userId);
    const now = new Date();
    const newUntil = new Date(now.getTime() + dto.durationDays * 24 * 60 * 60 * 1000);

    if (profile.selfExcludedUntil && profile.selfExcludedUntil.getTime() > now.getTime()) {
      if (newUntil.getTime() <= profile.selfExcludedUntil.getTime()) {
        // Auto-exclusion déjà active, on ne peut pas la raccourcir.
        return profile.toPublic();
      }
    }

    profile.selfExcludedUntil = newUntil;
    const saved = await this.profiles.save(profile);

    await this.bus.publish<RgSelfExcludedEvent>(BetNextTopic.RgSelfExcluded, {
      userId,
      selfExcludedUntil: newUntil.toISOString(),
      occurredAt: now.toISOString(),
    });

    this.logger.log(`Auto-exclusion user ${userId} jusqu'au ${newUntil.toISOString()}.`);
    return saved.toPublic();
  }

  /**
   * Indique si l'utilisateur est actuellement auto-exclu (date dans le futur).
   * Utilisé par l'AuthService pour bloquer la connexion.
   */
  async isSelfExcluded(userId: number): Promise<{ excluded: boolean; until: Date | null }> {
    const profile = await this.profiles.findOne({ where: { userId } });
    if (!profile || !profile.selfExcludedUntil) {
      return { excluded: false, until: null };
    }
    const until = profile.selfExcludedUntil;
    const excluded = until.getTime() > Date.now();
    return { excluded, until: excluded ? until : null };
  }

  /**
   * Si `pending_effective_at` est dépassé, promeut les pending_* en valeurs
   * courantes et persiste. Idempotent.
   */
  private async promoteIfDue(profile: RgProfileEntity): Promise<RgProfileEntity> {
    if (!profile.pendingEffectiveAt || profile.pendingEffectiveAt.getTime() > Date.now()) {
      return profile;
    }
    let changed = false;
    for (const key of LIMIT_KEYS) {
      const pendingCol = PENDING_COLUMN[key];
      const pendingValue = profile[pendingCol];
      if (pendingValue !== null) {
        profile[key] = pendingValue;
        profile[pendingCol] = null;
        changed = true;
      }
    }
    profile.pendingEffectiveAt = null;
    if (changed) {
      profile.limitUpdatedAt = new Date();
      return this.profiles.save(profile);
    }
    return profile;
  }

  /**
   * Une nouvelle limite `next` est plus laxiste (= hausse) que la limite
   * `current` si elle augmente le plafond ou supprime une contrainte.
   * `null` = absence de plafond → plus laxiste que toute valeur définie.
   */
  private isLooser(current: number | null, next: number | null): boolean {
    if (next === null) {
      return current !== null;
    }
    if (current === null) {
      return false;
    }
    return next > current;
  }
}
