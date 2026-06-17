import 'reflect-metadata';
import { BalanceEntity, TransactionEntity } from '@betnext/database';
import { TransactionType } from '@betnext/shared-types';
import { LocalWalletService } from './wallet.service';
import { BetNextException } from '../common/betnext.exception';

function makeManager(balance: { amount: string } | null) {
  const balanceRepo = {
    findOne: jest.fn().mockResolvedValue(balance),
    save: jest.fn().mockImplementation(async (b: unknown) => b),
    create: jest.fn().mockImplementation((b: unknown) => b),
  };
  const txRepo = {
    create: jest.fn().mockImplementation((t: unknown) => t),
    save: jest.fn().mockImplementation(async (t: unknown) => t),
  };
  const manager = {
    getRepository: jest.fn((entity: unknown) =>
      entity === BalanceEntity ? balanceRepo : entity === TransactionEntity ? txRepo : null,
    ),
  };
  return { manager, balanceRepo, txRepo };
}

describe('LocalWalletService', () => {
  it('getBalance renvoie le montant ou 0', async () => {
    const repo = { findOne: jest.fn().mockResolvedValue({ amount: '100.00' }) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new LocalWalletService(repo as any);
    expect(await svc.getBalance(1)).toBe(100);

    repo.findOne.mockResolvedValueOnce(null);
    expect(await svc.getBalance(1)).toBe(0);
  });

  it('debit décrémente le solde et trace une transaction BET', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new LocalWalletService({} as any);
    const { manager, balanceRepo, txRepo } = makeManager({ amount: '100.00' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await svc.debit(manager as any, 1, 30, 'Mise');

    expect(balanceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ amount: '70.00' }));
    expect(txRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: TransactionType.BET, amount: '30.00' }),
    );
  });

  it('debit refuse si solde insuffisant (INSUFFICIENT_BALANCE)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new LocalWalletService({} as any);
    const { manager, balanceRepo } = makeManager({ amount: '20.00' });

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      svc.debit(manager as any, 1, 50, 'Mise'),
    ).rejects.toBeInstanceOf(BetNextException);
    expect(balanceRepo.save).not.toHaveBeenCalled();
  });

  it('credit incrémente le solde et trace une transaction WIN', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new LocalWalletService({} as any);
    const { manager, balanceRepo, txRepo } = makeManager({ amount: '70.00' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await svc.credit(manager as any, 1, 50, TransactionType.WIN, 'Gain');

    expect(balanceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ amount: '120.00' }));
    expect(txRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: TransactionType.WIN, amount: '50.00' }),
    );
  });
});
