import 'reflect-metadata';
import { BetNextErrorCode } from '@betnext/shared-types';
import { DepositLimitsService } from './deposit-limits.service';
import { BetNextException } from '../common/betnext.exception';

const config = { get: jest.fn().mockReturnValue(undefined) }; // → défauts 1000 / 5000

function makeService(
  daily: Array<{ amount: string }>,
  weekly: Array<{ amount: string }>,
  rgProfile: { dailyDepositLimit: string | null; weeklyDepositLimit: string | null } | null = null,
) {
  const repo = {
    find: jest.fn().mockResolvedValueOnce(daily).mockResolvedValueOnce(weekly),
  };
  const rgRepo = { findOne: jest.fn().mockResolvedValue(rgProfile) };
  return new DepositLimitsService(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    repo as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rgRepo as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config as any,
  );
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

  // T7.2 — limite individuelle plus stricte que le défaut plateforme.
  it('applique la limite RG individuelle de dépôt (préséance sur les défauts)', async () => {
    const svc = makeService(
      [{ amount: '180.00' }],
      [],
      { dailyDepositLimit: '200.00', weeklyDepositLimit: null }, // 180 + 100 > 200
    );
    await expect(svc.assertCanDeposit(3, 100)).rejects.toMatchObject({
      errorCode: BetNextErrorCode.DEPOSIT_LIMIT_REACHED,
    });
  });
});
