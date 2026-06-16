import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BetStatus, type IBet } from '@betnext/shared-types';
import { OutcomeEntity } from './outcome.entity';
import { UserEntity } from './user.entity';

/** Pari placé par un utilisateur — domaine betting. Cote figée dans `locked_odds`. */
@Entity({ name: 'bets', schema: 'betnext' })
export class BetEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'close_date', type: 'timestamptz' })
  closeDate!: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  @Column({ name: 'locked_odds', type: 'decimal', precision: 5, scale: 2 })
  lockedOdds!: string;

  @Column({ type: 'varchar', length: 16, default: BetStatus.PENDING })
  status!: BetStatus;

  @Column({ name: 'outcome_id', type: 'integer' })
  outcomeId!: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId!: number;

  @ManyToOne(() => OutcomeEntity)
  @JoinColumn({ name: 'outcome_id' })
  outcome!: OutcomeEntity;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  toPublic(): IBet {
    return {
      id: this.id,
      title: this.title,
      createdAt: this.createdAt.toISOString(),
      closeDate: this.closeDate.toISOString(),
      amount: Number(this.amount),
      lockedOdds: Number(this.lockedOdds),
      status: this.status,
      outcomeId: this.outcomeId,
      userId: this.userId,
    };
  }
}
