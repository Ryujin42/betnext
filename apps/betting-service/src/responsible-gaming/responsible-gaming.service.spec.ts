import 'reflect-metadata';
import { BetNextErrorCode } from '@betnext/shared-types';
import { BasicResponsibleGamingService } from './responsible-gaming.service';
import { BetNextException } from '../common/betnext.exception';

/** ConfigService mocké : renvoie undefined → plafonds par défaut (500 / 2000). */
const config = { get: jest.fn().mockReturnValue(undefined) };

function makeService(
  dailyBets: Array<{ amount: string }>,
  weeklyBets: Array<{ amount: string }>,
  rgProfile: { dailyBetLimit: string | null; weeklyBetLimit: string | null } | null = null,
) {
  const repo = {
    find: jest
      .fn()
      .mockResolvedValueOnce(dailyBets) // 1er appel = cumul du jour
      .mockResolvedValueOnce(weeklyBets), // 2e appel = cumul de la semaine
  };
  const rgRepo = { findOne: jest.fn().mockResolvedValue(rgProfile) };
  return new BasicResponsibleGamingService(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    repo as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rgRepo as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config as any,
  );
}

describe('BasicResponsibleGamingService (T5.1)', () => {
  it('autorise une mise sous les plafonds', async () => {
    const svc = makeService([{ amount: '100.00' }], [{ amount: '100.00' }]);
    await expect(svc.assertCanBet(1, 50)).resolves.toBeUndefined();
  });

  it('refuse au dépassement de la limite journalière', async () => {
    const svc = makeService([{ amount: '480.00' }], []); // 480 + 50 > 500
    await expect(svc.assertCanBet(1, 50)).rejects.toMatchObject({
      errorCode: BetNextErrorCode.DAILY_LIMIT_REACHED,
    });
  });

  it('refuse au dépassement de la limite hebdomadaire', async () => {
    // Jour OK (100 + 50 < 500), semaine KO (1980 + 50 > 2000).
    const svc = makeService([{ amount: '100.00' }], [{ amount: '1980.00' }]);
    await expect(svc.assertCanBet(1, 50)).rejects.toBeInstanceOf(BetNextException);
  });

  // T7.2 — limite individuelle plus stricte que la plateforme : le user est
  // capé sur SA limite, pas celle par défaut.
  it('applique la limite RG individuelle (préséance sur les défauts plateforme)', async () => {
    const svc = makeService(
      [{ amount: '90.00' }],
      [],
      { dailyBetLimit: '100.00', weeklyBetLimit: null }, // 90 + 50 > 100
    );
    await expect(svc.assertCanBet(1, 50)).rejects.toMatchObject({
      errorCode: BetNextErrorCode.DAILY_LIMIT_REACHED,
      details: expect.objectContaining({ limit: 100 }),
    });
  });
});
