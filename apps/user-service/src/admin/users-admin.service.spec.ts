import 'reflect-metadata';
import { BetNextErrorCode, Role } from '@betnext/shared-types';
import { UserEntity } from '@betnext/database';
import { UsersAdminService } from './users-admin.service';

function makeUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return Object.assign(new UserEntity(), {
    id: 7,
    name: 'Faker',
    email: 'faker@betnext.gg',
    role: Role.USER,
    birthDate: '1996-05-07',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    suspendedAt: null,
    suspendedReason: null,
    passwordHash: 'hash',
    ...overrides,
  });
}

function makeService(user: UserEntity | null) {
  const repo = {
    findOne: jest.fn().mockResolvedValue(user),
    save: jest.fn().mockImplementation(async (u: UserEntity) => u),
    createQueryBuilder: jest.fn(),
  };
  const bus = { publish: jest.fn().mockResolvedValue(undefined), subscribe: jest.fn() };
  return {
    service: new UsersAdminService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      repo as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bus as any,
    ),
    repo,
    bus,
  };
}

describe('UsersAdminService.suspend (T8.3)', () => {
  it('pose suspended_at, écrit la raison, émet `user.suspended`', async () => {
    const user = makeUser();
    const { service, repo, bus } = makeService(user);
    const before = Date.now();
    const result = await service.suspend(7, 1, 'Triche détectée');

    expect(result.suspendedAt).not.toBeNull();
    expect(new Date(result.suspendedAt ?? '').getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(result.suspendedReason).toBe('Triche détectée');
    expect(repo.save).toHaveBeenCalled();
    expect(bus.publish).toHaveBeenCalledWith(
      'user.suspended',
      expect.objectContaining({ userId: 7, adminId: 1, reason: 'Triche détectée' }),
    );
  });

  it('ne réécrase pas la date de suspension si déjà suspendu (idempotent)', async () => {
    const originalDate = new Date('2026-05-01T00:00:00Z');
    const user = makeUser({ suspendedAt: originalDate, suspendedReason: 'Initiale' });
    const { service } = makeService(user);
    const result = await service.suspend(7, 1, 'Nouvelle raison');
    expect(result.suspendedAt).toBe(originalDate.toISOString());
    expect(result.suspendedReason).toBe('Nouvelle raison');
  });

  it("lève NOT_FOUND si l'utilisateur n'existe pas", async () => {
    const { service } = makeService(null);
    await expect(service.suspend(999, 1, null)).rejects.toMatchObject({
      errorCode: BetNextErrorCode.NOT_FOUND,
    });
  });
});

describe('UsersAdminService.unsuspend (T8.3)', () => {
  it('efface suspended_at et raison, émet `user.unsuspended`', async () => {
    const user = makeUser({ suspendedAt: new Date(), suspendedReason: 'Raison' });
    const { service, bus } = makeService(user);
    const result = await service.unsuspend(7, 1);
    expect(result.suspendedAt).toBeNull();
    expect(result.suspendedReason).toBeNull();
    expect(bus.publish).toHaveBeenCalledWith(
      'user.unsuspended',
      expect.objectContaining({ userId: 7, adminId: 1 }),
    );
  });
});
