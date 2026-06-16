import { HttpStatus } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { Repository } from 'typeorm';
import { BetNextErrorCode, Role } from '@betnext/shared-types';
import { SessionEntity, UserEntity } from '@betnext/database';
import { AuthService } from './auth.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { SessionContext, TokensService } from './tokens.service';

const CTX: SessionContext = { ip: '127.0.0.1', userAgent: 'jest', device: null };

function yearsAgo(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

function makeUserRepo(): jest.Mocked<Repository<UserEntity>> {
  return {
    findOne: jest.fn(),
    create: jest.fn((data: Partial<UserEntity>) => Object.assign(new UserEntity(), data)),
    save: jest.fn(async (entity: UserEntity) =>
      Object.assign(entity, { id: 42, createdAt: new Date('2026-01-01T00:00:00Z') }),
    ),
  } as unknown as jest.Mocked<Repository<UserEntity>>;
}

function makeTokens(): jest.Mocked<TokensService> {
  return {
    signAccessToken: jest.fn().mockReturnValue({ token: 'acc.JWT.dummy', expiresIn: 300 }),
    issueSession: jest.fn(async ({ familyId }: { familyId?: string }) => ({
      refreshToken: 'refresh-clear-text',
      session: {
        id: 1,
        familyId: familyId ?? 'new-family',
        expiresAt: new Date('2030-01-01T00:00:00Z'),
      } as SessionEntity,
    })),
    findSessionByToken: jest.fn(),
    revokeSession: jest.fn(),
    revokeFamily: jest.fn(),
    hashRefreshToken: jest.fn((t: string) => `sha256(${t})`),
  } as unknown as jest.Mocked<TokensService>;
}

async function makeRealUser(plainPassword: string): Promise<UserEntity> {
  const user = Object.assign(new UserEntity(), {
    id: 42,
    name: 'Alice',
    email: 'alice@betnext.gg',
    role: Role.USER,
    birthDate: '1990-01-01',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    passwordHash: await argon2.hash(plainPassword, { type: argon2.argon2id }),
  });
  return user;
}

function baseRegisterDto(overrides: Partial<RegisterDto> = {}): RegisterDto {
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
  let repo: jest.Mocked<Repository<UserEntity>>;
  let tokens: jest.Mocked<TokensService>;
  let service: AuthService;

  beforeEach(() => {
    repo = makeUserRepo();
    tokens = makeTokens();
    service = new AuthService(repo, tokens);
  });

  it('refuse les < 18 ans avec UNDERAGE (403) et ne touche pas la base', async () => {
    await expect(
      service.register(baseRegisterDto({ birthDate: yearsAgo(17) })),
    ).rejects.toMatchObject({
      errorCode: BetNextErrorCode.UNDERAGE,
      status: HttpStatus.FORBIDDEN,
    });
    expect(repo.findOne).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('refuse un email déjà utilisé (409)', async () => {
    repo.findOne.mockResolvedValueOnce({ id: 1 } as UserEntity);
    await expect(service.register(baseRegisterDto())).rejects.toMatchObject({
      errorCode: BetNextErrorCode.VALIDATION_ERROR,
      status: HttpStatus.CONFLICT,
    });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('crée un user majeur avec un hash Argon2id vérifiable et un rôle ROLE_USER', async () => {
    repo.findOne.mockResolvedValueOnce(null);
    const result = await service.register(baseRegisterDto());
    const persisted = repo.save.mock.calls[0][0] as UserEntity;
    expect(persisted.role).toBe(Role.USER);
    expect(persisted.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await argon2.verify(persisted.passwordHash, 'StrongPassw0rd!')).toBe(true);
    expect(result).not.toHaveProperty('passwordHash');
  });

  it("normalise l'email (trim + lowercase) avant la vérification d'unicité", async () => {
    repo.findOne.mockResolvedValueOnce(null);
    await service.register(baseRegisterDto({ email: '  Alice@BETNEXT.gg ' }));
    expect(repo.findOne).toHaveBeenCalledWith({ where: { email: 'alice@betnext.gg' } });
  });
});

describe('AuthService.login', () => {
  let repo: jest.Mocked<Repository<UserEntity>>;
  let tokens: jest.Mocked<TokensService>;
  let service: AuthService;

  beforeEach(() => {
    repo = makeUserRepo();
    tokens = makeTokens();
    service = new AuthService(repo, tokens);
  });

  const dto: LoginDto = { email: 'alice@betnext.gg', password: 'StrongPassw0rd!' };

  it('émet un couple access + refresh quand les identifiants sont corrects', async () => {
    repo.findOne.mockResolvedValueOnce(await makeRealUser('StrongPassw0rd!'));

    const result = await service.login(dto, CTX);

    expect(tokens.signAccessToken).toHaveBeenCalledTimes(1);
    expect(tokens.issueSession).toHaveBeenCalledWith(
      expect.objectContaining({ familyId: undefined, ctx: CTX }),
    );
    expect(result).toMatchObject({
      accessToken: 'acc.JWT.dummy',
      refreshToken: 'refresh-clear-text',
      expiresIn: 300,
      user: expect.objectContaining({ email: 'alice@betnext.gg', role: Role.USER }),
    });
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('refuse un email inconnu avec INVALID_CREDENTIALS (401)', async () => {
    repo.findOne.mockResolvedValueOnce(null);
    await expect(service.login(dto, CTX)).rejects.toMatchObject({
      errorCode: BetNextErrorCode.INVALID_CREDENTIALS,
      status: HttpStatus.UNAUTHORIZED,
    });
    expect(tokens.signAccessToken).not.toHaveBeenCalled();
  });

  it('refuse un mauvais mot de passe avec INVALID_CREDENTIALS (401)', async () => {
    repo.findOne.mockResolvedValueOnce(await makeRealUser('AutreMotDePasse9!'));
    await expect(service.login(dto, CTX)).rejects.toMatchObject({
      errorCode: BetNextErrorCode.INVALID_CREDENTIALS,
      status: HttpStatus.UNAUTHORIZED,
    });
    expect(tokens.issueSession).not.toHaveBeenCalled();
  });
});

describe('AuthService.refresh (rotation + détection de réutilisation)', () => {
  let repo: jest.Mocked<Repository<UserEntity>>;
  let tokens: jest.Mocked<TokensService>;
  let service: AuthService;

  beforeEach(() => {
    repo = makeUserRepo();
    tokens = makeTokens();
    service = new AuthService(repo, tokens);
  });

  function activeSession(): SessionEntity {
    return Object.assign(new SessionEntity(), {
      id: 1,
      userId: 42,
      familyId: 'fam-1',
      expiresAt: new Date(Date.now() + 86_400_000),
      revokedAt: null,
      user: Object.assign(new UserEntity(), {
        id: 42,
        name: 'Alice',
        email: 'alice@betnext.gg',
        role: Role.USER,
        birthDate: '1990-01-01',
        createdAt: new Date(),
      }),
    });
  }

  it('rotation : révoque la session courante, en émet une nouvelle dans la même family', async () => {
    const session = activeSession();
    tokens.findSessionByToken.mockResolvedValueOnce(session);

    const result = await service.refresh('any-token', CTX);

    expect(tokens.revokeSession).toHaveBeenCalledWith(session);
    expect(tokens.issueSession).toHaveBeenCalledWith(
      expect.objectContaining({ familyId: 'fam-1', ctx: CTX }),
    );
    expect(tokens.revokeFamily).not.toHaveBeenCalled();
    expect(result.accessToken).toBe('acc.JWT.dummy');
    expect(result.refreshToken).toBe('refresh-clear-text');
  });

  it('refuse un refresh inconnu avec INVALID_CREDENTIALS', async () => {
    tokens.findSessionByToken.mockResolvedValueOnce(null);
    await expect(service.refresh('unknown', CTX)).rejects.toMatchObject({
      errorCode: BetNextErrorCode.INVALID_CREDENTIALS,
    });
    expect(tokens.revokeSession).not.toHaveBeenCalled();
    expect(tokens.revokeFamily).not.toHaveBeenCalled();
  });

  it("réutilisation d'un refresh déjà consommé → révoque toute la family et refuse", async () => {
    const reused = activeSession();
    reused.revokedAt = new Date('2026-06-15T00:00:00Z');
    tokens.findSessionByToken.mockResolvedValueOnce(reused);

    await expect(service.refresh('reused-token', CTX)).rejects.toMatchObject({
      errorCode: BetNextErrorCode.INVALID_CREDENTIALS,
    });
    expect(tokens.revokeFamily).toHaveBeenCalledWith('fam-1');
    expect(tokens.issueSession).not.toHaveBeenCalled();
  });

  it('refuse un refresh expiré avec INVALID_CREDENTIALS', async () => {
    const expired = activeSession();
    expired.expiresAt = new Date(Date.now() - 1000);
    tokens.findSessionByToken.mockResolvedValueOnce(expired);

    await expect(service.refresh('expired', CTX)).rejects.toMatchObject({
      errorCode: BetNextErrorCode.INVALID_CREDENTIALS,
    });
    expect(tokens.revokeSession).not.toHaveBeenCalled();
    expect(tokens.revokeFamily).not.toHaveBeenCalled();
  });
});
