import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { IBalance } from '@betnext/shared-types';
import { UserEntity } from './user.entity';

/** Solde d'un utilisateur (source de vérité) — domaine wallet. 1 ligne par user. */
@Entity({ name: 'balances', schema: 'betnext' })
export class BalanceEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index('balances_user_id_uq', { unique: true })
  @Column({ name: 'user_id', type: 'integer' })
  userId!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  amount!: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  toPublic(): IBalance {
    return {
      id: this.id,
      userId: this.userId,
      amount: Number(this.amount),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
