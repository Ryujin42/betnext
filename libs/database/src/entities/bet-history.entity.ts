import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { BetStatus, IBetHistory } from '@betnext/shared-types';
import { BetEntity } from './bet.entity';

/** Historique append-only des changements de statut d'un pari (table `bets_history`). */
@Entity({ name: 'bets_history', schema: 'betnext' })
export class BetHistoryEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'old_status', type: 'varchar', length: 16, nullable: true })
  oldStatus!: BetStatus | null;

  @Column({ name: 'new_status', type: 'varchar', length: 16 })
  newStatus!: BetStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'bet_id', type: 'integer' })
  betId!: number;

  @ManyToOne(() => BetEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bet_id' })
  bet!: BetEntity;

  toPublic(): IBetHistory {
    return {
      id: this.id,
      oldStatus: this.oldStatus,
      newStatus: this.newStatus,
      reason: this.reason,
      createdAt: this.createdAt.toISOString(),
      betId: this.betId,
    };
  }
}
