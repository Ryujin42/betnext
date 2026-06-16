import { HttpStatus } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { Repository } from 'typeorm';
import { BetNextErrorCode, Role } from '@betnext/shared-types';
import { BetNextException } from '../common/exceptions/betnext.exception';
import { UserEntity } from '../entities/user.entity';
import { AuthService } from './auth.service';
import type { RegisterDto } from './dto/register.dto';

/** Date `YYYY-MM-DD` correspondant à `now - yearsAgo`. */
function yearsAgo(yearsAgo: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - yearsAgo);
  return d.toISOString().slice(0, 10);
}

interface RepoMock {
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
}

function makeRepo(): RepoMock {
  return {
    findOne: jest.fn(),
    create: jest.fn((data: Partial<UserEntity>) => Object.assign(new UserEntity(), data)),
    save: jest.fn(async (entity: UserEntity) =>
      Object.assign(entity, { id: 42, createdAt: new Date('2026-01-01T00:00:00Z') }),
    ),
  };
}

function baseDto(overrides: Partial<RegisterDto> = {}): RegisterDto {
  return {
    name: 'Alice',
    email: 'alice@betnext.gg',
    password: 'StrongPassw0rd!',
    birthDate: yearsAgo(25),
    acceptTos: true,
    ...overrides,
  };
}

describe('AuthService.register', () => {
  let repo: RepoMock;
  let service: AuthService;

  beforeEach(() => {
    repo = makeRepo();
    service = new AuthService(repo as unknown as Repository<UserEntity>);
  });

  it('refuse les < 18 ans avec UNDERAGE (403) et ne touche pas la base', async () => {
    const dto = baseDto({ birthDate: yearsAgo(17) });

    await expect(service.register(dto)).rejects.toBeInstanceOf(BetNextException);
    await expect(service.register(dto)).rejects.toMatchObject({
      errorCode: BetNextErrorCode.UNDERAGE,
      status: HttpStatus.FORBIDDEN,
    });
    expect(repo.findOne).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('refuse un email déjà utilisé (409)', async () => {
    repo.findOne.mockResolvedValueOnce({ id: 1, email: 'alice@betnext.gg' });

    await expect(service.register(baseDto())).rejects.toMatchObject({
      errorCode: BetNextErrorCode.VALIDATION_ERROR,
      status: HttpStatus.CONFLICT,
    });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('crée un user majeur avec un hash Argon2id vérifiable et un rôle ROLE_USER', async () => {
    repo.findOne.mockResolvedValueOnce(null);

    const result = await service.register(baseDto());

    expect(repo.save).toHaveBeenCalledTimes(1);
    const persisted = repo.save.mock.calls[0][0] as UserEntity;
    expect(persisted.role).toBe(Role.USER);
    expect(persisted.email).toBe('alice@betnext.gg');
    expect(persisted.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await argon2.verify(persisted.passwordHash, 'StrongPassw0rd!')).toBe(true);

    expect(result).toMatchObject({
      id: 42,
      name: 'Alice',
      email: 'alice@betnext.gg',
      role: Role.USER,
    });
    // Confirme qu'on n'expose JAMAIS le hash dans la projection publique.
    expect(result).not.toHaveProperty('passwordHash');
  });

  it("normalise l'email (trim + lowercase) avant la vérification d'unicité", async () => {
    repo.findOne.mockResolvedValueOnce(null);

    await service.register(baseDto({ email: '  Alice@BETNEXT.gg ' }));

    expect(repo.findOne).toHaveBeenCalledWith({ where: { email: 'alice@betnext.gg' } });
    const persisted = repo.save.mock.calls[0][0] as UserEntity;
    expect(persisted.email).toBe('alice@betnext.gg');
  });
});
