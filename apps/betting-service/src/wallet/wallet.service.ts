import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { BetNextErrorCode, TransactionStatus, TransactionType } from '@betnext/shared-types';
import { BalanceEntity, TransactionEntity } from '@betnext/database';
import { addCents, fromCents, subtractCents, toCents } from '@betnext/shared-utils';
import { BetNextException } from '../common/betnext.exception';
import { IWalletService } from './wallet.interface';

/**
 * Implémentation locale du portefeuille (Lot 5) : lit/écrit directement les
 * tables `balances` et `transactions` (schéma unique, JOIN autorisés). Toute
 * arithmétique passe par les helpers en centimes entiers (pas de flottant).
 *
 * Remplacée au Lot 6 par un appel HTTP au wallet-service derrière la même
 * interface {@link IWalletService}.
 */
@Injectable()
export class LocalWalletService implements IWalletService {
  constructor(
    @InjectRepository(BalanceEntity)
    private readonly balances: Repository<BalanceEntity>,
  ) {}

  async getBalance(userId: number): Promise<number> {
    const balance = await this.balances.findOne({ where: { userId } });
    return balance ? Number(balance.amount) : 0;
  }

  async debit(
    manager: EntityManager,
    userId: number,
    amount: number,
    description: string,
  ): Promise<void> {
    const repo = manager.getRepository(BalanceEntity);
    const balance = await repo.findOne({
      where: { userId },
      lock: { mode: 'pessimistic_write' },
    });
    const currentCents = balance ? toCents(Number(balance.amount)) : 0;
    const amountCents = toCents(amount);

    if (amountCents > currentCents) {
      throw new BetNextException(
        BetNextErrorCode.INSUFFICIENT_BALANCE,
        HttpStatus.UNPROCESSABLE_ENTITY,
        'Solde insuffisant pour placer ce pari.',
        { balance: fromCents(currentCents), required: amount },
      );
    }

    if (balance) {
      balance.amount = fromCents(subtractCents(currentCents, amountCents)).toFixed(2);
      await repo.save(balance);
    }
    await this.record(manager, userId, amount, TransactionType.BET, description);
  }

  async credit(
    manager: EntityManager,
    userId: number,
    amount: number,
    type: TransactionType,
    description: string,
  ): Promise<void> {
    const repo = manager.getRepository(BalanceEntity);
    const balance = await repo.findOne({
      where: { userId },
      lock: { mode: 'pessimistic_write' },
    });
    const currentCents = balance ? toCents(Number(balance.amount)) : 0;
    const nextAmount = fromCents(addCents(currentCents, toCents(amount))).toFixed(2);

    if (balance) {
      balance.amount = nextAmount;
      await repo.save(balance);
    } else {
      await repo.save(repo.create({ userId, amount: nextAmount }));
    }
    await this.record(manager, userId, amount, type, description);
  }

  /** Écrit la trace comptable obligatoire (cf. T6.1 — traçabilité). */
  private async record(
    manager: EntityManager,
    userId: number,
    amount: number,
    type: TransactionType,
    description: string,
  ): Promise<void> {
    const repo = manager.getRepository(TransactionEntity);
    await repo.save(
      repo.create({
        userId,
        type,
        status: TransactionStatus.COMPLETED,
        amount: amount.toFixed(2),
        description,
        stripeId: null,
      }),
    );
  }
}
