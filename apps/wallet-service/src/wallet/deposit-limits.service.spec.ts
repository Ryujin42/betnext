import 'reflect-metadata';
import { BetNextErrorCode } from '@betnext/shared-types';
import { DepositLimitsService } from './deposit-limits.service';
import { BetNextException } from '../common/betnext.exception';

const config = { get: jest.fn().mockReturnValue(undefined) }; // → défauts 1000 / 5000

function makeService(daily: Array<{ amount: string }>, weekly: Array<{ amount: string }>) {
  const repo = {
    find: jest.fn().mockResolvedValueOnce(daily).mockResolvedValueOnce(weekly),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new DepositLimitsService(repo as any, config as any);
}

describe('DepositLimitsService (T6.3)', () => {
  it('autorise un dépôt sous les plafonds', async () => {
    const svc = makeService([{ amount: '200.00' }], [{ amount: '200.00' }]);
    await expect(svc.assertCanDeposit(3, 100)).resolves.toBeUndefined();
  });

  it('refuse au dépassement du plafond journalier (DEPOSIT_LIMIT_REACHED)', async () => {
    const svc = makeService([{ amount: '950.00' }], []); // 950 + 100 > 1000
    await expect(svc.assertCanDeposit(3, 100)).rejects.toMatchObject({
      errorCode: BetNextErrorCode.DEPOSIT_LIMIT_REACHED,
    });
  });

  it('refuse au dépassement du plafond hebdomadaire', async () => {
    const svc = makeService([{ amount: '100.00' }], [{ amount: '4950.00' }]); // 4950 + 100 > 5000
    await expect(svc.assertCanDeposit(3, 100)).rejects.toBeInstanceOf(BetNextException);
  });
});
