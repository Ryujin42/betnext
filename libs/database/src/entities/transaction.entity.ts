import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TransactionStatus, type TransactionType, type ITransaction } from '@betnext/shared-types';
import { UserEntity } from './user.entity';

/** Mouvement de portefeuille — domaine wallet. `stripe_id` unique = idempotence. */
@Entity({ name: 'transactions', schema: 'betnext' })
export class TransactionEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId!: number;

  @Column({ type: 'varchar', length: 16 })
  type!: TransactionType;

  @Column({ type: 'varchar', length: 16, default: TransactionStatus.COMPLETED })
  status!: TransactionStatus;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description!: string | null;

  @Index('transactions_stripe_id_uq', { unique: true })
  @Column({ name: 'stripe_id', type: 'varchar', length: 255, nullable: true })
  stripeId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  toPublic(): ITransaction {
    return {
      id: this.id,
      userId: this.userId,
      type: this.type,
      status: this.status,
      amount: Number(this.amount),
      description: this.description,
      stripeId: this.stripeId,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
