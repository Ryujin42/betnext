import 'reflect-metadata';
import { BalanceEntity, TransactionEntity } from '@betnext/database';
import { BetNextErrorCode, TransactionType } from '@betnext/shared-types';
import { WalletService } from './wallet.service';
import { MockStripeProvider } from '../payment/mock-stripe.provider';
import { BetNextException } from '../common/betnext.exception';

interface TxRow {
  id: number;
  userId: number;
  type: string;
  status: string;
  amount: string;
  description: string | null;
  stripeId: string | null;
}

/** Petit faux dépôt de données en mémoire pour balances + transactions. */
function setup(initialBalance = 100) {
  const balanceStore = new Map<number, { id: number; userId: number; amount: string }>();
  balanceStore.set(3, { id: 1, userId: 3, amount: initialBalance.toFixed(2) });
  const txStore: TxRow[] = [];
  let txSeq = 0;

  const balanceRepo = {
    findOne: jest.fn(async ({ where: { userId } }: { where: { userId: number } }) => {
      const b = balanceStore.get(userId);
      return b
        ? { ...b, toPublic: () => ({ ...b, amount: Number(b.amount), updatedAt: '' }) }
        : null;
    }),
    create: jest.fn((b: { userId: number; amount: string }) => ({ id: ++txSeq, ...b })),
    save: jest.fn(async (b: { userId: number; amount: string; id?: number }) => {
      const row = { id: b.id ?? 1, userId: b.userId, amount: b.amount };
      balanceStore.set(b.userId, row);
      return { ...row, toPublic: () => ({ ...row, amount: Number(row.amount), updatedAt: '' }) };
    }),
  };
  const txRepo = {
    findOne: jest.fn(async ({ where: { stripeId } }: { where: { stripeId: string } }) => {
      return txStore.find((t) => t.stripeId === stripeId) ?? null;
    }),
    create: jest.fn((t: Omit<TxRow, 'id'>) => t),
    save: jest.fn(async (t: Omit<TxRow, 'id'> & { id?: number }) => {
      const row: TxRow = { ...t, id: t.id ?? ++txSeq };
      const idx = txStore.findIndex((x) => x.id === row.id);
      if (idx >= 0) txStore[idx] = row;
      else txStore.push(row);
      return row;
    }),
  };
  const manager = {
    getRepository: jest.fn((entity: unknown) =>
      entity === BalanceEntity ? balanceRepo : entity === TransactionEntity ? txRepo : null,
    ),
  };
  const dataSource = {
    transaction: jest.fn(async (cb: (m: typeof manager) => unknown) => cb(manager)),
  };
  const depositLimits = { assertCanDeposit: jest.fn().mockResolvedValue(undefined) };
  const bus = { publish: jest.fn(), subscribe: jest.fn() };
  const payment = new MockStripeProvider();

  const service = new WalletService(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    balanceRepo as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    txRepo as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dataSource as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    depositLimits as any,
    payment,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bus as any,
  );
  return { service, balanceStore, txStore, bus, depositLimits };
}

describe('WalletService (Lot 6)', () => {
  it('dépôt : crédite le solde et trace une transaction DEPOSIT', async () => {
    const { service, balanceStore, txStore, bus } = setup(100);
    const res = await service.deposit(3, 50);
    expect(res.status).toBe('succeeded');
    expect(balanceStore.get(3)?.amount).toBe('150.00');
    expect(txStore.filter((t) => t.type === TransactionType.DEPOSIT)).toHaveLength(1);
    expect(bus.publish).toHaveBeenCalledWith(
      'payment.deposited',
      expect.objectContaining({ userId: 3 }),
    );
  });

  it('webhook rejoué = idempotent (pas de double crédit)', async () => {
    const { service, balanceStore, txStore } = setup(100);
    const event = {
      id: 'evt_1',
      type: 'payment_intent.succeeded' as const,
      paymentIntentId: 'pi_dup',
      amount: 40,
      userId: 3,
    };
    const first = await service.applyDepositEvent(event);
    const second = await service.applyDepositEvent(event); // rejeu

    expect(first.credited).toBe(true);
    expect(second.credited).toBe(false);
    expect(balanceStore.get(3)?.amount).toBe('140.00'); // crédité une seule fois
    expect(txStore.filter((t) => t.stripeId === 'pi_dup')).toHaveLength(1);
  });

  it('retrait : débite le solde et trace une transaction WITHDRAWAL', async () => {
    const { service, balanceStore, txStore, bus } = setup(100);
    const res = await service.withdraw(3, 30);
    expect(balanceStore.get(3)?.amount).toBe('70.00');
    expect(txStore.find((t) => t.id === res.transactionId)?.type).toBe(TransactionType.WITHDRAWAL);
    expect(bus.publish).toHaveBeenCalledWith(
      'payment.withdrawn',
      expect.objectContaining({ userId: 3 }),
    );
  });

  it('retrait refusé si solde insuffisant (INSUFFICIENT_FUNDS)', async () => {
    const { service } = setup(20);
    await expect(service.withdraw(3, 100)).rejects.toMatchObject({
      errorCode: BetNextErrorCode.INSUFFICIENT_FUNDS,
    });
  });

  it('dépôt refusé si limite RG atteinte (pas de crédit)', async () => {
    const { service, balanceStore, depositLimits } = setup(100);
    depositLimits.assertCanDeposit.mockRejectedValue(
      new BetNextException(BetNextErrorCode.DEPOSIT_LIMIT_REACHED, 422, 'limite'),
    );
    await expect(service.deposit(3, 50)).rejects.toMatchObject({
      errorCode: BetNextErrorCode.DEPOSIT_LIMIT_REACHED,
    });
    expect(balanceStore.get(3)?.amount).toBe('100.00');
  });

  /*
   * T6.1 — consommateurs `bet.placed` / `bet.won`. Inactifs au Lot 6 (bus
   * in-memory mono-processus, le betting-service reste l'auteur du débit
   * synchrone), mais déjà couverts ici pour le passage au bus Redis du Lot 7.
   */
  it('debitForBet : débite le solde et trace une transaction BET (idempotente)', async () => {
    const { service, balanceStore, txStore } = setup(100);
    await service.debitForBet(42, 3, 30);
    await service.debitForBet(42, 3, 30); // rejeu : référence bet:42:placed déjà tracée
    expect(balanceStore.get(3)?.amount).toBe('70.00');
    expect(txStore.filter((t) => t.stripeId === 'bet:42:placed')).toHaveLength(1);
    expect(txStore.filter((t) => t.type === TransactionType.BET)).toHaveLength(1);
  });

  it('debitForBet : solde insuffisant → ne débite pas et ne trace rien', async () => {
    const { service, balanceStore, txStore } = setup(10);
    await service.debitForBet(99, 3, 50);
    expect(balanceStore.get(3)?.amount).toBe('10.00');
    expect(txStore.filter((t) => t.stripeId === 'bet:99:placed')).toHaveLength(0);
  });

  it('creditForWin : crédite le solde et trace une transaction WIN (idempotente)', async () => {
    const { service, balanceStore, txStore } = setup(100);
    await service.creditForWin(7, 3, 80);
    await service.creditForWin(7, 3, 80); // rejeu : référence bet:7:won déjà tracée
    expect(balanceStore.get(3)?.amount).toBe('180.00');
    expect(txStore.filter((t) => t.stripeId === 'bet:7:won')).toHaveLength(1);
    expect(txStore.filter((t) => t.type === TransactionType.WIN)).toHaveLength(1);
  });
});
