import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  BetNextErrorCode,
  IBalance,
  ITransaction,
  TransactionStatus,
  TransactionType,
} from '@betnext/shared-types';
import { BalanceEntity, TransactionEntity } from '@betnext/database';
import { addCents, fromCents, subtractCents, toCents } from '@betnext/shared-utils';
import { BetNextTopic, EVENT_BUS, IEventBus, PaymentMovementEvent } from '@betnext/shared-events';
import { BetNextException } from '../common/betnext.exception';
import { AccountStatusService } from '../account-status/account-status.service';
import { DepositLimitsService } from './deposit-limits.service';
import {
  IPaymentProvider,
  PAYMENT_PROVIDER,
  PaymentWebhookEvent,
} from '../payment/payment.interface';

export interface DepositResult {
  paymentIntentId: string;
  status: 'succeeded';
  balance: IBalance;
}

export interface WithdrawResult {
  transactionId: number;
  balance: IBalance;
}

/**
 * Portefeuille (T6.1/T6.3) — source de vérité du solde. **Toute** opération de
 * crédit/débit écrit obligatoirement une ligne `transactions` (traçabilité).
 * Le crédit de dépôt est idempotent sur le `stripe_id` (un webhook rejoué n'est
 * pas appliqué deux fois).
 */
@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectRepository(BalanceEntity)
    private readonly balances: Repository<BalanceEntity>,
    @InjectRepository(TransactionEntity)
    private readonly transactions: Repository<TransactionEntity>,
    private readonly dataSource: DataSource,
    private readonly depositLimits: DepositLimitsService,
    private readonly accountStatus: AccountStatusService,
    @Inject(PAYMENT_PROVIDER) private readonly payment: IPaymentProvider,
    @Inject(EVENT_BUS) private readonly bus: IEventBus,
  ) {}

  async getBalance(userId: number): Promise<IBalance> {
    const balance = await this.balances.findOne({ where: { userId } });
    if (balance) {
      return balance.toPublic();
    }
    const created = await this.balances.save(this.balances.create({ userId, amount: '0.00' }));
    return created.toPublic();
  }

  async listTransactions(userId: number): Promise<ITransaction[]> {
    const rows = await this.transactions.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((t) => t.toPublic());
  }

  /** T6.3 — dépôt : limites RG → PaymentIntent (mock) → crédit sur webhook. */
  async deposit(userId: number, amount: number): Promise<DepositResult> {
    await this.accountStatus.assertCanAct(userId);
    await this.depositLimits.assertCanDeposit(userId, amount);
    const intent = await this.payment.createPaymentIntent({ amount, userId });
    const event = await this.payment.confirmPayment(intent.id);
    const { balance } = await this.applyDepositEvent(event);
    return { paymentIntentId: intent.id, status: 'succeeded', balance };
  }

  /**
   * Applique un webhook de paiement. Crédit idempotent : si une transaction
   * porte déjà ce `paymentIntentId`, on n'applique rien (rejeu ignoré).
   */
  async applyDepositEvent(
    event: PaymentWebhookEvent,
  ): Promise<{ balance: IBalance; credited: boolean }> {
    if (event.type !== 'payment_intent.succeeded') {
      this.logger.warn(`Webhook ignoré (type=${event.type}) intent=${event.paymentIntentId}`);
      return { balance: await this.getBalance(event.userId), credited: false };
    }

    const outcome = await this.dataSource.transaction(async (manager) => {
      const txRepo = manager.getRepository(TransactionEntity);
      const existing = await txRepo.findOne({ where: { stripeId: event.paymentIntentId } });
      if (existing) {
        return { balance: await this.readBalance(manager, event.userId), credited: false, txId: 0 };
      }
      const txId = await this.creditWithin(
        manager,
        event.userId,
        event.amount,
        TransactionType.DEPOSIT,
        'Dépôt par carte (mock)',
        event.paymentIntentId,
      );
      return { balance: await this.readBalance(manager, event.userId), credited: true, txId };
    });

    if (outcome.credited) {
      await this.publishMovement(
        BetNextTopic.PaymentDeposited,
        event.userId,
        event.amount,
        outcome.txId,
      );
    } else {
      this.logger.log(`Dépôt déjà traité (idempotent) intent=${event.paymentIntentId}`);
    }
    return { balance: outcome.balance, credited: outcome.credited };
  }

  /** T6.3 — retrait : vérifie le solde, transaction PENDING → COMPLETED, débit. */
  async withdraw(userId: number, amount: number): Promise<WithdrawResult> {
    await this.accountStatus.assertCanAct(userId);
    const result = await this.dataSource.transaction(async (manager) => {
      const balanceRepo = manager.getRepository(BalanceEntity);
      const txRepo = manager.getRepository(TransactionEntity);

      const balance = await balanceRepo.findOne({
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });
      const currentCents = balance ? toCents(Number(balance.amount)) : 0;
      if (toCents(amount) > currentCents) {
        throw new BetNextException(
          BetNextErrorCode.INSUFFICIENT_FUNDS,
          HttpStatus.UNPROCESSABLE_ENTITY,
          'Solde insuffisant pour ce retrait.',
          { balance: fromCents(currentCents), requested: amount },
        );
      }

      const tx = await txRepo.save(
        txRepo.create({
          userId,
          type: TransactionType.WITHDRAWAL,
          status: TransactionStatus.PENDING,
          amount: amount.toFixed(2),
          description: 'Retrait',
          stripeId: null,
        }),
      );

      if (balance) {
        balance.amount = fromCents(subtractCents(currentCents, toCents(amount))).toFixed(2);
        await balanceRepo.save(balance);
      }

      tx.status = TransactionStatus.COMPLETED;
      await txRepo.save(tx);

      return { transactionId: tx.id, balance: await this.readBalance(manager, userId) };
    });

    await this.publishMovement(BetNextTopic.PaymentWithdrawn, userId, amount, result.transactionId);
    return result;
  }

  /** Crédite le solde dans la transaction donnée et trace la ligne. Renvoie l'id de transaction. */
  private async creditWithin(
    manager: EntityManager,
    userId: number,
    amount: number,
    type: TransactionType,
    description: string,
    stripeId: string | null,
  ): Promise<number> {
    const balanceRepo = manager.getRepository(BalanceEntity);
    const balance = await balanceRepo.findOne({
      where: { userId },
      lock: { mode: 'pessimistic_write' },
    });
    const currentCents = balance ? toCents(Number(balance.amount)) : 0;
    const nextAmount = fromCents(addCents(currentCents, toCents(amount))).toFixed(2);
    if (balance) {
      balance.amount = nextAmount;
      await balanceRepo.save(balance);
    } else {
      await balanceRepo.save(balanceRepo.create({ userId, amount: nextAmount }));
    }
    return this.record(manager, userId, amount, type, description, stripeId);
  }

  /** Écrit la trace comptable obligatoire (T6.1). Renvoie l'id créé. */
  private async record(
    manager: EntityManager,
    userId: number,
    amount: number,
    type: TransactionType,
    description: string,
    stripeId: string | null,
  ): Promise<number> {
    const txRepo = manager.getRepository(TransactionEntity);
    const tx = await txRepo.save(
      txRepo.create({
        userId,
        type,
        status: TransactionStatus.COMPLETED,
        amount: amount.toFixed(2),
        description,
        stripeId,
      }),
    );
    return tx.id;
  }

  private async readBalance(manager: EntityManager, userId: number): Promise<IBalance> {
    const balance = await manager.getRepository(BalanceEntity).findOne({ where: { userId } });
    return balance?.toPublic() ?? { id: 0, userId, amount: 0, updatedAt: new Date().toISOString() };
  }

  private async publishMovement(
    topic: string,
    userId: number,
    amount: number,
    transactionId: number,
  ): Promise<void> {
    await this.bus.publish<PaymentMovementEvent>(topic, {
      userId,
      amount,
      transactionId,
      occurredAt: new Date().toISOString(),
    });
  }
}
