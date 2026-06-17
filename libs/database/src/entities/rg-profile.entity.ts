import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { IRgProfile } from '@betnext/shared-types';
import { UserEntity } from './user.entity';

/**
 * Profil jeu responsable (T7.2). Une ligne par utilisateur. Toutes les limites
 * sont nullables — `null` signifie « pas de limite individuelle, on retombe
 * sur les plafonds plateforme (`RG_*_LIMIT` dans l'env) ».
 *
 * - `self_excluded_until` : si défini et dans le futur, bloque la **connexion**
 *   (cf. AuthService). Non annulable avant la date — c'est la règle ARJEL.
 * - `pending_*` + `pending_effective_at` : règle des 48h des augmentations de
 *   limites. Une diminution s'applique immédiatement (écrit directement sur la
 *   colonne courante). Une augmentation passe par `pending_*` et n'est promue
 *   en colonne courante qu'à la lecture une fois `pending_effective_at`
 *   dépassée (les écritures concurrentes côté wallet/betting voient toujours
 *   l'ancienne limite, plus stricte, dans l'intervalle).
 */
@Entity({ name: 'rg_profiles', schema: 'betnext' })
export class RgProfileEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index('rg_profiles_user_id_uq', { unique: true })
  @Column({ name: 'user_id', type: 'integer' })
  userId!: number;

  @Column({ name: 'daily_bet_limit', type: 'decimal', precision: 12, scale: 2, nullable: true })
  dailyBetLimit!: string | null;

  @Column({ name: 'weekly_bet_limit', type: 'decimal', precision: 12, scale: 2, nullable: true })
  weeklyBetLimit!: string | null;

  @Column({ name: 'daily_deposit_limit', type: 'decimal', precision: 12, scale: 2, nullable: true })
  dailyDepositLimit!: string | null;

  @Column({
    name: 'weekly_deposit_limit',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  weeklyDepositLimit!: string | null;

  // Augmentations en attente (effet après 48h).
  @Column({
    name: 'pending_daily_bet_limit',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  pendingDailyBetLimit!: string | null;

  @Column({
    name: 'pending_weekly_bet_limit',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  pendingWeeklyBetLimit!: string | null;

  @Column({
    name: 'pending_daily_deposit_limit',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  pendingDailyDepositLimit!: string | null;

  @Column({
    name: 'pending_weekly_deposit_limit',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  pendingWeeklyDepositLimit!: string | null;

  @Column({ name: 'pending_effective_at', type: 'timestamptz', nullable: true })
  pendingEffectiveAt!: Date | null;

  @Column({ name: 'self_excluded_until', type: 'timestamptz', nullable: true })
  selfExcludedUntil!: Date | null;

  @Column({ name: 'limit_updated_at', type: 'timestamptz', nullable: true })
  limitUpdatedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  toPublic(): IRgProfile {
    return {
      id: this.id,
      userId: this.userId,
      dailyBetLimit: this.dailyBetLimit !== null ? Number(this.dailyBetLimit) : null,
      weeklyBetLimit: this.weeklyBetLimit !== null ? Number(this.weeklyBetLimit) : null,
      dailyDepositLimit: this.dailyDepositLimit !== null ? Number(this.dailyDepositLimit) : null,
      weeklyDepositLimit: this.weeklyDepositLimit !== null ? Number(this.weeklyDepositLimit) : null,
      selfExcludedUntil: this.selfExcludedUntil?.toISOString() ?? null,
      limitUpdatedAt: this.limitUpdatedAt?.toISOString() ?? null,
    };
  }
}
